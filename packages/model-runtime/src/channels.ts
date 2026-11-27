import axios from "axios";
import type { ModelListFormat } from "@infinite-canvas/shared/channels";
import type { ModelCapability } from "@infinite-canvas/shared/models";
import { modelCapabilities } from "@infinite-canvas/shared/models";
import { isInsufficientBalanceResponse, ModelExecutionError } from "@infinite-canvas/shared/model-http";
import { buildModelApiUrl } from "./script.js";

/**
 * 服务端在模型列表里可以携带的可选元数据。缺省时调用方回退到按名称判断，
 * 因此对任意 OpenAI 兼容服务都保持可用。
 */
export type ChannelModelEntry = {
    name: string;
    capability?: ModelCapability;
    protocols?: string[];
    image?: { sizeTiers?: string[]; sizes?: string[] };
};

function readStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const items = value.filter((item): item is string => typeof item === "string" && item.length > 0);
    return items.length ? items : undefined;
}

function readImageInfo(value: unknown): ChannelModelEntry["image"] {
    if (!value || typeof value !== "object") return undefined;
    const record = value as Record<string, unknown>;
    const sizeTiers = readStringArray(record.size_tiers);
    const sizes = readStringArray(record.sizes);
    if (!sizeTiers && !sizes) return undefined;
    return { ...(sizeTiers ? { sizeTiers } : {}), ...(sizes ? { sizes } : {}) };
}

function readCapability(value: unknown): ModelCapability | undefined {
    return typeof value === "string" && (modelCapabilities as readonly string[]).includes(value) ? (value as ModelCapability) : undefined;
}

/**
 * 把模型列表载荷解析成结构化条目。字段缺失或类型不符时忽略该字段而不是报错，
 * 保证服务端未提供元数据时行为与纯名称列表一致。
 */
export function parseChannelModelEntries(payload: unknown, format: ModelListFormat): ChannelModelEntry[] {
    const entries: ChannelModelEntry[] = [];
    const push = (name: unknown, item: Record<string, unknown>) => {
        if (typeof name !== "string" || !name) return;
        const capability = readCapability(item.capability);
        const protocols = readStringArray(item.protocols);
        const image = readImageInfo(item.image);
        entries.push({
            name,
            ...(capability ? { capability } : {}),
            ...(protocols ? { protocols } : {}),
            ...(image ? { image } : {}),
        });
    };

    if (format === "gemini") {
        const models = (payload as { models?: unknown } | null)?.models;
        if (Array.isArray(models)) {
            for (const item of models) {
                if (!item || typeof item !== "object") continue;
                const record = item as Record<string, unknown>;
                push(typeof record.name === "string" ? record.name.replace(/^models\//, "") : undefined, record);
            }
        }
    } else {
        const data = (payload as { data?: unknown } | null)?.data;
        if (Array.isArray(data)) {
            for (const item of data) {
                if (!item || typeof item !== "object") continue;
                push((item as Record<string, unknown>).id, item as Record<string, unknown>);
            }
        }
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name));
}

async function requestModelList(baseUrl: string, apiKey: string, format: ModelListFormat, mapUrl: (url: string) => string, signal?: AbortSignal): Promise<unknown> {
    const base = baseUrl.replace(/\/+$/, "");
    const root = /\/v1(?:beta)?$/i.test(base) ? base : `${base}/v1beta`;
    const endpoint = format === "gemini" ? `${root}/models` : buildModelApiUrl(baseUrl, "/models");
    const url = mapUrl(endpoint);
    try {
        const response = await axios.get(url, {
            headers: format === "gemini" ? { "x-goog-api-key": apiKey, "Content-Type": "application/json" } : { Authorization: `Bearer ${apiKey}` },
            signal,
        });
        if (response.data.error) throw new axios.AxiosError("Model list failed", undefined, response.config, response.request, response);
        return response.data;
    } catch (error) {
        signal?.throwIfAborted();
        if (axios.isCancel(error)) throw error;
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            console.warn("[channels] model list request failed", { status, code: error.code });
            if (isInsufficientBalanceResponse(error.response?.data)) throw new ModelExecutionError("MODEL_INSUFFICIENT_BALANCE");
            if (status === 401 || status === 403 || error.response?.data?.error?.code === "invalid_api_key") throw new ModelExecutionError("MODEL_LIST_AUTH");
            if (status === 429) throw new ModelExecutionError("MODEL_LIST_LIMITED");
            if (!error.response) throw new ModelExecutionError(url !== endpoint ? "MODEL_PROXY" : "MODEL_LIST_CONNECTION");
        }
        throw new ModelExecutionError("MODEL_LIST_FAILED");
    }
}

/** 拉取模型列表并保留服务端提供的可选元数据。 */
export async function fetchChannelModelEntries(baseUrl: string, apiKey: string, format: ModelListFormat, mapUrl: (url: string) => string, signal?: AbortSignal): Promise<ChannelModelEntry[]> {
    return parseChannelModelEntries(await requestModelList(baseUrl, apiKey, format, mapUrl, signal), format);
}

/** 只取模型名；保留原有签名供既有调用方使用。 */
export async function fetchChannelModels(baseUrl: string, apiKey: string, format: ModelListFormat, mapUrl: (url: string) => string, signal?: AbortSignal): Promise<string[]> {
    return (await fetchChannelModelEntries(baseUrl, apiKey, format, mapUrl, signal)).map((entry) => entry.name);
}
