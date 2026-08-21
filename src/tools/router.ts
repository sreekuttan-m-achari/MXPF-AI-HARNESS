import type { ToolDefinition } from "../model/types.js";
import type { McpHost } from "../mcp/host.js";
import {
  builtinToolDefinitions,
  DEFAULT_BUILTIN_NAMES,
  executeBuiltin,
} from "./builtins.js";

export type ToolExecResult = { output: string; isError: boolean };

export class ToolRouter {
  private readonly cwd: string;
  private readonly builtins: Set<string>;
  private readonly mcp: McpHost | undefined;
  private readonly definitions: ToolDefinition[];

  constructor(opts: {
    cwd: string;
    builtinNames?: string[];
    mcp?: McpHost;
  }) {
    this.cwd = opts.cwd;
    this.builtins = new Set(opts.builtinNames ?? [...DEFAULT_BUILTIN_NAMES]);
    this.mcp = opts.mcp;
    const defs = builtinToolDefinitions([...this.builtins]);
    if (this.mcp) {
      defs.push(...this.mcp.toolDefinitions());
    }
    this.definitions = defs;
  }

  listDefinitions(): ToolDefinition[] {
    return [...this.definitions];
  }

  async execute(name: string, input: unknown): Promise<ToolExecResult> {
    try {
      if (this.builtins.has(name)) {
        const output = await executeBuiltin(this.cwd, name, input);
        return { output, isError: false };
      }
      if (name.startsWith("mcp__") && this.mcp) {
        const output = await this.mcp.callTool(name, input);
        return { output, isError: false };
      }
      return { output: `Unknown tool: ${name}`, isError: true };
    } catch (e) {
      return {
        output: e instanceof Error ? e.message : String(e),
        isError: true,
      };
    }
  }
}
