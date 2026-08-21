import type { TokenUsage } from "./types.js";

export type HarnessEvent =
  | { type: "assistant.text"; text: string }
  | { type: "tool.start"; toolCallId: string; name: string; input: unknown }
  | {
      type: "tool.result";
      toolCallId: string;
      name: string;
      output: string;
      isError?: boolean;
    }
  | { type: "status"; status: string; detail?: string }
  | { type: "error"; name: string; message: string }
  | { type: "usage"; usage: TokenUsage };
