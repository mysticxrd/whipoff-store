import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";

const scriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "scripts",
  "assert-no-public-source-maps.mjs",
);
const temporaryRoots: string[] = [];

function makePublicRoots() {
  const root = mkdtempSync(path.join(tmpdir(), "whipoff-source-map-"));
  temporaryRoots.push(root);
  const staticRoot = path.join(root, ".next", "static");
  const publicRoot = path.join(root, "public");
  mkdirSync(staticRoot, { recursive: true });
  mkdirSync(publicRoot);
  return { publicRoot, root, staticRoot };
}

function runGuard(...roots: string[]) {
  return spawnSync(process.execPath, [scriptPath, ...roots], {
    encoding: "utf8",
  });
}

function runDefaultGuard(root: string) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("public source-map build guard", () => {
  it("passes clean public bundles", () => {
    const { publicRoot, root, staticRoot } = makePublicRoots();
    mkdirSync(path.join(staticRoot, "chunks"));
    writeFileSync(
      path.join(staticRoot, "chunks", "app.js"),
      "console.log('ready');",
    );
    writeFileSync(path.join(publicRoot, "app.css"), "body { color: inherit; }");

    const result = runDefaultGuard(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Public source-map guard: PASS");
  });

  it("fails when a map file remains", () => {
    const { publicRoot, staticRoot } = makePublicRoots();
    writeFileSync(path.join(staticRoot, "app.js.map"), "{}");

    const result = runGuard(staticRoot, publicRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Public source-map guard: FAIL");
    expect(result.stderr).toContain("app.js.map");
  });

  it("fails when a bundle still references a source map", () => {
    const { publicRoot, staticRoot } = makePublicRoots();
    writeFileSync(
      path.join(staticRoot, "app.js"),
      "console.log('ready');\n//# sourceMappingURL=app.js.map",
    );

    const result = runGuard(staticRoot, publicRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("app.js");
  });

  it("fails when a map file remains in public", () => {
    const { publicRoot, root } = makePublicRoots();
    writeFileSync(path.join(publicRoot, "vendor.js.map"), "{}");

    const result = runDefaultGuard(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Public source-map guard: FAIL");
    expect(result.stderr).toContain("vendor.js.map");
  });

  it("fails when a public asset still references a source map", () => {
    const { publicRoot, root } = makePublicRoots();
    writeFileSync(
      path.join(publicRoot, "vendor.css"),
      "body { color: inherit; }\n/*# sourceMappingURL=vendor.css.map */",
    );

    const result = runDefaultGuard(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("vendor.css");
  });

  it("fails when a required public root is missing", () => {
    const { root, staticRoot } = makePublicRoots();
    rmSync(staticRoot, { recursive: true });

    const result = runDefaultGuard(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Public output does not exist");
  });
});
