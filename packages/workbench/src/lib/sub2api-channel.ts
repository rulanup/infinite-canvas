import type { ModelChannel } from "@infinite-canvas/shared/channels";
import { channels } from "@workbench/services/channels/runtime";
import { channelWrites, createModelChannel, createModelGroup, updateChannels, useConfigStore } from "@workbench/stores/use-config-store";
import { detectChannelModel } from "@workbench/lib/model-utils";
import type { CanvasIdentity } from "./canvas-identity";

/** 固定 id：重复同步只更新这一个渠道和分组，不会越加越多。 */
const CHANNEL_ID = "sub2api";
const GROUP_ID = "sub2api-default";

let queue: Promise<void> = Promise.resolve();
let lastKey = "";

/**
 * 嵌入 sub2api 时自动配置渠道：确保存在 baseUrl = apiBase + "/v1" 的 sub2api 渠道，
 * 分组 key 用宿主下发的用户专属 key，再从 /v1/models 拉取模型（带能力元数据）。
 * 渠道配置存在服务端、按用户隔离，所以每个账号各自一份。同一个 key 只同步一次。
 */
export function syncSub2apiChannel(identity: CanvasIdentity | undefined) {
    if (!identity?.apiBase || !identity.apiKey || identity.apiKey === lastKey) return queue;
    lastKey = identity.apiKey;
    queue = queue.then(() => run(identity)).catch((error) => {
        lastKey = "";
        console.warn("[sub2api] 渠道自动配置失败", error);
    });
    return queue;
}

function isEmptyDefault(channel: ModelChannel) {
    return channel.id === "default" && !channel.baseUrl && !channel.groups.length;
}

async function run({ apiKey, apiBase }: CanvasIdentity) {
    const baseUrl = `${apiBase!.replace(/\/+$/, "")}/v1`;
    const current = useConfigStore.getState().config.channels;
    const existing = current.find((item) => item.id === CHANNEL_ID);
    const previous = existing?.groups.find((item) => item.id === GROUP_ID);
    const group = createModelGroup({ id: GROUP_ID, name: "默认分组", apiKey, hasApiKey: true, models: previous?.models ?? [] });
    const channel = createModelChannel({ id: CHANNEL_ID, name: "sub2api", baseUrl, groups: [group, ...(existing?.groups.filter((item) => item.id !== GROUP_ID) ?? [])] });
    const others = current.filter((item) => item.id !== CHANNEL_ID && !isEmptyDefault(item));
    await updateChannels([channel, ...others]);
    await channelWrites.flush();

    const entries = await channels.listModelEntries?.(channel, group, "openai");
    if (!entries?.length) return;
    const latest = useConfigStore.getState().config.channels;
    const saved = latest.find((item) => item.id === CHANNEL_ID);
    const savedGroup = saved?.groups.find((item) => item.id === GROUP_ID);
    if (!saved || !savedGroup) return;
    const known = new Map(savedGroup.models.map((model) => [model.name, model]));
    const seen = new Set<string>();
    const models = entries.filter((entry) => !seen.has(entry.name) && seen.add(entry.name)).map((entry) => known.get(entry.name) ?? detectChannelModel(entry.name, entry));
    const nextGroup = { ...savedGroup, models };
    await updateChannels(latest.map((item) => item.id === CHANNEL_ID ? { ...saved, groups: saved.groups.map((g) => g.id === GROUP_ID ? nextGroup : g) } : item));
    await channelWrites.flush();
}
