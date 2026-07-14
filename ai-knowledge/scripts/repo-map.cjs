#!/usr/bin/env node

const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const write = args.includes("--write");

function argValue(name, fallback = "") {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] || fallback;
  const inline = args.find(arg => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

function usage() {
  console.log(`Usage:
  node ai-knowledge/scripts/repo-map.cjs [--json] [--write] [--query "<task>"]

Builds a compact file/symbol/import map for token-efficient context selection.`);
}

if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

function loadIgnorePatterns() {
  const defaults = ["node_modules/**", "dist/**", ".git/**", ".aikc/runs/**", ".aikc/index/**", "*.log", "*.aikc-upgrade.md"];
  const ignorePath = path.join(repoRoot, ".aikcignore");
  if (!fs.existsSync(ignorePath)) return defaults;
  const lines = fs.readFileSync(ignorePath, "utf8").split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));
  return [...defaults, ...lines];
}

function matchPattern(relPath, pattern) {
  const normalized = relPath.replaceAll("\\", "/");
  const placeholder = "\u0000";
  const escaped = pattern
    .replaceAll("\\", "/")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**", placeholder)
    .replaceAll("*", "[^/]*");
  return new RegExp(`^${escaped.replaceAll(placeholder, ".*")}$`).test(normalized);
}

const ignorePatterns = loadIgnorePatterns();
function ignored(relPath) {
  return ignorePatterns.some(pattern => matchPattern(relPath, pattern) || matchPattern(`${relPath}/`, pattern));
}

const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs", ".json", ".md", ".yaml", ".yml"]);
function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    const relPath = path.relative(repoRoot, absolute).replaceAll(path.sep, "/");
    if (ignored(relPath)) continue;
    if (entry.isDirectory()) {
      walk(absolute, files);
    } else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(relPath);
    }
  }
  return files;
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function extractSymbols(text, ext) {
  if (ext === ".md") {
    return [...text.matchAll(/^#{1,3}\s+(.+)$/gm)].map(match => match[1].trim()).slice(0, 20);
  }
  return [
    ...text.matchAll(/\bexport\s+(?:async\s+)?(?:function|class|const|let|var|type|interface)\s+([A-Za-z0-9_$]+)/g),
    ...text.matchAll(/\bfunction\s+([A-Za-z0-9_$]+)\s*\(/g),
  ].map(match => match[1]).filter(Boolean).slice(0, 30);
}

function extractImports(text) {
  const imports = [
    ...text.matchAll(/\bimport\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g),
    ...text.matchAll(/\brequire\(['"]([^'"]+)['"]\)/g),
  ].map(match => match[1]).filter(Boolean);
  return [...new Set(imports)].slice(0, 30);
}

const query = argValue("--query");
const queryTerms = query.toLowerCase().split(/[^a-z0-9\u4e00-\u9fff._-]+/).filter(term => term.length >= 2);
const files = walk(repoRoot)
  .map(relPath => {
    const absolute = path.join(repoRoot, relPath);
    const text = fs.readFileSync(absolute, "utf8");
    const ext = path.extname(relPath).toLowerCase();
    const symbols = extractSymbols(text, ext);
    const imports = extractImports(text);
    const haystack = `${relPath} ${symbols.join(" ")} ${imports.join(" ")}`.toLowerCase();
    const score = queryTerms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    const stat = fs.statSync(absolute);
    return {
      path: relPath,
      ext,
      bytes: Buffer.byteLength(text),
      estimatedTokens: estimateTokens(text),
      hash: crypto.createHash("sha256").update(text).digest("hex").slice(0, 16),
      mtimeMs: Math.round(stat.mtimeMs),
      symbols,
      imports,
      score,
    };
  })
  .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));

const map = {
  generatedAt: new Date().toISOString(),
  root: repoRoot,
  query,
  fileCount: files.length,
  totalEstimatedTokens: files.reduce((sum, file) => sum + file.estimatedTokens, 0),
  files,
  recommendedFiles: files.filter(file => file.score > 0).slice(0, 12).map(file => file.path),
};

if (write) {
  const indexDir = path.join(repoRoot, ".aikc", "index");
  fs.mkdirSync(indexDir, { recursive: true });
  fs.writeFileSync(path.join(indexDir, "repo-map.json"), `${JSON.stringify(map, null, 2)}\n`, "utf8");
}

if (asJson) {
  console.log(JSON.stringify(map, null, 2));
} else {
  console.log(`Repo map: ${map.fileCount} files, ~${map.totalEstimatedTokens} tokens if read fully.`);
  if (map.recommendedFiles.length) {
    console.log("Recommended files:");
    for (const file of map.recommendedFiles) console.log(`- ${file}`);
  }
  if (write) console.log("Wrote .aikc/index/repo-map.json");
}
