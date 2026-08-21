import type { ContentBlock, InternalMessage } from "../model/types.js";

export type CompactOptions = {
  maxInputChars: number;
  keepRecentTurns: number;
};

function blockChars(b: ContentBlock): number {
  if (b.type === "text") return b.text.length;
  if (b.type === "tool_use") {
    return b.name.length + JSON.stringify(b.input ?? {}).length;
  }
  return b.content.length + b.tool_use_id.length;
}

function messageChars(m: InternalMessage): number {
  if (m.role === "system") return m.content.length;
  if (m.role === "tool") {
    return m.content.reduce((n, tr) => n + tr.content.length, 0);
  }
  if (typeof m.content === "string") return m.content.length;
  return m.content.reduce((n, b) => n + blockChars(b), 0);
}

/** Rough char estimate for budgeting (not a tokenizer). */
export function estimateChars(messages: InternalMessage[]): number {
  return messages.reduce((n, m) => n + messageChars(m), 0);
}

function messagePreview(m: InternalMessage, max = 240): string {
  if (m.role === "system") return `[system] ${m.content.slice(0, max)}`;
  if (m.role === "tool") {
    const names = m.content
      .map((tr) => tr.tool_use_id)
      .slice(0, 5)
      .join(", ");
    const sample = m.content[0]?.content.slice(0, max) ?? "";
    return `[tool results ${names}] ${sample}`;
  }
  if (typeof m.content === "string") {
    return `[${m.role}] ${m.content.slice(0, max)}`;
  }
  const texts = m.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join(" ");
  const tools = m.content
    .filter((b): b is { type: "tool_use"; name: string; id: string; input: unknown } =>
      b.type === "tool_use",
    )
    .map((b) => b.name);
  const head = texts || (tools.length ? `tools: ${tools.join(", ")}` : "");
  return `[${m.role}] ${head.slice(0, max)}`;
}

/**
 * Split messages into rounds starting at each `user` message.
 * Non-user leading messages (rare) form a preamble round.
 */
function splitRounds(messages: InternalMessage[]): InternalMessage[][] {
  const rounds: InternalMessage[][] = [];
  let current: InternalMessage[] = [];
  for (const m of messages) {
    if (m.role === "user" && current.length > 0) {
      rounds.push(current);
      current = [m];
    } else {
      current.push(m);
    }
  }
  if (current.length) rounds.push(current);
  return rounds;
}

/**
 * If over budget, replace older rounds with one extractive summary user message
 * and keep the last `keepRecentTurns` rounds verbatim.
 */
export function compactMessages(
  messages: InternalMessage[],
  opts: CompactOptions,
): { messages: InternalMessage[]; compacted: boolean } {
  const total = estimateChars(messages);
  if (total <= opts.maxInputChars) {
    return { messages, compacted: false };
  }

  const rounds = splitRounds(messages);
  const keep = Math.max(1, opts.keepRecentTurns);
  if (rounds.length <= keep) {
    // Still over budget with few rounds — summarize everything except last round.
    const last = rounds[rounds.length - 1] ?? [];
    const older = rounds.slice(0, -1).flat();
    const summary = buildSummary(older);
    return {
      messages: [{ role: "user", content: summary }, ...last],
      compacted: true,
    };
  }

  const older = rounds.slice(0, -keep).flat();
  const recent = rounds.slice(-keep).flat();
  const summary = buildSummary(older);
  return {
    messages: [{ role: "user", content: summary }, ...recent],
    compacted: true,
  };
}

function buildSummary(older: InternalMessage[]): string {
  const lines = older.map((m) => `- ${messagePreview(m)}`);
  const body = lines.slice(0, 80).join("\n");
  const extra =
    lines.length > 80 ? `\n… (${lines.length - 80} more entries omitted)` : "";
  return (
    `[context summary — older turns compacted to save tokens]\n` +
    `Covered ${older.length} messages.\n` +
    body +
    extra
  );
}
