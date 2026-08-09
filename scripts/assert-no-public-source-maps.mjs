#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PUBLIC_BUNDLE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".css"]);

export function findPublicSourceMapArtifacts(publicRoots) {
  const artifacts = [];
  const roots = Array.isArray(publicRoots) ? publicRoots : [publicRoots];

  for (const publicRoot of roots) {
    if (!fs.existsSync(publicRoot)) {
      throw new Error(`Public output does not exist: ${publicRoot}`);
    }

    const pending = [publicRoot];
    while (pending.length > 0) {
      const directory = pending.pop();
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const filePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          pending.push(filePath);
          continue;
        }

        if (entry.name.endsWith(".map")) {
          artifacts.push(filePath);
          continue;
        }

        if (!PUBLIC_BUNDLE_EXTENSIONS.has(path.extname(entry.name))) continue;
        if (fs.readFileSync(filePath, "utf8").includes("sourceMappingURL=")) {
          artifacts.push(filePath);
        }
      }
    }
  }

  return artifacts.sort();
}

export function assertNoPublicSourceMaps(publicRoots) {
  const artifacts = findPublicSourceMapArtifacts(publicRoots);
  if (artifacts.length === 0) return;

  const relativeArtifacts = artifacts.map((filePath) =>
    path.relative(process.cwd(), filePath),
  );
  throw new Error(
    `Public source-map artifacts remain after the Sentry build step:\n${relativeArtifacts.join("\n")}`,
  );
}

function run() {
  const publicRoots =
    process.argv.length > 2
      ? process.argv.slice(2).map((root) => path.resolve(root))
      : [
          path.resolve(process.cwd(), ".next", "static"),
          path.resolve(process.cwd(), "public"),
        ];

  try {
    assertNoPublicSourceMaps(publicRoots);
    console.log("Public source-map guard: PASS");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Public source-map guard: FAIL\n${message}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) run();
