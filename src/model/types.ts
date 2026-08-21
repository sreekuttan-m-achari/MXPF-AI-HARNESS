/** Internal model message / tool formats shared across providers. */

export type TextContent = { type: "text"; text: string };

export type ToolUseContent = {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
};

export type ToolResultContent = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

export type ContentBlock = TextContent | ToolUseContent | ToolResultContent;

export type InternalMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ContentBlock[] }
  | { role: "assistant"; content: string | ContentBlock[] }
  | { role: "tool"; content: ToolResultContent[] };

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ModelCompleteRequest = {
  messages: InternalMessage[];
  tools: ToolDefinition[];
  systemPrompt?: string;
  structuredOutput?: Record<string, unknown>;
  signal?: AbortSignal;
};

export type ModelCompleteResponse = {
  content: ContentBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "other";
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  rawText?: string;
};

export type ModelClient = {
  readonly provider: "anthropic" | "openai";
  readonly modelId: string;
  complete(req: ModelCompleteRequest): Promise<ModelCompleteResponse>;
};
