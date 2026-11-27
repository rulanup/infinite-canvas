import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultCallScriptId, detectChannelModel } from "../src/lib/model-utils";

test("chat-only text models use the chat completions script", () => {
    assert.equal(defaultCallScriptId("deepseek-v4.1-flash", "text", ["chat"]), "openai-chat-text");
    assert.equal(detectChannelModel("deepseek-v4.1-flash", { capability: "text", protocols: ["chat"] }).scriptId, "openai-chat-text");
});

test("text models that support responses keep the responses script", () => {
    assert.equal(defaultCallScriptId("gpt-5.6", "text", ["responses", "chat"]), "openai-text");
    assert.equal(defaultCallScriptId("gpt-5.6", "text"), "openai-text");
});

test("server capability wins over name guess", () => {
    assert.equal(detectChannelModel("zzdh-Minimax-h3-480p", { capability: "video" }).capability, "video");
    assert.equal(detectChannelModel("zzdh-Minimax-h3-480p").capability, "video");
});
