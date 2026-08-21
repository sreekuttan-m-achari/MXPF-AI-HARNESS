import { TRUNCATE_TAIL_CHARS } from "./defaults.js";

/**
 * Truncate a tool result for session/model history.
 * Keeps a head slice and the last `TRUNCATE_TAIL_CHARS` so error tails survive.
 */
export function truncateToolResult(text: string, maxChars: number): string {
  if (maxChars <= 0 || text.length <= maxChars) return text;

  const markerBudget = 80;
  const usable = Math.max(16, maxChars - markerBudget);
  const tail = Math.min(TRUNCATE_TAIL_CHARS, Math.floor(usable / 3));
  const head = Math.max(0, usable - tail);

  const headPart = text.slice(0, head);
  const tailPart = text.slice(text.length - tail);
  return (
    `${headPart}\n\n[truncated: kept ${head + tail} of ${text.length} chars]\n\n${tailPart}`
  );
}
