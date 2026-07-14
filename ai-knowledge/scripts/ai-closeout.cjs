#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

function run(command, args) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
}

console.log("Core closeout: ai-knowledge/core/LOAD-END.md");
console.log("Compatibility closeout prompt: ai-knowledge/prompt/任务收尾-Review并沉淀.md");
console.log("Running code review gate before final review.");

const review = run("node", ["ai-knowledge/scripts/code-review.cjs"]);
if (review.status !== 0) {
  process.exit(review.status || 1);
}

console.log("Running minimum knowledge gate before final review.");

const result = run("node", ["ai-knowledge/scripts/knowledge-check.cjs"]);
if (result.status !== 0) {
  process.exit(result.status || 1);
}

const state = run("node", ["ai-knowledge/scripts/task-state.cjs", "close", "--summary", "Closeout gates passed."]);
if (state.status !== 0) {
  process.exit(state.status || 1);
}

console.log("Code review and knowledge gate passed. Agent must now run any additional ai-workflow.yaml gates required by the changed surface.");
