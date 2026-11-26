import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultCallScriptId, detectChannelModel } from "../src/lib/model-utils.js";

test("detectChannelModel prefers server capability and keeps metadata", () => {
    assert.deepEqual(
        detectChannelModel("my-private-alias", {
            capability: "image",
            protocols: ["images"],
            image: { sizeTiers: ["1K"], sizes: ["1024x1024"] },
        }),
        {
            name: "my-private-alias",
            capability: "image",
            scriptId: "openai-image",
            protocols: ["images"],
            image: { sizeTiers: ["1K"], sizes: ["1024x1024"] },
        },
    );
});

test("detectChannelModel falls back to keywords", () => {
    assert.deepEqual(detectChannelModel("gpt-image-2"), { name: "gpt-image-2", capability: "image", scriptId: "openai-image" });
});

test("detectChannelModel omits metadata when server sends none", () => {
    assert.deepEqual(detectChannelModel("gpt-5.6"), { name: "gpt-5.6", capability: "text", scriptId: "openai-text" });
});

test("defaultCallScriptId selects gemini script from protocols", () => {
    assert.equal(defaultCallScriptId("weird-name", "image", ["gemini", "chat"]), "gemini-image");
});

test("defaultCallScriptId maps grok-imagine to grok-image", () => {
    assert.equal(defaultCallScriptId("grok-imagine-1.0", "image"), "grok-image");
    assert.equal(defaultCallScriptId("grok-2-image", "image"), "grok-image");
});
