#!/usr/bin/env node

const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);
const taskIndex = args.indexOf("--task");
const task = taskIndex >= 0 ? args[taskIndex + 1] || "" : args.join(" ");
const asSummary = args.includes("--summary");
const enforce = args.includes("--enforce");
const maxStableTokens = Number(argValue("--max-stable-tokens", "7000"));
const maxTaskTokens = Number(argValue("--max-task-tokens", "12000"));
const maxTotalTokens = Number(argValue("--max-total-tokens", "20000"));

function argValue(name, fallback = "") {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] || fallback;
  const inline = args.find(arg => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

function exists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function fileInfo(relPath, reason) {
  const absolute = path.join(repoRoot, relPath);
  const text = fs.readFileSync(absolute, "utf8");
  const stat = fs.statSync(absolute);
  return {
    path: relPath,
    reason,
    estimatedTokens: estimateTokens(text),
    hash: crypto.createHash("sha256").update(text).digest("hex").slice(0, 16),
    mtimeMs: Math.round(stat.mtimeMs),
  };
}

function loadIgnorePatterns() {
  const defaults = [
    "ai-knowledge/human/**",
    "ai-knowledge/references/**",
    "ai-knowledge/**/*.aikc-upgrade.md",
    ".aikc/**",
    "dist/**",
    "node_modules/**",
    "coverage/**",
    "**/*.log",
    "**/logs/**",
    "**/.vite/**",
    "**/.next/**",
    "**/.turbo/**",
  ];
  const ignorePath = path.join(repoRoot, ".aikcignore");
  if (!fs.existsSync(ignorePath)) return defaults;
  const lines = fs.readFileSync(ignorePath, "utf8")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));
  return [...new Set([...defaults, ...lines])];
}

function loadRepoMapRecommendations() {
  const mapPath = path.join(repoRoot, ".aikc", "index", "repo-map.json");
  if (!fs.existsSync(mapPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    if (!Array.isArray(parsed.files)) return [];
    const terms = task.toLowerCase().split(/[^a-z0-9\u4e00-\u9fff._-]+/).filter(term => term.length >= 2);
    return parsed.files
      .map(file => {
        const haystack = `${file.path || ""} ${(file.symbols || []).join(" ")} ${(file.imports || []).join(" ")}`.toLowerCase();
        const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
        return { path: file.path, score };
      })
      .filter(file => file.path && file.score > 0 && exists(file.path))
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
      .slice(0, 8)
      .map(file => file.path);
  } catch {
    return [];
  }
}

function sumTokens(items) {
  return items.reduce((sum, item) => sum + item.estimatedTokens, 0);
}

function applyBudget(items, budget) {
  let used = 0;
  const kept = [];
  const deferred = [];
  for (const item of items) {
    if (used + item.estimatedTokens <= budget || kept.length === 0) {
      kept.push(item);
      used += item.estimatedTokens;
    } else {
      deferred.push({ ...item, reason: `${item.reason}; deferred by context budget` });
    }
  }
  return { kept, deferred };
}

function skillRows() {
  if (!exists("ai-knowledge/skills/SKILL_INDEX.md")) return [];
  const rows = [];
  const index = read("ai-knowledge/skills/SKILL_INDEX.md");
  for (const match of index.matchAll(/\|([^|\n]+)\|([^|\n]+)\|[^`\n]*`([^`]+SKILL\.md)`/g)) {
    rows.push({
      name: match[1].trim(),
      when: match[2].trim(),
      path: match[3].trim(),
    });
  }
  return rows.filter(row => row.path.startsWith("ai-knowledge/skills/"));
}

function scoreSkill(row) {
  const haystack = `${row.name} ${row.when}`.toLowerCase();
  const terms = task.toLowerCase().split(/[^a-z0-9\u4e00-\u9fff._-]+/).filter(term => term.length >= 2);
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

const baseFiles = [
  "AGENTS.md",
  "ai-workflow.yaml",
  "ai-knowledge/LOAD.md",
  "ai-knowledge/core/LOAD.md",
  "ai-knowledge/ai/LOAD.md",
  "ai-knowledge/skills/SKILL_INDEX.md",
];

const sparseTriggers = /token|cache|context|mcp|semantic|skill|knowledge|workflow|loop|eval|doctor|人类|知识|上下文|工作流|门禁|技能/i.test(task);
const matchedSkills = skillRows()
  .map(row => ({ ...row, score: scoreSkill(row) }))
  .filter(row => row.score > 0)
  .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
  .slice(0, 3);

const rawStablePrefixFiles = baseFiles
  .filter(exists)
  .map(file => fileInfo(file, "stable workflow prefix"));

const rawTaskFiles = [
  ...matchedSkills.map(skill => skill.path),
  ...loadRepoMapRecommendations(),
  ...(sparseTriggers
    ? [
        "ai-knowledge/core/token-efficiency.md",
        "ai-knowledge/core/open-source-token-tools.md",
        "ai-knowledge/core/bounded-loop-policy.md",
        "ai-knowledge/core/human-readable-knowledge-policy.md",
      ]
    : []),
].filter((value, index, list) => list.indexOf(value) === index && exists(value))
  .map(file => fileInfo(file, sparseTriggers ? "task trigger or matched skill" : "matched skill"));

const stableBudget = applyBudget(rawStablePrefixFiles, maxStableTokens);
const taskBudget = applyBudget(rawTaskFiles, maxTaskTokens);
const stablePrefixFiles = stableBudget.kept;
const taskFiles = taskBudget.kept;
const deferredFiles = [...stableBudget.deferred, ...taskBudget.deferred];

const recommendedFiles = [...stablePrefixFiles, ...taskFiles]
  .map(item => item.path)
  .filter((value, index, list) => list.indexOf(value) === index);
const totalEstimatedTokens = sumTokens(stablePrefixFiles) + sumTokens(taskFiles);
const stablePrefixHash = crypto.createHash("sha256").update(stablePrefixFiles.map(file => `${file.path}:${file.hash}`).join("|")).digest("hex").slice(0, 16);
const avoidByDefault = loadIgnorePatterns();

const pack = {
  task,
  sparseTriggers,
  budget: {
    maxStableTokens,
    maxTaskTokens,
    maxTotalTokens,
    totalEstimatedTokens,
    warningAtTokens: 20000,
  },
  stablePrefixHash,
  stablePrefixFiles,
  taskFiles,
  deferredFiles,
  recommendedFiles,
  matchedSkills: matchedSkills.map(({ score, ...skill }) => skill),
  avoidByDefault,
  toolOutputPolicy: {
    defaultMaxChars: 12000,
    longOutputAction: "write to a file or summarize; do not paste full output into chat",
    preferredCommands: [
      "node ai-knowledge/scripts/log-summary.cjs --file <log> --lines 100 --json",
      "tail/head/select recent lines before raw full-file reads",
      "structured JSON summaries before raw logs",
    ],
  },
  logReadPolicy: {
    defaultRecentLines: 100,
    maxRecentLinesWithoutReason: 300,
    drilldown: "read raw logs only around the summarized error timestamp, pattern, or line number",
  },
  cacheGuidance: [
    "Keep stablePrefixFiles before task-specific logs, diffs, and runtime state.",
    "Reuse hash and mtimeMs to skip unchanged low-frequency context.",
    "Do not add generated timestamps or raw logs to stable prompt prefixes.",
  ],
  notes: [
    "Read recommendedFiles first.",
    "Load human-readable companions only for explanation, review, onboarding, or companion-update tasks.",
    "Use doctor/eval scripts before reading long logs or broad file trees.",
    "For watch/dev logs, ask for the newest relevant slice and summarize before expanding context.",
  ],
  warnings: [
    ...(totalEstimatedTokens > 20000 ? [`Recommended context is ~${totalEstimatedTokens} tokens; start with summaries and deferredFiles.`] : []),
    ...(totalEstimatedTokens > maxTotalTokens ? [`Recommended context exceeds maxTotalTokens=${maxTotalTokens}.`] : []),
    ...(deferredFiles.length ? ["Some files were deferred by budget; load them only if the task directly requires them."] : []),
  ],
};

if (enforce && totalEstimatedTokens > maxTotalTokens) {
  console.error(JSON.stringify({
    status: "fail",
    reason: "context budget exceeded",
    budget: pack.budget,
    deferredFiles: pack.deferredFiles.map(file => file.path),
    recommendedFiles: pack.recommendedFiles,
  }, null, 2));
  process.exit(1);
}

if (asSummary) {
  console.log(JSON.stringify({
    task: pack.task,
    sparseTriggers: pack.sparseTriggers,
    budget: pack.budget,
    stablePrefixHash: pack.stablePrefixHash,
    recommendedFiles: pack.recommendedFiles,
    deferredCount: pack.deferredFiles.length,
    matchedSkills: pack.matchedSkills,
    avoidByDefault: pack.avoidByDefault,
    toolOutputPolicy: pack.toolOutputPolicy,
    warnings: pack.warnings,
  }, null, 2));
} else {
  console.log(JSON.stringify(pack, null, 2));
}
