import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import type { McpServerConfig, McpStdioServerConfig } from "../types.js";
import type { ToolDefinition } from "../model/types.js";

function isStdio(config: McpServerConfig): config is McpStdioServerConfig {
  return "command" in config && typeof config.command === "string";
}

function mcpToolName(server: string, tool: string): string {
  return `mcp__${server}__${tool}`;
}

function parseMcpToolName(
  name: string,
): { server: string; tool: string } | undefined {
  // servers can have underscores — split on first `__` after `mcp__` prefix
  if (!name.startsWith("mcp__")) return undefined;
  const rest = name.slice("mcp__".length);
  const idx = rest.indexOf("__");
  if (idx <= 0) return undefined;
  return { server: rest.slice(0, idx), tool: rest.slice(idx + 2) };
}

type Connected = {
  client: Client;
  transport: StdioClientTransport;
  tools: Map<string, string>; // fullName -> original tool name
};

export class McpHost {
  private readonly servers: Map<string, Connected> = new Map();
  private readonly defs: ToolDefinition[] = [];

  static async connect(
    configs: Record<string, McpServerConfig>,
    opts?: { cwd?: string },
  ): Promise<McpHost> {
    const host = new McpHost();
    for (const [name, config] of Object.entries(configs)) {
      if (!isStdio(config)) {
        // HTTP MCP deferred — skip with warning via empty registration
        console.warn(
          `[mxpf-ai-harness] MCP server "${name}" is HTTP; v0.1.0 supports stdio only — skipped`,
        );
        continue;
      }
      await host.connectStdio(name, config, opts?.cwd);
    }
    return host;
  }

  private async connectStdio(
    name: string,
    config: McpStdioServerConfig,
    defaultCwd?: string,
  ): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
      env: { ...process.env, ...config.env } as Record<string, string>,
      cwd: config.cwd ?? defaultCwd,
    });
    const client = new Client({ name: "mxpf-ai-harness", version: "0.1.0" });
    await client.connect(transport);
    const listed = await client.listTools();
    const tools = new Map<string, string>();
    for (const t of listed.tools) {
      const full = mcpToolName(name, t.name);
      tools.set(full, t.name);
      this.defs.push({
        name: full,
        description: t.description ?? `MCP ${name}/${t.name}`,
        inputSchema: (t.inputSchema as Record<string, unknown>) ?? {
          type: "object",
          properties: {},
        },
      });
    }
    this.servers.set(name, { client, transport, tools });
  }

  toolDefinitions(): ToolDefinition[] {
    return [...this.defs];
  }

  async callTool(fullName: string, input: unknown): Promise<string> {
    const parsed = parseMcpToolName(fullName);
    if (!parsed) throw new Error(`Invalid MCP tool name: ${fullName}`);
    const conn = this.servers.get(parsed.server);
    if (!conn) throw new Error(`MCP server not connected: ${parsed.server}`);
    const original = conn.tools.get(fullName);
    if (!original) throw new Error(`MCP tool not found: ${fullName}`);

    const result = await conn.client.callTool({
      name: original,
      arguments:
        input && typeof input === "object"
          ? (input as Record<string, unknown>)
          : {},
    });

    const content = (result as { content?: unknown }).content;
    if (Array.isArray(content)) {
      return content
        .map((c) => {
          if (c && typeof c === "object" && "text" in c) {
            return String((c as { text: unknown }).text);
          }
          return JSON.stringify(c);
        })
        .join("\n");
    }
    return JSON.stringify(result);
  }

  async close(): Promise<void> {
    for (const conn of this.servers.values()) {
      try {
        await conn.client.close();
      } catch {
        // ignore
      }
    }
    this.servers.clear();
  }
}

export { parseMcpToolName, mcpToolName };
