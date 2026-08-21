import type { HarnessEvent } from "./events.js";
import {
  compactMessages,
  estimateChars,
} from "./context/compact.js";
import type {
  ResolvedContext,
  ResolvedThroughput,
} from "./context/resolve.js";
import { truncateToolResult } from "./context/truncate.js";
import type { ModelClient } from "./model/types.js";
import type { InternalMessage, ToolUseContent } from "./model/types.js";
import { PermissionGate } from "./permissions/gate.js";
import type { SessionStore } from "./session/store.js";
import type { ToolRouter } from "./tools/router.js";
import { CancelledError, type TokenUsage } from "./types.js";

export type LoopOptions = {
  model: ModelClient;
  router: ToolRouter;
  permissions: PermissionGate;
  session: SessionStore;
  systemPrompt?: string;
  maxTurns: number;
  structuredOutput?: Record<string, unknown>;
  signal: AbortSignal;
  emit: (event: HarnessEvent) => void;
  context: ResolvedContext;
  throughput: ResolvedThroughput;
  maxOutputTokens?: number;
};

export type LoopResult = {
  text: string;
  structured?: unknown;
  usage: TokenUsage;
};

function mergeUsage(a: TokenUsage, b?: { inputTokens?: number; outputTokens?: number }): TokenUsage {
  const input = (a.inputTokens ?? 0) + (b?.inputTokens ?? 0);
  const output = (a.outputTokens ?? 0) + (b?.outputTokens ?? 0);
  return {
    inputTokens: input || undefined,
    outputTokens: output || undefined,
    totalTokens: input + output || undefined,
  };
}

export async function runAgentLoop(opts: LoopOptions): Promise<LoopResult> {
  const usage: TokenUsage = {};
  let finalText = "";
  let structured: unknown;

  for (let turn = 0; turn < opts.maxTurns; turn++) {
    if (opts.signal.aborted) throw new CancelledError();

    opts.emit({ type: "status", status: "model", detail: `turn ${turn + 1}` });

    let messages = opts.session.getMessages();
    if (opts.context.maxInputChars != null) {
      const before = estimateChars(messages);
      const compacted = compactMessages(messages, {
        maxInputChars: opts.context.maxInputChars,
        keepRecentTurns: opts.context.keepRecentTurns,
      });
      if (compacted.compacted) {
        messages = compacted.messages;
        opts.emit({
          type: "status",
          status: "context",
          detail: `compacted ${before}→${estimateChars(messages)} chars`,
        });
        if (opts.context.persistCompaction) {
          opts.session.setMessages(messages);
        }
      }
    }

    const response = await opts.model.complete({
      messages,
      tools: opts.router.listDefinitions(),
      systemPrompt: opts.systemPrompt,
      structuredOutput: opts.structuredOutput,
      signal: opts.signal,
      promptCache: opts.throughput.promptCache,
      maxOutputTokens: opts.maxOutputTokens,
    });

    Object.assign(usage, mergeUsage(usage, response.usage));
    if (response.usage) {
      opts.emit({ type: "usage", usage: { ...usage } });
    }

    const toolUses = response.content.filter(
      (b): b is ToolUseContent => b.type === "tool_use",
    );
    const textParts = response.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text);

    for (const t of textParts) {
      if (t) opts.emit({ type: "assistant.text", text: t });
    }

    const assistantMsg: InternalMessage = {
      role: "assistant",
      content: response.content.length
        ? response.content
        : [{ type: "text", text: response.rawText ?? "" }],
    };
    opts.session.append(assistantMsg);

    if (toolUses.length === 0) {
      finalText = textParts.join("") || response.rawText || "";
      if (opts.structuredOutput && finalText) {
        try {
          structured = JSON.parse(finalText);
        } catch {
          structured = undefined;
        }
      }
      return { text: finalText, structured, usage };
    }

    for (const tu of toolUses) {
      opts.emit({
        type: "tool.start",
        toolCallId: tu.id,
        name: tu.name,
        input: tu.input,
      });
    }

    const runOne = async (tu: ToolUseContent) => {
      if (opts.signal.aborted) throw new CancelledError();
      const decision = opts.permissions.check(tu.name);
      let output: string;
      let isError = false;
      if (!decision.allowed) {
        output = `Permission denied: ${decision.reason}`;
        isError = true;
      } else {
        const result = await opts.router.execute(tu.name, tu.input);
        output = result.output;
        isError = result.isError;
      }
      const truncated = truncateToolResult(
        output,
        opts.context.toolResultMaxChars,
      );
      if (truncated.length < output.length) {
        opts.emit({
          type: "status",
          status: "tool",
          detail: `truncated ${tu.name} ${output.length}→${truncated.length}`,
        });
      }
      return { tu, output: truncated, isError };
    };

    const settled = opts.throughput.parallelTools
      ? await Promise.all(toolUses.map((tu) => runOne(tu)))
      : await (async () => {
          const out = [];
          for (const tu of toolUses) out.push(await runOne(tu));
          return out;
        })();

    const toolResults: InternalMessage = {
      role: "tool",
      content: [],
    };

    for (const item of settled) {
      opts.emit({
        type: "tool.result",
        toolCallId: item.tu.id,
        name: item.tu.name,
        output: item.output,
        isError: item.isError,
      });
      toolResults.content.push({
        type: "tool_result",
        tool_use_id: item.tu.id,
        content: item.output,
        is_error: item.isError,
      });
    }

    opts.session.append(toolResults);
  }

  throw new Error(`Exceeded maxTurns (${opts.maxTurns})`);
}
