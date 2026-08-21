import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAnthropicClient } from "../src/model/anthropic.js";
import { createOpenAiClient } from "../src/model/openai.js";

describe("model clients", () => {
  it("anthropic maps tool_use from Messages API", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          content: [
            { type: "text", text: "working" },
            {
              type: "tool_use",
              id: "t1",
              name: "Read",
              input: { path: "a.txt" },
            },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    const client = createAnthropicClient({
      modelId: "claude-sonnet-4-5",
      apiKey: "test",
      fetchFn,
    });
    const res = await client.complete({
      messages: [{ role: "user", content: "read a" }],
      tools: [
        {
          name: "Read",
          description: "read",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    });
    assert.equal(res.stopReason, "tool_use");
    assert.equal(res.content.some((c) => c.type === "tool_use"), true);
  });

  it("openai maps tool_calls from chat completions", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "tool_calls",
              message: {
                content: null,
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: {
                      name: "Bash",
                      arguments: JSON.stringify({ command: "echo hi" }),
                    },
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 3, completion_tokens: 2 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    const client = createOpenAiClient({
      modelId: "gpt-4.1",
      apiKey: "test",
      fetchFn,
    });
    const res = await client.complete({
      messages: [{ role: "user", content: "run" }],
      tools: [
        {
          name: "Bash",
          description: "bash",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    });
    assert.equal(res.stopReason, "tool_use");
    const tool = res.content.find((c) => c.type === "tool_use");
    assert.ok(tool && tool.type === "tool_use");
    assert.equal(tool.name, "Bash");
  });

  it("anthropic applies cache_control and max_tokens when requested", async () => {
    let body: Record<string, unknown> = {};
    const fetchFn: typeof fetch = async (_url, init) => {
      body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: "ok" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const client = createAnthropicClient({
      modelId: "claude-sonnet-4-5",
      apiKey: "test",
      fetchFn,
      maxOutputTokens: 1024,
    });
    await client.complete({
      messages: [{ role: "user", content: "hi" }],
      tools: [
        {
          name: "Read",
          description: "read",
          inputSchema: { type: "object", properties: {} },
        },
      ],
      systemPrompt: "You are helpful.",
      promptCache: true,
      maxOutputTokens: 512,
    });

    assert.equal(body.max_tokens, 512);
    const system = body.system as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(system));
    assert.deepEqual(system[0]?.cache_control, { type: "ephemeral" });
    const tools = body.tools as Array<Record<string, unknown>>;
    assert.deepEqual(tools[0]?.cache_control, { type: "ephemeral" });
  });

  it("openai sends max_tokens when set", async () => {
    let body: Record<string, unknown> = {};
    const fetchFn: typeof fetch = async (_url, init) => {
      body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          choices: [{ finish_reason: "stop", message: { content: "hi" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = createOpenAiClient({
      modelId: "gpt-4.1",
      apiKey: "test",
      fetchFn,
    });
    await client.complete({
      messages: [{ role: "user", content: "hi" }],
      tools: [],
      maxOutputTokens: 256,
    });
    assert.equal(body.max_tokens, 256);
  });
});
