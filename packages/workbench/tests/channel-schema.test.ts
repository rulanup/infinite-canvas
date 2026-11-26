import assert from "node:assert/strict";
import { test } from "node:test";
import { channelsSchema } from "@infinite-canvas/shared/channels";

test("channelsSchema keeps optional capability metadata", () => {
    const parsed = channelsSchema.parse([
        {
            id: "c1",
            name: "sub2api",
            baseUrl: "http://192.168.1.159:8080",
            groups: [
                {
                    id: "g1",
                    name: "default",
                    apiKey: "sk-test",
                    models: [
                        {
                            name: "gpt-image-2",
                            capability: "image",
                            scriptId: "openai-image",
                            protocols: ["images"],
                            image: { sizeTiers: ["1K"], sizes: ["1024x1024"] },
                        },
                    ],
                },
            ],
        },
    ]);
    assert.deepEqual(parsed[0].groups[0].models[0].protocols, ["images"]);
    assert.deepEqual(parsed[0].groups[0].models[0].image, { sizeTiers: ["1K"], sizes: ["1024x1024"] });
});

test("channelsSchema accepts models without metadata", () => {
    const parsed = channelsSchema.parse([
        {
            id: "c1",
            name: "other",
            baseUrl: "http://example.test",
            groups: [{ id: "g1", name: "d", apiKey: "k", models: [{ name: "gpt-5.6", capability: "text" }] }],
        },
    ]);
    assert.equal(parsed[0].groups[0].models[0].protocols, undefined);
    assert.equal(parsed[0].groups[0].models[0].image, undefined);
});
