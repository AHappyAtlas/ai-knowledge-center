#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const tokenTriggerFiles = [
  "AGENTS.md",
  "ai-workflow.yaml",
  "ai-knowledge/LOAD.md",
  "ai-knowledge/core",
  "ai-knowledge/ai/LOAD.md",
  "ai-knowledge/skills/SKILL_INDEX.md",
];
const required = [
  "ai-knowledge/LOAD.md",
  "ai-knowledge/core/LOAD.md",
  "ai-knowledge/core/LOAD-END.md",
  "ai-knowledge/core/knowledge-capture-policy.md",
  "ai-knowledge/ai/LOAD.md",
  "ai-knowledge/skills/SKILL_INDEX.md",
  "AGENTS.md",
  "ai-workflow.yaml",
];

function readTask(argv) {
  const index = argv.indexOf("--task");
  if (index >= 0) return argv[index + 1] || "";
  const inline = argv.find(arg => arg.startsWith("--task="));
  if (inline) return inline.slice("--task=".length);
  return argv.join(" ").trim();
}

function shouldRunTokenCheck(task) {
  const normalized = task.toLowerCase();
  const explicitTokenTask = [
    "token",
    "上下文",
    "context",
    "知识库",
    "knowledge",
    "skill",
    "路由",
    "routing",
    "load.md",
    "agents.md",
  ].some(keyword => normalized.includes(keyword));
  if (explicitTokenTask) {
    return { run: true, reason: "task mentions knowledge routing or token/context cost" };
  }

  const newestTriggerMtime = tokenTriggerFiles
    .map(relPath => path.join(repoRoot, relPath))
    .filter(filePath => fs.existsSync(filePath))
    .reduce((newest, filePath) => Math.max(newest, fs.statSync(filePath).mtimeMs), 0);
  const statePath = path.join(repoRoot, "ai-knowledge", ".token-check-state.json");
  if (!fs.existsSync(statePath)) {
    return { run: true, reason: "no previous token check state" };
  }

  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    if ((state.checkedAtMtimeMs || 0) < newestTriggerMtime) {
      return { run: true, reason: "knowledge entrypoint changed since last token check" };
    }
  } catch {
    return { run: true, reason: "token check state is unreadable" };
  }

  return { run: false, reason: "knowledge entrypoints unchanged and task is not token/routing-related" };
}

const missing = required.filter(relPath => !fs.existsSync(path.join(repoRoot, relPath)));
if (missing.length) {
  console.error(`Missing AI workflow files: ${missing.join(", ")}`);
  process.exit(1);
}

const task = readTask(process.argv.slice(2)) || "(task not provided)";

const taskState = spawnSync("node", ["ai-knowledge/scripts/task-state.cjs", "start", "--task", task], {
  cwd: repoRoot,
  shell: process.platform === "win32",
  encoding: "utf8",
});
if (taskState.status !== 0) {
  console.error(taskState.stderr || taskState.stdout || "Failed to initialize AIKC task state.");
  process.exit(taskState.status || 1);
}

const tokenCheck = shouldRunTokenCheck(task);
if (tokenCheck.run) {
  process.env.AIKC_TOKEN_CHECK_REASON = tokenCheck.reason;
  require("./knowledge-token-check.cjs");
} else {
  console.log(`Knowledge token check skipped: ${tokenCheck.reason}.`);
}
const pack = spawnSync("node", ["ai-knowledge/scripts/context-pack.cjs", "--summary", "--task", task], {
  cwd: repoRoot,
  shell: process.platform === "win32",
  encoding: "utf8",
});
if (pack.status === 0 && pack.stdout.trim()) {
  console.log("Context pack summary:");
  console.log(pack.stdout.trim());
} else if (pack.status !== 0) {
  console.log(`Context pack summary unavailable: ${(pack.stderr || pack.stdout || "").trim()}`);
}
console.log("AI workflow route loaded.");
console.log(`Task: ${task}`);
console.log("Entrypoints: ai-knowledge/LOAD.md, ai-knowledge/core/LOAD.md, ai-knowledge/ai/LOAD.md");
console.log("Skill index: ai-knowledge/skills/SKILL_INDEX.md");
console.log("Next: Agent reads matching SKILL.md, edits files as needed, then runs ai-knowledge/scripts/ai-closeout.cjs and applicable gates.");
