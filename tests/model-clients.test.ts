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
});
