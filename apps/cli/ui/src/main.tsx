import { startLocal } from "@infinite-canvas/workbench/startup/local";

// crypto.randomUUID 只在安全上下文（HTTPS / localhost）可用。
// 通过局域网 IP + HTTP 访问时它不存在，会让启动直接抛错，
// 这里用 getRandomValues 补一个等价的 UUID v4。
if (typeof crypto !== "undefined" && typeof crypto.randomUUID !== "function") {
    Object.defineProperty(crypto, "randomUUID", {
        configurable: true,
        writable: true,
        value: () => {
            const bytes = crypto.getRandomValues(new Uint8Array(16));
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;
            const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
            return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        },
    });
}

void startLocal().then(() => import("./bootstrap")).catch((error) => {
    console.error("[workbench] startup failed", error);
    const root = document.getElementById("root")!;
    root.textContent = "暂时无法打开工作台。请确认本地程序仍在运行，并从启动命令显示的地址重新打开。";
    const button = document.createElement("button");
    button.textContent = "重试";
    button.onclick = () => location.reload();
    root.append(button);
});
