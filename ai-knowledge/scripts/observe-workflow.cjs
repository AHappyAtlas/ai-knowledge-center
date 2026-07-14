#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);

function argValue(name, fallback = "") {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] || fallback;
  const inline = args.find(arg => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

function usage() {
  console.log(`Usage:
  node ai-knowledge/scripts/observe-workflow.cjs --phase start|end --task "<task>" [--json]

Writes compact workflow metrics to project and user-level JSONL observation logs.`);
}

if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

const phase = argValue("--phase", "snapshot");
const task = argValue("--task", "");
const asJson = args.includes("--json");

function run(commandArgs) {
  const result = spawnSync(commandArgs[0], commandArgs.slice(1), {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout || ""}${result.stderr || ""}`.trim(),
  };
}

function parseJsonRun(commandArgs) {
  const result = run(commandArgs);
  if (result.status !== 0) return { ok: false, status: result.status, error: result.output.slice(0, 1000) };
  try {
    return { ok: true, status: 0, value: JSON.parse(result.output) };
  } catch {
    return { ok: false, status: 0, error: result.output.slice(0, 1000) };
  }
}

function readJsonIfExists(relPath) {
  const absolute = path.join(repoRoot, relPath);
  if (!fs.existsSync(absolute)) return null;
  try {
    return JSON.parse(fs.readFileSync(absolute, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

function packageVersion() {
  const pkg = readJsonIfExists("package.json");
  return typeof pkg?.version === "string" ? pkg.version : null;
}

function workflowId() {
  const text = fs.existsSync(path.join(repoRoot, "ai-workflow.yaml"))
    ? fs.readFileSync(path.join(repoRoot, "ai-workflow.yaml"), "utf8")
    : "";
  const id = text.match(/^id:\s*(.+)$/m)?.[1]?.trim();
  return id || path.basename(repoRoot);
}

function unresolvedUpgradeCandidates() {
  const results = [];
  const stack = [repoRoot];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "dist") continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && entry.name.endsWith(".aikc-upgrade.md")) {
        results.push(path.relative(repoRoot, absolute).replaceAll(path.sep, "/"));
      }
    }
  }
  return results;
}

function recentRunSummaries() {
  const runsDir = path.join(repoRoot, ".aikc", "runs");
  if (!fs.existsSync(runsDir)) return [];
  return fs.readdirSync(runsDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".log"))
    .map(entry => {
      const absolute = path.join(runsDir, entry.name);
      const stat = fs.statSync(absolute);
      return {
        path: path.relative(repoRoot, absolute).replaceAll(path.sep, "/"),
        bytes: stat.size,
        mtimeMs: Math.round(stat.mtimeMs),
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, 10);
}

const context = parseJsonRun(["node", "ai-knowledge/scripts/context-pack.cjs", "--summary", "--task", task || "workflow observation"]);
const tokenBudget = parseJsonRun(["node", "ai-knowledge/scripts/token-budget-check.cjs", "--json"]);
const doctor = parseJsonRun(["node", "ai-knowledge/scripts/doctor.cjs", "--json"]);
const taskState = parseJsonRun(["node", "ai-knowledge/scripts/task-state.cjs", "status", "--json"]);
const repoMap = readJsonIfExists(".aikc/index/repo-map.json");
const observation = {
  schemaVersion: 1,
  observedAt: new Date().toISOString(),
  phase,
  task,
  project: {
    id: workflowId(),
    root: repoRoot,
    packageVersion: packageVersion(),
  },
  contextPack: context.ok ? {
    budget: context.value.budget,
    stablePrefixHash: context.value.stablePrefixHash,
    recommendedFileCount: Array.isArray(context.value.recommendedFiles) ? context.value.recommendedFiles.length : 0,
    deferredCount: context.value.deferredCount ?? 0,
    warningCount: Array.isArray(context.value.warnings) ? context.value.warnings.length : 0,
  } : { error: context.error, status: context.status },
  tokenBudget: tokenBudget.ok ? {
    status: tokenBudget.value.status,
    limits: tokenBudget.value.limits,
    checks: Array.isArray(tokenBudget.value.checks)
      ? tokenBudget.value.checks.map(item => ({ id: item.id, status: item.status, evidence: item.evidence }))
      : [],
  } : { error: tokenBudget.error, status: tokenBudget.status },
  doctor: doctor.ok ? {
    status: doctor.value.status,
    checks: Array.isArray(doctor.value.checks)
      ? doctor.value.checks.map(item => ({ id: item.id, status: item.status }))
      : [],
  } : { error: doctor.error, status: doctor.status },
  taskState: taskState.ok ? {
    status: taskState.value.status,
    phase: taskState.value.phase,
    checkpointCount: Array.isArray(taskState.value.checkpoints) ? taskState.value.checkpoints.length : 0,
    pendingGateCount: Array.isArray(taskState.value.pendingGates) ? taskState.value.pendingGates.length : 0,
  } : { error: taskState.error, status: taskState.status },
  repoMap: repoMap ? {
    generatedAt: repoMap.generatedAt,
    fileCount: repoMap.fileCount,
    totalEstimatedTokens: repoMap.totalEstimatedTokens,
    recommendedFileCount: Array.isArray(repoMap.recommendedFiles) ? repoMap.recommendedFiles.length : 0,
  } : null,
  runBounded: {
    recentRuns: recentRunSummaries(),
  },
  upgradeCandidates: unresolvedUpgradeCandidates(),
};

function appendJsonl(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

const projectLog = path.join(repoRoot, ".aikc", "observability", "workflow-observations.jsonl");
const userLog = path.join(
  path.resolve(process.env.AIKC_HOME || path.join(os.homedir(), ".ai-knowledge-center")),
  "observations",
  "workflow-observations.jsonl"
);
appendJsonl(projectLog, observation);
appendJsonl(userLog, observation);

if (asJson) {
  console.log(JSON.stringify({ status: "ok", projectLog: path.relative(repoRoot, projectLog).replaceAll(path.sep, "/"), userLog, observation }, null, 2));
} else {
  console.log(`Workflow observation written: ${path.relative(repoRoot, projectLog).replaceAll(path.sep, "/")}`);
  console.log(`User observation log: ${userLog}`);
  console.log(`Context tokens: ${observation.contextPack.budget?.totalEstimatedTokens ?? "unknown"}; token budget: ${observation.tokenBudget.status ?? "unknown"}; doctor: ${observation.doctor.status ?? "unknown"}`);
}

