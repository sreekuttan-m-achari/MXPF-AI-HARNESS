import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { executeBuiltin } from "../src/tools/builtins.js";
import { ToolRouter } from "../src/tools/router.js";

describe("builtin tools", () => {
  it("reads writes and edits under cwd", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mxpf-tools-"));
    try {
      writeFileSync(join(dir, "a.txt"), "hello world", "utf8");
      const read = await executeBuiltin(dir, "Read", { path: "a.txt" });
      assert.match(read, /hello world/);

      await executeBuiltin(dir, "Write", {
        path: "b.txt",
        content: "new",
      });
      assert.equal(readFileSync(join(dir, "b.txt"), "utf8"), "new");

      await executeBuiltin(dir, "Edit", {
        path: "a.txt",
        old_string: "world",
        new_string: "mxpf",
      });
      assert.equal(readFileSync(join(dir, "a.txt"), "utf8"), "hello mxpf");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects path escape", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mxpf-tools-"));
    try {
      await assert.rejects(
        () => executeBuiltin(dir, "Read", { path: "../secret" }),
        /escapes cwd/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("router dispatches builtins", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mxpf-tools-"));
    try {
      writeFileSync(join(dir, "x.md"), "# title", "utf8");
      const router = new ToolRouter({ cwd: dir });
      const names = router.listDefinitions().map((d) => d.name);
      assert.ok(names.includes("Read"));
      const r = await router.execute("Glob", { pattern: "*.md" });
      assert.equal(r.isError, false);
      assert.match(r.output, /x\.md/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
