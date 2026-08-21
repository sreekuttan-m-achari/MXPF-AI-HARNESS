import { AuthError, ModelError } from "../types.js";
import type {
  ContentBlock,
  InternalMessage,
  ModelClient,
  ModelCompleteRequest,
  ModelCompleteResponse,
  ToolDefinition,
} from "./types.js";

function anthropicTools(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

function toAnthropicMessages(messages: InternalMessage[]) {
  const out: Array<{ role: "user" | "assistant"; content: unknown }> = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      out.push({
        role: "user",
        content: m.content.map((tr) => ({
          type: "tool_result",
          tool_use_id: tr.tool_use_id,
          content: tr.content,
          is_error: tr.is_error,
        })),
      });
      continue;
    }
    if (m.role === "user" || m.role === "assistant") {
      out.push({
        role: m.role,
        content:
          typeof m.content === "string"
            ? m.content
            : m.content.map((b) => {
                if (b.type === "text") return { type: "text", text: b.text };
                if (b.type === "tool_use") {
                  return {
                    type: "tool_use",
                    id: b.id,
                    name: b.name,
                    input: b.input,
                  };
                }
                return {
                  type: "tool_result",
                  tool_use_id: b.tool_use_id,
                  content: b.content,
                  is_error: b.is_error,
                };
              }),
      });
    }
  }
  return out;
}

function parseAnthropicContent(raw: unknown): ContentBlock[] {
  if (!Array.isArray(raw)) return [];
  const blocks: ContentBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;
    if (b.type === "text" && typeof b.text === "string") {
      blocks.push({ type: "text", text: b.text });
    } else if (
      b.type === "tool_use" &&
      typeof b.id === "string" &&
      typeof b.name === "string"
    ) {
      blocks.push({
        type: "tool_use",
        id: b.id,
        name: b.name,
        input: b.input ?? {},
      });
    }
  }
  return blocks;
}

export type AnthropicClientOptions = {
  modelId: string;
  apiKey: string;
  baseURL?: string;
  fetchFn?: typeof fetch;
};

export function createAnthropicClient(
  opts: AnthropicClientOptions,
): ModelClient {
  const fetchFn = opts.fetchFn ?? globalThis.fetch;
  const base = (opts.baseURL ?? "https://api.anthropic.com").replace(/\/$/, "");

  return {
    provider: "anthropic",
    modelId: opts.modelId,
    async complete(req: ModelCompleteRequest): Promise<ModelCompleteResponse> {
      const system =
        req.systemPrompt ??
        (req.messages.find((m) => m.role === "system")?.content as
          | string
          | undefined);

      const body: Record<string, unknown> = {
        model: opts.modelId,
        max_tokens: 8192,
        messages: toAnthropicMessages(req.messages),
        ...(system ? { system } : {}),
        ...(req.tools.length
          ? { tools: anthropicTools(req.tools) }
          : {}),
      };

      if (req.structuredOutput) {
        body.tool_choice = undefined;
        // Prefer JSON via instruction when tools present; many pipes ignore response_format.
        const hint = `\n\nRespond with JSON matching this schema:\n${JSON.stringify(req.structuredOutput)}`;
        body.system = `${system ?? ""}${hint}`.trim();
      }

      const res = await fetchFn(`${base}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": opts.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: req.signal,
      });

      if (res.status === 401 || res.status === 403) {
        throw new AuthError(`Anthropic auth failed: HTTP ${res.status}`);
      }
      if (!res.ok) {
        const text = await res.text();
        throw new ModelError(`Anthropic error HTTP ${res.status}: ${text}`);
      }

      const json = (await res.json()) as {
        content?: unknown;
        stop_reason?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const content = parseAnthropicContent(json.content);
      const hasTools = content.some((c) => c.type === "tool_use");
      const rawText = content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("");

      return {
        content,
        stopReason: hasTools
          ? "tool_use"
          : json.stop_reason === "max_tokens"
            ? "max_tokens"
            : "end_turn",
        usage: {
          inputTokens: json.usage?.input_tokens,
          outputTokens: json.usage?.output_tokens,
        },
        rawText,
      };
    },
  };
}
