import type { ModelChannel, ModelGroup, ModelListFormat } from "@infinite-canvas/shared/channels";
import type { ChannelModelEntry } from "@infinite-canvas/model-runtime/channels";

export interface ChannelAdapter {
    load(): Promise<ModelChannel[] | null>;
    save(channels: ModelChannel[]): Promise<ModelChannel[]>;
    listModels(channel: ModelChannel, group: ModelGroup, format: ModelListFormat, signal?: AbortSignal): Promise<string[]>;
    /** 拉取模型列表并保留服务端提供的可选能力元数据。 */
    listModelEntries(channel: ModelChannel, group: ModelGroup, format: ModelListFormat, signal?: AbortSignal): Promise<ChannelModelEntry[]>;
}

export let channels: ChannelAdapter;

export function initializeChannels(adapter: ChannelAdapter) {
    if (channels) throw new Error("CHANNELS_ALREADY_INITIALIZED");
    channels = adapter;
}
