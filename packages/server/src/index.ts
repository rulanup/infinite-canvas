import { ModelTasks } from "./models/tasks.js";
import { PluginManager } from "./plugins/manager.js";
import { access } from "node:fs/promises";
import path from "node:path";
import { createServer, type Server } from "node:http";
import type { RequestHandler } from "express";
import { FsStorage } from "./storage/fs-storage.js";
import { CanvasSession } from "./canvas/session.js";
import { createCanvasHttpApp, mountEventSockets } from "./server/http.js";
import { createStaticWeb } from "./server/web.js";
import type { ServerConfig } from "./config.js";
import { logger } from "./utils/logger.js";

/**
 * 监听地址与对外主机名默认保持本机（127.0.0.1），仅在显式设置环境变量时才对外暴露。
 * CANVAS_BIND_HOST=0.0.0.0 让服务可被容器/局域网访问；
 * CANVAS_PUBLIC_HOST 用于 config.url，避免页面内绝对地址仍指向 127.0.0.1。
 */
function resolveBindHost() {
    const value = (process.env.CANVAS_BIND_HOST || "").trim();
    return value || "127.0.0.1";
}

function resolvePublicHost(bindHost: string) {
    const value = (process.env.CANVAS_PUBLIC_HOST || "").trim();
    if (value) return value;
    return bindHost === "0.0.0.0" ? "127.0.0.1" : bindHost;
}

export type WebHost = { middleware: RequestHandler; close: () => Promise<void> };
export type LocalWeb = { directory: string } | { create: (http: Server) => Promise<WebHost> };

export async function startLocalServer(options: { dataDirectory: string; web: LocalWeb; port: number; skipThirdPartyPlugins?: boolean; mcp?: ServerConfig["mcp"] }) {
    const bindHost = resolveBindHost();
    const publicHost = resolvePublicHost(bindHost);
    if ("directory" in options.web) await access(path.join(options.web.directory, "index.html"));
    const storage = await FsStorage.open(options.dataDirectory);
    const plugins = new PluginManager(storage, options.skipThirdPartyPlugins);
    let tasks: ModelTasks | undefined;
    const config: ServerConfig = { url: `http://127.0.0.1:${options.port}`, mcp: options.mcp };
    const http = createServer();
    let web: WebHost | undefined;
    let stopping: Promise<void> | undefined;
    const close = () => stopping ??= (async () => {
        const closed = new Promise<void>((resolve) => http.close(() => resolve()));
        try {
            try {
                await tasks?.close();
            } finally {
                try {
                    await plugins.close();
                } finally {
                    const results = await Promise.allSettled([storage.close(), web?.close()]);
                    for (const result of results) if (result.status === "rejected") throw result.reason;
                }
            }
        } finally {
            http.closeAllConnections();
            await closed;
        }
    })();
    try {
        tasks = new ModelTasks(storage);
        await tasks.ready;
        const middleware = "directory" in options.web ? createStaticWeb(options.web.directory) : (web = await options.web.create(http)).middleware;
        const session = new CanvasSession();
        http.on("request", createCanvasHttpApp(config, session, { storage, web: middleware, plugins, tasks }));
        mountEventSockets(http, session, storage);
        await new Promise<void>((resolve, reject) => {
            http.once("error", reject);
            http.listen(options.port, bindHost, () => { http.off("error", reject); resolve(); });
        });
        const boundPort = (http.address() as { port: number }).port;
        // 对外可访问时用真实主机名，避免页面内绝对地址仍指向 127.0.0.1。
        config.url = `http://${bindHost === "0.0.0.0" ? publicHost : bindHost}:${boundPort}`;
    } catch (error) {
        try { await close(); } finally { throw error; }
    }
    return { url: config.url, close };
}
