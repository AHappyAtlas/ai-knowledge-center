#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const ignore = require("ignore");

const repoRoot = path.resolve(__dirname, "..", "..");
const textExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8").replace(/^\uFEFF/, "");
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
}

function gitFiles() {
  const inside = run("git", ["rev-parse", "--is-inside-work-tree"]);
  if (inside.status !== 0 || inside.stdout.trim() !== "true") return null;

  const changed = run("git", ["diff", "--name-only", "--diff-filter=ACMRTUXB", "HEAD", "--"]);
  const untracked = run("git", ["ls-files", "--others", "--exclude-standard"]);
  if (changed.status !== 0 || untracked.status !== 0) return null;

  return [...changed.stdout.split(/\r?\n/), ...untracked.stdout.split(/\r?\n/)].filter(Boolean);
}

function walkFiles(root, ig, relDir = "") {
  const dir = path.join(root, relDir);
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relPath = path.join(relDir, entry.name).replace(/\\/g, "/");
    if (ig.ignores(relPath) || ig.ignores(`${relPath}/`)) continue;
    if (entry.isDirectory()) {
      files.push(...walkFiles(root, ig, relPath));
    } else if (entry.isFile()) {
      files.push(relPath);
    }
  }

  return files;
}

function fallbackFiles() {
  const ig = ignore().add(["node_modules/", "dist/", ".git/", "*.tgz"]);
  const gitignorePath = path.join(repoRoot, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    ig.add(fs.readFileSync(gitignorePath, "utf8"));
  }
  return walkFiles(repoRoot, ig);
}

function isTextFile(relPath) {
  return textExtensions.has(path.extname(relPath).toLowerCase());
}

const required = [
  "ai-knowledge/core/code-review-policy.md",
  "ai-knowledge/core/LOAD-END.md",
  "ai-workflow.yaml",
];

for (const relPath of required) {
  if (!fs.existsSync(path.join(repoRoot, relPath))) {
    fail(`Missing required code review file: ${relPath}`);
  }
}

const policy = read("ai-knowledge/core/code-review-policy.md");
if (!policy.includes("Required Review Steps") || !policy.includes("Final Response Requirement")) {
  fail("Code review policy is missing required sections.");
}

const loadEnd = read("ai-knowledge/core/LOAD-END.md");
if (!loadEnd.includes("code-review-policy.md") || !loadEnd.includes("ai-knowledge/scripts/code-review.cjs")) {
  fail("Core closeout does not require the code review policy and internal code review gate.");
}

const workflow = read("ai-workflow.yaml");
if (!workflow.includes("ai-knowledge/scripts/code-review.cjs")) {
  fail("ai-workflow.yaml does not declare the code review gate.");
}

const files = gitFiles() ?? fallbackFiles();
const unresolvedCandidates = files.filter(file => file.endsWith(".aikc-upgrade.md"));
if (unresolvedCandidates.length > 0) {
  fail(`Unresolved AIKC upgrade candidates remain:\n${unresolvedCandidates.map(file => `- ${file}`).join("\n")}`);
}

const conflictFiles = [];
for (const relPath of files.filter(isTextFile)) {
  const absolute = path.join(repoRoot, relPath);
  if (!fs.existsSync(absolute)) continue;
  const content = fs.readFileSync(absolute, "utf8");
  if (/^(<<<<<<< |=======\s*$|>>>>>>> )/m.test(content)) {
    conflictFiles.push(relPath);
  }
}

if (conflictFiles.length > 0) {
  fail(`Conflict markers found:\n${conflictFiles.map(file => `- ${file}`).join("\n")}`);
}

console.log(`code review gate ok (${files.length} files considered)`);
