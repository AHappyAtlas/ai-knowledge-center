#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);
const asJson = args.includes("--json");

function exists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return {
    status: result.status ?? 1,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function check(id, label, ok, evidence, severity = "error") {
  return { id, label, status: ok ? "pass" : severity, evidence };
}

function serverState() {
  const stateRoot = path.resolve(process.env.AIKC_HOME || path.join(os.homedir(), ".ai-knowledge-center"));
  const pidPath = path.join(stateRoot, "server.pid.json");
  if (!fs.existsSync(pidPath)) return { exists: false, running: false };
  try {
    const parsed = JSON.parse(fs.readFileSync(pidPath, "utf8").replace(/^\uFEFF/, ""));
    if (typeof parsed.pid !== "number") return { exists: true, running: false, invalid: true };
    try {
      process.kill(parsed.pid, 0);
      return { exists: true, running: true, pid: parsed.pid, port: parsed.port ?? null };
    } catch {
      return { exists: true, running: false, pid: parsed.pid, port: parsed.port ?? null };
    }
  } catch {
    return { exists: true, running: false, invalid: true };
  }
}

function unresolvedUpgradeCandidates() {
  const files = [];
  const stack = [repoRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "dist") continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && entry.name.endsWith(".aikc-upgrade.md")) files.push(path.relative(repoRoot, absolute).replace(/\\/g, "/"));
    }
  }
  return files;
}

const requiredFiles = [
  "AGENTS.md",
  "ai-workflow.yaml",
  "ai-knowledge/LOAD.md",
  "ai-knowledge/core/LOAD.md",
  "ai-knowledge/core/LOAD-END.md",
  "ai-knowledge/core/bounded-loop-policy.md",
  "ai-knowledge/core/human-readable-knowledge-policy.md",
  "ai-knowledge/scripts/knowledge-check.cjs",
  "ai-knowledge/scripts/human-docs-check.cjs",
  "ai-knowledge/skills/SKILL_INDEX.md",
  "ai-knowledge/human/README.md",
];

const missingRequired = requiredFiles.filter(relPath => !exists(relPath));
const knowledge = run("node", ["ai-knowledge/scripts/knowledge-check.cjs"]);
const humanDocs = run("node", ["ai-knowledge/scripts/human-docs-check.cjs"]);
const tokenBudget = exists("ai-knowledge/scripts/token-budget-check.cjs") ? run("node", ["ai-knowledge/scripts/token-budget-check.cjs"]) : { status: 1, stdout: "", stderr: "missing" };
const npmList = run("npm", ["list", "-g", "ai-knowledge-center", "--depth=0", "--json"]);
const server = serverState();
const upgradeCandidates = unresolvedUpgradeCandidates();

const checks = [
  check("required-files", "Required workflow files", missingRequired.length === 0, missingRequired.length === 0 ? "all present" : missingRequired.join(", ")),
  check("knowledge-check", "Knowledge gate", knowledge.status === 0, knowledge.status === 0 ? knowledge.stdout : knowledge.stderr || knowledge.stdout),
  check("human-docs-check", "Human docs companion gate", humanDocs.status === 0, humanDocs.status === 0 ? humanDocs.stdout : humanDocs.stderr || humanDocs.stdout),
  check("token-budget-check", "Token budget regression gate", tokenBudget.status === 0, tokenBudget.status === 0 ? tokenBudget.stdout : tokenBudget.stderr || tokenBudget.stdout),
  check("upgrade-candidates", "Unresolved AIKC upgrade candidates", upgradeCandidates.length === 0, upgradeCandidates.length === 0 ? "none" : upgradeCandidates.join(", "), "warn"),
  check("global-cli", "Global AIKC package", npmList.status === 0, npmList.status === 0 ? "installed" : npmList.stderr || npmList.stdout, "warn"),
  check("web-server", "Background Web server", !server.exists || server.running, server.exists ? JSON.stringify(server) : "no pid file", "warn"),
];

const summary = {
  status: checks.some(item => item.status === "error") ? "fail" : checks.some(item => item.status === "warn") ? "warn" : "pass",
  root: repoRoot,
  checks,
};

if (asJson) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`AIKC doctor: ${summary.status}`);
  for (const item of checks) {
    console.log(`[${item.status}] ${item.id}: ${item.evidence}`);
  }
}

if (summary.status === "fail") process.exit(1);
