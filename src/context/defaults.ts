/** Default budgets for context / tool-result optimizations (v0.2). */

export const DEFAULT_TOOL_RESULT_MAX_CHARS = 32_000;
export const DEFAULT_BASH_MAX_CHARS = 32_000;
export const DEFAULT_READ_DEFAULT_MAX_CHARS = 100_000;
export const DEFAULT_KEEP_RECENT_TURNS = 6;
export const DEFAULT_AUTO_COMPACT_MAX_INPUT_CHARS = 200_000;
/** Tail window preserved when truncating so error lines near the end survive. */
export const TRUNCATE_TAIL_CHARS = 2_048;
