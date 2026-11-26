import { initializePlugins } from "../services/plugins/runtime";
import { createHttpStorage } from "../services/storage/http";
import { initializeStorage } from "../services/storage/runtime";
import { initializeChannels } from "../services/channels/runtime";
import { createHttpChannels } from "../services/channels/http";
import { initializeModels } from "../services/api/models/runtime";
import { initializeNetwork } from "../services/network/runtime";
import { createLocalNetwork } from "../services/network/local";
import { initializeWorkspaceConfig } from "../services/workspace-config/runtime";
import { createHttpWorkspaceConfig } from "../services/workspace-config/http";
import { loadWorkspaceConfig } from "../stores/use-workspace-config-store";
import { initializeStorageInspection } from "../services/storage-inspection/runtime";
import { createHttpStorageInspection } from "../services/storage-inspection/http";
import { getCanvasIdentity, installCanvasIdentityBridge, type CanvasIdentity } from "../lib/canvas-identity";

export async function startLocal() {
    // 被 sub2api 嵌入时先装身份桥，宿主在 iframe load 后才下发身份，必须早于它。
    installCanvasIdentityBridge();
    const response = await fetch("/api/storage/projects");
    if (!response.ok) throw new Error("WORKSPACE_UNAVAILABLE");
    const storage = createHttpStorage();
    initializeStorage(storage);
    initializeStorageInspection(createHttpStorageInspection());
    initializeWorkspaceConfig(createHttpWorkspaceConfig());
    await loadWorkspaceConfig();
    initializeNetwork(createLocalNetwork(location.origin));
    initializeChannels(createHttpChannels());
    const { loadChannelConfig } = await import("../stores/use-config-store");
    await loadChannelConfig();
    // 渠道配置在服务端按用户隔离；身份可能在配置加载前或后到达，两种情况都要同步一次。
    const { syncSub2apiChannel } = await import("../lib/sub2api-channel");
    window.addEventListener("canvas:identity", (event) => void syncSub2apiChannel((event as CustomEvent<CanvasIdentity | undefined>).detail));
    void syncSub2apiChannel(getCanvasIdentity());
    const { createHttpModels } = await import("../services/api/models/http");
    initializeModels(createHttpModels());
    const { createHttpPlugins } = await import("../services/plugins/http");
    initializePlugins(createHttpPlugins());
}
