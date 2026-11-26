import assert from "node:assert/strict";
import { test } from "node:test";
import { parseChannelModelEntries } from "@infinite-canvas/model-runtime/channels";

test("parseChannelModelEntries reads capability metadata", () => {
    const entries = parseChannelModelEntries(
        {
            data: [
                {
                    id: "gpt-image-2",
                    capability: "image",
                    protocols: ["images"],
                    image: { size_tiers: ["1K"], sizes: ["1024x1024"] },
                },
            ],
        },
        "openai",
    );
    assert.deepEqual(entries, [
        { name: "gpt-image-2", capability: "image", protocols: ["images"], image: { sizeTiers: ["1K"], sizes: ["1024x1024"] } },
    ]);
});

test("parseChannelModelEntries tolerates servers without metadata", () => {
    const entries = parseChannelModelEntries({ data: [{ id: "gpt-5.6" }] }, "openai");
    assert.deepEqual(entries, [{ name: "gpt-5.6" }]);
});

test("parseChannelModelEntries ignores malformed metadata", () => {
    const entries = parseChannelModelEntries({ data: [{ id: "m", capability: 42, protocols: "images", image: "x" }] }, "openai");
    assert.deepEqual(entries, [{ name: "m" }]);
});

test("parseChannelModelEntries drops unknown capability values", () => {
    const entries = parseChannelModelEntries({ data: [{ id: "m", capability: "hologram" }] }, "openai");
    assert.deepEqual(entries, [{ name: "m" }]);
});

test("parseChannelModelEntries reads gemini format", () => {
    const entries = parseChannelModelEntries({ models: [{ name: "models/gemini-3-pro-image", capability: "image" }] }, "gemini");
    assert.deepEqual(entries, [{ name: "gemini-3-pro-image", capability: "image" }]);
});

test("parseChannelModelEntries sorts by name", () => {
    const entries = parseChannelModelEntries({ data: [{ id: "b" }, { id: "a" }] }, "openai");
    assert.deepEqual(entries.map((entry) => entry.name), ["a", "b"]);
});
