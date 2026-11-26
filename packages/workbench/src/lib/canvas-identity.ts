/** 宿主（sub2api）通过 postMessage 下发的画布身份。 */
export type CanvasIdentity = {
    userId: number;
    apiKey: string;
    apiBase?: string;
};

const STORAGE_KEY = "canvas.sub2api.identity";

/** 读取已保存的画布身份；非嵌入环境或数据损坏时返回 undefined。 */
export function getCanvasIdentity(): CanvasIdentity | undefined {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw) as Partial<CanvasIdentity>;
        if (typeof parsed.apiKey !== "string" || !parsed.apiKey) return undefined;
        return {
            userId: Number(parsed.userId) || 0,
            apiKey: parsed.apiKey,
            ...(typeof parsed.apiBase === "string" && parsed.apiBase ? { apiBase: parsed.apiBase } : {}),
        };
    } catch {
        return undefined;
    }
}

/**
 * 取当前用户的画布专用 key。未嵌入运行时返回 undefined，
 * 调用方回退到渠道分组里保存的 key，保证独立部署仍然可用。
 */
export function getCanvasApiKey(): string | undefined {
    return getCanvasIdentity()?.apiKey;
}

/**
 * 保存宿主下发的身份。hostOrigin 必须与 allowOrigin 一致，
 * 避免任意页面通过 postMessage 注入他人 key。
 */
export function applyCanvasIdentity(value: unknown, hostOrigin: string, allowOrigin?: string): boolean {
    if (allowOrigin && hostOrigin !== allowOrigin) return false;
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    if (typeof record.apiKey !== "string" || !record.apiKey.trim()) return false;
    const identity: CanvasIdentity = {
        userId: Number(record.userId) || 0,
        apiKey: record.apiKey.trim(),
        ...(typeof record.apiBase === "string" && record.apiBase ? { apiBase: record.apiBase } : {}),
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
        return true;
    } catch {
        return false;
    }
}
