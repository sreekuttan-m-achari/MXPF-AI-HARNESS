import type { ContextOptions, ThroughputOptions } from "../types.js";
import {
  DEFAULT_AUTO_COMPACT_MAX_INPUT_CHARS,
  DEFAULT_BASH_MAX_CHARS,
  DEFAULT_KEEP_RECENT_TURNS,
  DEFAULT_READ_DEFAULT_MAX_CHARS,
  DEFAULT_TOOL_RESULT_MAX_CHARS,
} from "./defaults.js";

export type ResolvedContext = {
  toolResultMaxChars: number;
  bashMaxChars: number;
  readDefaultMaxChars: number;
  maxInputChars?: number;
  keepRecentTurns: number;
  persistCompaction: boolean;
};

export type ResolvedThroughput = {
  parallelTools: boolean;
  promptCache: boolean;
};

export function resolveContextOptions(
  opts?: ContextOptions,
): ResolvedContext {
  const maxInputChars =
    opts?.maxInputChars ??
    (opts?.autoCompact ? DEFAULT_AUTO_COMPACT_MAX_INPUT_CHARS : undefined);

  return {
    toolResultMaxChars:
      opts?.toolResultMaxChars ?? DEFAULT_TOOL_RESULT_MAX_CHARS,
    bashMaxChars: opts?.bashMaxChars ?? DEFAULT_BASH_MAX_CHARS,
    readDefaultMaxChars:
      opts?.readDefaultMaxChars ?? DEFAULT_READ_DEFAULT_MAX_CHARS,
    maxInputChars,
    keepRecentTurns: opts?.keepRecentTurns ?? DEFAULT_KEEP_RECENT_TURNS,
    persistCompaction: opts?.persistCompaction ?? false,
  };
}

export function resolveThroughputOptions(
  opts?: ThroughputOptions,
): ResolvedThroughput {
  return {
    parallelTools: opts?.parallelTools !== false,
    promptCache: opts?.promptCache !== false,
  };
}
