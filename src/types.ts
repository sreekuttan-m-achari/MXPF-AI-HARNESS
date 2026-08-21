/** Public types for mxpf-ai-harness. */

export type Capability =
  | "tools"
  | "mcp"
  | "resume"
  | "cancel"
  | "structuredOutput"
  | "subagents"
  | "hooks"
  | "observability";

/** v1 capability matrix — roadmap features stay false until shipped. */
export const V1_CAPABILITIES: Readonly<Record<Capability, boolean>> = {
  tools: true,
  mcp: true,
  resume: true,
  cancel: true,
  structuredOutput: true,
  subagents: false,
  hooks: false,
  observability: false,
};

export function supportsCapability(c: Capability): boolean {
  return V1_CAPABILITIES[c] === true;
}

export type ModelProvider = "anthropic" | "openai";

export type ModelRef = {
  provider: ModelProvider;
  id: string;
  baseURL?: string;
  apiKey?: string;
};

export type PermissionMode = "bypass" | "allowlist" | "deny-by-default";

export type PermissionPolicy = {
  mode?: PermissionMode;
  /** Tool name patterns; `*` suffix allowed (e.g. `mcp__fleet__*`). */
  allow?: string[];
  deny?: string[];
};

export type ToolPolicy = {
  /** Built-in tool names to enable. Default: all coding builtins. */
  builtins?: string[];
  /** When false, MCP tools are not registered. Default true. */
  mcp?: boolean;
};

/** Cursor-compatible MCP server config shapes. */
export type McpStdioServerConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
};

export type McpHttpServerConfig = {
  url: string;
  headers?: Record<string, string>;
};

export type McpServerConfig = McpStdioServerConfig | McpHttpServerConfig;

export type HarnessOptions = {
  cwd: string;
  model: ModelRef;
  tools?: ToolPolicy;
  mcpServers?: Record<string, McpServerConfig>;
  permissions?: PermissionPolicy;
  sessionDir?: string;
  systemPrompt?: string;
  /** Max model↔tool iterations per send(). Default 40. */
  maxTurns?: number;
  /** Optional injectable fetch for tests / custom transports. */
  fetch?: typeof globalThis.fetch;
};

export type SendOptions = {
  /** When set, ask the model for JSON matching this schema (provider-dependent). */
  structuredOutput?: Record<string, unknown>;
};

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type RunStatus = "running" | "finished" | "error" | "cancelled";

export type RunResult = {
  id: string;
  status: RunStatus;
  result?: string | null;
  structured?: unknown;
  model?: { id: string; provider: ModelProvider };
  usage?: TokenUsage;
  error?: { name: string; message: string };
  durationMs?: number;
};

export class HarnessError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "HarnessError";
  }
}

export class AuthError extends HarnessError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AuthError";
  }
}

export class ModelError extends HarnessError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ModelError";
  }
}

export class CancelledError extends HarnessError {
  constructor(message = "Run cancelled") {
    super(message);
    this.name = "CancelledError";
  }
}
