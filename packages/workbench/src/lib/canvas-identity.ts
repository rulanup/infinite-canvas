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
 * 嵌入式运行时：等待宿主（sub2api）通过 postMessage 下发身份。
 * 只在被 iframe 嵌页时生效，独立打开画布不会触发。
 */
export function installCanvasIdentityBridge() {
    if (typeof window === "undefined" || window.parent === window) return;
    // 同一浏览器换账号时 localStorage 里可能还是上一个人的 key，调用会记到别人账上。
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* 存储不可用时忽略 */ }
    window.addEventListener("message", (event) => {
        if (event.source !== window.parent) return;
        const payload = event.data;
        if (!payload || typeof payload !== "object") return;
        if ((payload as { type?: unknown }).type !== "sub2api.identity") return;
        // 宿主与画布同源部署时 origin 相同；跨端口部署由 allowOrigin 显式放开。
        if (applyCanvasIdentity(payload, event.origin, event.origin)) {
            window.dispatchEvent(new CustomEvent("canvas:identity", { detail: getCanvasIdentity() }));
        }
    });
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
