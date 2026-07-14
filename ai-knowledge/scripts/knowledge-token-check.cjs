#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const knowledgeRoot = path.join(repoRoot, "ai-knowledge");
const ignoredSegments = new Set([".git", "node_modules", "dist", "build", "coverage", ".cache"]);
const textExtensions = new Set([".md", ".mdx", ".txt", ".json", ".yaml", ".yml"]);
const fixedEntrypoints = [
  "AGENTS.md",
  "ai-workflow.yaml",
  "ai-knowledge/LOAD.md",
  "ai-knowledge/ai/LOAD.md",
  "ai-knowledge/skills/SKILL_INDEX.md",
];
const largeFileTokenWarning = 2500;
const fixedEntrypointWarning = 9000;

function estimateTokens(text) {
  const value = String(text || "");
  if (!value) return 0;

  const cjk = (value.match(/[\u3400-\u9fff]/g) || []).length;
  const withoutCjk = value.replace(/[\u3400-\u9fff]/g, " ");
  const words = withoutCjk
    .split(/[\s,.;:!?()[\]{}"'`<>/\\|+=*_~]+/)
    .filter(Boolean).length;
  const symbols = (withoutCjk.match(/[^\sA-Za-z0-9_-]/g) || []).length;

  return Math.max(1, Math.ceil(cjk * 1.1 + words * 1.3 + symbols * 0.5));
}

function toRepoPath(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function shouldSkip(filePath) {
  return path
    .relative(repoRoot, filePath)
    .split(path.sep)
    .some(part => ignoredSegments.has(part));
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (shouldSkip(filePath)) continue;
    if (entry.isDirectory()) {
      walk(filePath, files);
      continue;
    }
    if (textExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(filePath);
    }
  }
  return files;
}

function readStats(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return {
    path: toRepoPath(filePath),
    bytes: Buffer.byteLength(text),
    tokens: estimateTokens(text),
  };
}

const fixedStats = fixedEntrypoints
  .map(relPath => path.join(repoRoot, relPath))
  .filter(filePath => fs.existsSync(filePath))
  .map(readStats);
const knowledgeStats = walk(knowledgeRoot).map(readStats);
const fixedTokens = fixedStats.reduce((sum, item) => sum + item.tokens, 0);
const largeFiles = knowledgeStats
  .filter(item => item.tokens >= largeFileTokenWarning)
  .sort((a, b) => b.tokens - a.tokens)
  .slice(0, 5);
const newestTriggerMtime = fixedStats
  .map(item => path.join(repoRoot, item.path))
  .reduce((newest, filePath) => Math.max(newest, fs.statSync(filePath).mtimeMs), 0);
const statePath = path.join(knowledgeRoot, ".token-check-state.json");

if (process.env.AIKC_TOKEN_CHECK_REASON) {
  console.log(`Knowledge token check reason: ${process.env.AIKC_TOKEN_CHECK_REASON}.`);
}
console.log(`Knowledge token check: fixed start ~= ${fixedTokens} tokens across ${fixedStats.length} files.`);
console.log("Token optimization: load compact entrypoints first, then only the matched SKILL.md and referenced files.");
if (fixedTokens > fixedEntrypointWarning) {
  console.log(`Token warning: fixed startup context exceeds ${fixedEntrypointWarning} estimated tokens; trim AGENTS.md or entrypoints.`);
}
if (largeFiles.length) {
  console.log("Largest knowledge files to keep out of default context:");
  for (const item of largeFiles) {
    console.log(`- ${item.path} (~${item.tokens} tokens)`);
  }
}

fs.writeFileSync(
  statePath,
  `${JSON.stringify({ checkedAt: new Date().toISOString(), checkedAtMtimeMs: newestTriggerMtime }, null, 2)}\n`,
);
