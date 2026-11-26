import type { ChannelSnapshot, ModelGroup, ModelListFormat } from "@infinite-canvas/shared/channels";
import type { ChannelModelEntry } from "@infinite-canvas/model-runtime/channels";
import { ModelExecutionError, modelErrorMessages } from "@infinite-canvas/shared/model-http";
import { StorageError } from "@infinite-canvas/shared/storage-data";
import { requestStorage } from "@workbench/lib/storage-request";
import type { ChannelAdapter } from "./runtime";

/** 服务端返回的条目只需名称必填，其余字段缺失即视为未提供。 */
function toEntry(value: unknown): ChannelModelEntry | undefined {
    if (!value || typeof value !== "object") return undefined;
    const record = value as Record<string, unknown>;
    if (typeof record.name !== "string" || !record.name) return undefined;
    const protocols = Array.isArray(record.protocols) ? record.protocols.filter((item): item is string => typeof item === "string") : undefined;
    const image = record.image && typeof record.image === "object" ? (record.image as ChannelModelEntry["image"]) : undefined;
    return {
        name: record.name,
        ...(typeof record.capability === "string" ? { capability: record.capability as ChannelModelEntry["capability"] } : {}),
        ...(protocols?.length ? { protocols } : {}),
        ...(image ? { image } : {}),
    };
}

export function createHttpChannels(): ChannelAdapter {
    const clientId = crypto.randomUUID();
    const requestModels = async (group: ModelGroup, format: ModelListFormat, signal?: AbortSignal): Promise<unknown> => {
        try {
            const response = await fetch("/api/channels/models", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ groupId: group.id, format }), signal });
            const data = await response.json();
            if (response.ok) return data;
            const code = data?.error?.code;
            if (code === "STORAGE_UNAVAILABLE" || code === "STORAGE_INVALID") throw new StorageError(code);
            throw new ModelExecutionError(Object.hasOwn(modelErrorMessages, code) ? code : "MODEL_LIST_FAILED");
        } catch (error) {
            signal?.throwIfAborted();
            if (error instanceof ModelExecutionError || error instanceof StorageError) throw error;
            throw new ModelExecutionError("MODEL_UNAVAILABLE");
        }
    };
    const listModelEntries = async (group: ModelGroup, format: ModelListFormat, signal?: AbortSignal): Promise<ChannelModelEntry[]> => {
        const data = await requestModels(group, format, signal);
        if (!Array.isArray(data)) throw new ModelExecutionError("MODEL_LIST_FAILED");
        return data.map(toEntry).filter((entry): entry is ChannelModelEntry => Boolean(entry));
    };
    return {
        async load() {
            const result = await (await requestStorage("/api/channels")).json() as ChannelSnapshot | null;
            return result?.channels ?? null;
        },
        async save(channels) {
            const result = await (await requestStorage("/api/channels", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ channels, clientId }) })).json() as ChannelSnapshot;
            return result.channels;
        },
        async listModels(channel, group, format, signal) {
            return (await listModelEntries(group, format, signal)).map((entry) => entry.name);
        },
        listModelEntries: (_channel, group, format, signal) => listModelEntries(group, format, signal),
    };
}
