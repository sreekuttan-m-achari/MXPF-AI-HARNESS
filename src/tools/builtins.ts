import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { truncateToolResult } from "../context/truncate.js";
import {
  DEFAULT_BASH_MAX_CHARS,
  DEFAULT_READ_DEFAULT_MAX_CHARS,
} from "../context/defaults.js";
import type { ToolDefinition } from "../model/types.js";

const execFileAsync = promisify(execFile);

export const DEFAULT_BUILTIN_NAMES = [
  "Read",
  "Write",
  "Edit",
  "Bash",
  "Glob",
  "Grep",
] as const;

export type BuiltinName = (typeof DEFAULT_BUILTIN_NAMES)[number];

function assertUnderCwd(cwd: string, targetPath: string): string {
  const abs = isAbsolute(targetPath) ? resolve(targetPath) : resolve(cwd, targetPath);
  const rel = relative(cwd, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Path escapes cwd: ${targetPath}`);
  }
  return abs;
}

function asString(input: unknown, key: string): string {
  if (!input || typeof input !== "object") {
    throw new Error(`Missing ${key}`);
  }
  const v = (input as Record<string, unknown>)[key];
  if (typeof v !== "string") throw new Error(`Missing string ${key}`);
  return v;
}

function asOptionalString(input: unknown, key: string): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const v = (input as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

function asOptionalNumber(input: unknown, key: string): number | undefined {
  if (!input || typeof input !== "object") return undefined;
  const v = (input as Record<string, unknown>)[key];
  return typeof v === "number" ? v : undefined;
}

export function builtinToolDefinitions(
  enabled: string[] = [...DEFAULT_BUILTIN_NAMES],
): ToolDefinition[] {
  const all: Record<string, ToolDefinition> = {
    Read: {
      name: "Read",
      description: "Read a UTF-8 text file relative to the workspace cwd.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          offset: { type: "number", description: "1-based start line" },
          limit: { type: "number", description: "max lines" },
        },
        required: ["path"],
      },
    },
    Write: {
      name: "Write",
      description: "Write a UTF-8 text file (creates parents).",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
    Edit: {
      name: "Edit",
      description: "Replace an exact string occurrence in a file.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          old_string: { type: "string" },
          new_string: { type: "string" },
        },
        required: ["path", "old_string", "new_string"],
      },
    },
    Bash: {
      name: "Bash",
      description: "Run a shell command in the workspace cwd (bash -lc).",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string" },
          timeout_ms: { type: "number" },
        },
        required: ["command"],
      },
    },
    Glob: {
      name: "Glob",
      description: "List files under cwd matching a simple suffix/glob pattern.",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "e.g. **/*.ts or *.md" },
        },
        required: ["pattern"],
      },
    },
    Grep: {
      name: "Grep",
      description: "Search file contents under cwd for a regex pattern.",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          path: { type: "string", description: "subdir or file relative to cwd" },
          max_matches: { type: "number" },
        },
        required: ["pattern"],
      },
    },
  };

  return enabled.filter((n) => n in all).map((n) => all[n]!);
}

function walkFiles(root: string, acc: string[] = []): string[] {
  if (!existsSync(root)) return acc;
  const st = statSync(root);
  if (st.isFile()) {
    acc.push(root);
    return acc;
  }
  for (const name of readdirSync(root)) {
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    walkFiles(join(root, name), acc);
  }
  return acc;
}

function globMatch(relPath: string, pattern: string): boolean {
  // Minimal glob: **/*.ext, *.ext, exact, **/name
  const normalized = relPath.split(sep).join("/");
  if (pattern === "**/*" || pattern === "*") return true;
  if (pattern.startsWith("**/")) {
    const suffix = pattern.slice(3);
    if (suffix.startsWith("*.")) {
      return normalized.endsWith(suffix.slice(1));
    }
    return normalized.endsWith(suffix) || normalized.includes("/" + suffix);
  }
  if (pattern.startsWith("*.")) {
    return normalized.endsWith(pattern.slice(1));
  }
  return normalized === pattern || normalized.endsWith("/" + pattern);
}

export type BuiltinCaps = {
  readDefaultMaxChars?: number;
  bashMaxChars?: number;
};

export async function executeBuiltin(
  cwd: string,
  name: string,
  input: unknown,
  caps?: BuiltinCaps,
): Promise<string> {
  const readMax = caps?.readDefaultMaxChars ?? DEFAULT_READ_DEFAULT_MAX_CHARS;
  const bashMax = caps?.bashMaxChars ?? DEFAULT_BASH_MAX_CHARS;

  switch (name) {
    case "Read": {
      const path = asString(input, "path");
      const abs = assertUnderCwd(cwd, path);
      const offset = asOptionalNumber(input, "offset") ?? 1;
      const limit = asOptionalNumber(input, "limit");
      const text = readFileSync(abs, "utf8");
      const lines = text.split("\n");
      const start = Math.max(0, offset - 1);
      const slice = limit == null ? lines.slice(start) : lines.slice(start, start + limit);
      const numbered = slice.map((l, i) => `${start + i + 1}|${l}`).join("\n");
      return truncateToolResult(numbered, readMax);
    }
    case "Write": {
      const path = asString(input, "path");
      const content = asString(input, "content");
      const abs = assertUnderCwd(cwd, path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf8");
      return `Wrote ${path} (${content.length} bytes)`;
    }
    case "Edit": {
      const path = asString(input, "path");
      const oldString = asString(input, "old_string");
      const newString = asString(input, "new_string");
      const abs = assertUnderCwd(cwd, path);
      const text = readFileSync(abs, "utf8");
      if (!text.includes(oldString)) {
        throw new Error("old_string not found in file");
      }
      const updated = text.replace(oldString, newString);
      writeFileSync(abs, updated, "utf8");
      return `Edited ${path}`;
    }
    case "Bash": {
      const command = asString(input, "command");
      const timeout = asOptionalNumber(input, "timeout_ms") ?? 60_000;
      const maxBuffer = Math.min(2 * 1024 * 1024, Math.max(bashMax * 4, 64_000));
      try {
        const { stdout, stderr } = await execFileAsync("bash", ["-lc", command], {
          cwd,
          timeout,
          maxBuffer,
          env: process.env,
        });
        const out = [stdout, stderr].filter(Boolean).join("\n").trim();
        const text = out.length > 0 ? out : "(no output)";
        return truncateToolResult(text, bashMax);
      } catch (e) {
        const err = e as {
          stdout?: string;
          stderr?: string;
          message?: string;
          code?: number;
        };
        const parts = [
          err.stdout,
          err.stderr,
          err.message ?? String(e),
          err.code != null ? `exit ${err.code}` : undefined,
        ].filter(Boolean);
        throw new Error(truncateToolResult(parts.join("\n"), bashMax));
      }
    }
    case "Glob": {
      const pattern = asString(input, "pattern");
      const files = walkFiles(cwd)
        .map((abs) => relative(cwd, abs).split(sep).join("/"))
        .filter((rel) => globMatch(rel, pattern))
        .sort();
      return files.length ? files.join("\n") : "(no matches)";
    }
    case "Grep": {
      const pattern = asString(input, "pattern");
      const sub = asOptionalString(input, "path") ?? ".";
      const max = asOptionalNumber(input, "max_matches") ?? 50;
      const re = new RegExp(pattern);
      const root = assertUnderCwd(cwd, sub);
      const files = walkFiles(root);
      const hits: string[] = [];
      for (const abs of files) {
        let text: string;
        try {
          text = readFileSync(abs, "utf8");
        } catch {
          continue;
        }
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (re.test(line)) {
            hits.push(`${relative(cwd, abs)}:${i + 1}:${line}`);
            if (hits.length >= max) {
              return hits.join("\n");
            }
          }
        }
      }
      return hits.length ? hits.join("\n") : "(no matches)";
    }
    default:
      throw new Error(`Unknown builtin tool: ${name}`);
  }
}
