import { AuthError, ModelError } from "../types.js";
import type {
  ContentBlock,
  InternalMessage,
  ModelClient,
  ModelCompleteRequest,
  ModelCompleteResponse,
  ToolDefinition,
} from "./types.js";

function openaiTools(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

function toOpenAiMessages(messages: InternalMessage[], systemPrompt?: string) {
  const out: Array<Record<string, unknown>> = [];
  if (systemPrompt) {
    out.push({ role: "system", content: systemPrompt });
  }
  for (const m of messages) {
    if (m.role === "system") {
      if (!systemPrompt) out.push({ role: "system", content: m.content });
      continue;
    }
    if (m.role === "tool") {
      for (const tr of m.content) {
        out.push({
          role: "tool",
          tool_call_id: tr.tool_use_id,
          content: tr.content,
        });
      }
      continue;
    }
    if (m.role === "user") {
      if (typeof m.content === "string") {
        out.push({ role: "user", content: m.content });
      } else {
        const text = m.content
          .filter((b): b is { type: "text"; text: string } => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        out.push({ role: "user", content: text });
      }
      continue;
    }
    if (m.role === "assistant") {
      if (typeof m.content === "string") {
        out.push({ role: "assistant", content: m.content });
      } else {
        const text = m.content
          .filter((b): b is { type: "text"; text: string } => b.type === "text")
          .map((b) => b.text)
          .join("");
        const toolCalls = m.content
          .filter(
            (b): b is {
              type: "tool_use";
              id: string;
              name: string;
              input: unknown;
            } => b.type === "tool_use",
          )
          .map((b) => ({
            id: b.id,
            type: "function",
            function: {
              name: b.name,
              arguments: JSON.stringify(b.input ?? {}),
            },
          }));
        out.push({
          role: "assistant",
          content: text || null,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        });
      }
    }
  }
  return out;
}

export type OpenAiClientOptions = {
  modelId: string;
  apiKey: string;
  baseURL?: string;
  fetchFn?: typeof fetch;
};

export function createOpenAiClient(opts: OpenAiClientOptions): ModelClient {
  const fetchFn = opts.fetchFn ?? globalThis.fetch;
  const base = (opts.baseURL ?? "https://api.openai.com/v1").replace(/\/$/, "");

  return {
    provider: "openai",
    modelId: opts.modelId,
    async complete(req: ModelCompleteRequest): Promise<ModelCompleteResponse> {
      const system =
        req.systemPrompt ??
        (req.messages.find((m) => m.role === "system")?.content as
          | string
          | undefined);

      let systemFinal = system;
      if (req.structuredOutput) {
        systemFinal = `${system ?? ""}\n\nRespond with JSON matching this schema:\n${JSON.stringify(req.structuredOutput)}`.trim();
      }

      const body: Record<string, unknown> = {
        model: opts.modelId,
        messages: toOpenAiMessages(req.messages, systemFinal),
        ...(req.tools.length ? { tools: openaiTools(req.tools) } : {}),
      };

      if (req.structuredOutput && req.tools.length === 0) {
        body.response_format = { type: "json_object" };
      }

      const res = await fetchFn(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${opts.apiKey}`,
          // OpenRouter ranking / optional attribution
          ...(base.includes("openrouter.ai")
            ? {
                "HTTP-Referer": "https://github.com/sreekuttan-m-achari/MXPF-AI-HARNESS",
                "X-Title": "mxpf-ai-harness",
              }
            : {}),
        },
        body: JSON.stringify(body),
        signal: req.signal,
      });

      if (res.status === 401 || res.status === 403) {
        throw new AuthError(`OpenAI auth failed: HTTP ${res.status}`);
      }
      if (!res.ok) {
        const text = await res.text();
        let detail = text.slice(0, 800);
        try {
          const j = JSON.parse(text) as {
            error?: { message?: string; code?: string };
            message?: string;
          };
          detail =
            j.error?.message ||
            j.message ||
            detail;
        } catch {
          // keep raw text
        }
        throw new ModelError(
          `OpenAI/OpenRouter error HTTP ${res.status}: ${detail}`,
        );
      }

      const json = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
          finish_reason?: string;
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const choice = json.choices?.[0];
      const msg = choice?.message;
      const content: ContentBlock[] = [];
      if (msg?.content) {
        content.push({ type: "text", text: msg.content });
      }
      for (const tc of msg?.tool_calls ?? []) {
        let input: unknown = {};
        try {
          input = JSON.parse(tc.function?.arguments ?? "{}");
        } catch {
          input = { raw: tc.function?.arguments };
        }
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function?.name ?? "unknown",
          input,
        });
      }

      const hasTools = content.some((c) => c.type === "tool_use");
      return {
        content,
        stopReason: hasTools
          ? "tool_use"
          : choice?.finish_reason === "length"
            ? "max_tokens"
            : "end_turn",
        usage: {
          inputTokens: json.usage?.prompt_tokens,
          outputTokens: json.usage?.completion_tokens,
        },
        rawText: msg?.content ?? "",
      };
    },
  };
}
