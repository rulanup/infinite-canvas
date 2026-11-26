import assert from "node:assert/strict";
import { test } from "node:test";
import { builtinCallScripts } from "@infinite-canvas/model-runtime/call-scripts/builtin";

/** 取出 openai-image 脚本的 main 函数；网络与素材转换全部打桩。 */
function loadImageScript() {
    const script = builtinCallScripts.find((item) => item.id === "openai-image");
    assert.ok(script, "openai-image script missing");
    return new Function(script.source + "\nreturn main;")() as (params: Record<string, unknown>) => Promise<unknown>;
}

function makeUtils() {
    const requests: unknown[] = [];
    return {
        requests,
        utils: {
            http: { url: (path: string) => `https://provider.test${path}` },
            request: async (value: unknown) => {
                requests.push(value);
                return { data: [{ b64_json: "AA==" }] };
            },
            toBlob: async () => new Blob(["x"]),
        },
    };
}

function params(size: string, sizeTiers?: string[]) {
    return {
        model: "gpt-image-2",
        prompt: "draw",
        images: [],
        apiKey: "k",
        options: { size, count: 1, ...(sizeTiers ? { sizeTiers } : {}) },
        utils: makeUtils().utils,
    };
}

test("openai-image rejects size beyond declared 1K tier", async () => {
    const main = loadImageScript();
    await assert.rejects(() => main(params("3840x2160", ["1K"])), /unsupported image size/);
});

test("openai-image accepts size within declared 2K tier", async () => {
    const main = loadImageScript();
    await main(params("1536x1024", ["1K", "2K"]));
});

test("openai-image keeps legacy rule when no tiers declared", async () => {
    const main = loadImageScript();
    // 1000 不是 16 的倍数，旧规则应拒绝。
    await assert.rejects(() => main(params("1000x1000")), /unsupported image size/);
    // 无档位时 1024x1024 仍放行。
    await main(params("1024x1024"));
});

test("openai-image ignores unknown tier labels", async () => {
    const main = loadImageScript();
    // 未知档位解析不出上限，退化为旧规则：1024x1024 通过。
    await main(params("1024x1024", ["XXL"]));
});
