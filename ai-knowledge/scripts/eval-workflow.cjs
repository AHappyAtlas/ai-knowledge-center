#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const evalPath = path.join(repoRoot, "ai-knowledge/evals/workflow-smoke.json");
const evalSpec = JSON.parse(fs.readFileSync(evalPath, "utf8"));

function splitCommand(command) {
  const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return parts.map(part => part.replace(/^"|"$/g, ""));
}

const results = [];

for (const testCase of evalSpec.cases || []) {
  const [command, ...args] = splitCommand(testCase.command);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  const passed = result.status === 0 && output.includes(testCase.expect);
  results.push({
    id: testCase.id,
    status: passed ? "pass" : "fail",
    command: testCase.command,
    evidence: passed ? testCase.expect : output.trim().slice(0, 500),
  });
}

const failed = results.filter(item => item.status === "fail");
console.log(JSON.stringify({ name: evalSpec.name, status: failed.length ? "fail" : "pass", results }, null, 2));
if (failed.length) process.exit(1);
