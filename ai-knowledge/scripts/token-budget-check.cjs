#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);
const asJson = args.includes("--json");

function argValue(name, fallback = "") {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] || fallback;
  const inline = args.find(arg => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

function run(commandArgs) {
  const result = spawnSync(commandArgs[0], commandArgs.slice(1), {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout || ""}${result.stderr || ""}`,
  };
}

function check(id, ok, evidence, severity = "error") {
  return { id, status: ok ? "pass" : severity, evidence };
}

const maxSummaryTokens = Number(argValue("--max-summary-tokens", "4000"));
const maxRecommendedTokens = Number(argValue("--max-recommended-tokens", "20000"));
const maxRunOutputChars = Number(argValue("--max-run-output-chars", "12000"));

const context = run(["node", "ai-knowledge/scripts/context-pack.cjs", "--summary", "--task", "token budget regression"]);
let contextJson = null;
try {
  contextJson = JSON.parse(context.output);
} catch {
  // Report below.
}

const repoMap = run(["node", "ai-knowledge/scripts/repo-map.cjs", "--json", "--query", "token workflow"]);
let repoMapJson = null;
try {
  repoMapJson = JSON.parse(repoMap.output);
} catch {
  // Report below.
}

const runBounded = run(["node", "ai-knowledge/scripts/run-bounded.cjs", "--json", "--max-chars", String(maxRunOutputChars), "--", "node", "-e", "console.log('bounded output smoke')"]);
let runBoundedJson = null;
try {
  runBoundedJson = JSON.parse(runBounded.output);
} catch {
  // Report below.
}

const checks = [
  check("context-pack-json", context.status === 0 && contextJson !== null, contextJson ? "valid JSON" : context.output.slice(0, 500)),
  check("context-summary-budget", contextJson && Math.ceil(JSON.stringify(contextJson).length / 4) <= maxSummaryTokens, contextJson ? `~${Math.ceil(JSON.stringify(contextJson).length / 4)} tokens` : "no context JSON"),
  check("recommended-context-budget", contextJson && contextJson.budget && contextJson.budget.totalEstimatedTokens <= maxRecommendedTokens, contextJson?.budget ? `~${contextJson.budget.totalEstimatedTokens} tokens` : "missing budget"),
  check("repo-map-json", repoMap.status === 0 && repoMapJson !== null, repoMapJson ? `${repoMapJson.fileCount} files indexed` : repoMap.output.slice(0, 500)),
  check("run-bounded-json", runBounded.status === 0 && runBoundedJson !== null, runBoundedJson ? runBoundedJson.fullLogPath : runBounded.output.slice(0, 500)),
  check("run-bounded-output-cap", runBoundedJson && runBoundedJson.recentOutput.length <= maxRunOutputChars, runBoundedJson ? `${runBoundedJson.recentOutput.length} chars` : "no run-bounded JSON"),
];

const summary = {
  status: checks.some(item => item.status === "error") ? "fail" : checks.some(item => item.status === "warn") ? "warn" : "pass",
  limits: { maxSummaryTokens, maxRecommendedTokens, maxRunOutputChars },
  checks,
};

if (asJson) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`Token budget check: ${summary.status}`);
  for (const item of checks) console.log(`[${item.status}] ${item.id}: ${item.evidence}`);
}

if (summary.status === "fail") process.exit(1);
