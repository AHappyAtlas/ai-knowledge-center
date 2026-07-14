#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);
const asJson = args.includes("--json");

function argValue(name, fallback = "") {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] || fallback;
  const inline = args.find(arg => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

function usage() {
  console.log(`Usage:
  node ai-knowledge/scripts/log-summary.cjs --file <path> [--lines 100] [--pattern <regex>] [--json]

Summarizes the newest slice of a log or command-output file. Keep full logs on disk; feed Agents this bounded summary first.`);
}

const fileArg = argValue("--file");
if (args.includes("--help") || args.includes("-h") || !fileArg) {
  usage();
  process.exit(fileArg ? 0 : 1);
}

const requestedLines = Number(argValue("--lines", "100"));
const lineLimit = Number.isFinite(requestedLines) && requestedLines > 0 ? Math.min(Math.floor(requestedLines), 1000) : 100;
const patternText = argValue("--pattern");
const pattern = patternText ? new RegExp(patternText, "i") : /\b(error|fail(?:ed|ure)?|exception|panic|fatal|timeout|denied|eaddrinuse|enoent|ts\d{4}|traceback)\b/i;
const absolute = path.resolve(repoRoot, fileArg);

if (!absolute.startsWith(repoRoot + path.sep) && absolute !== repoRoot) {
  console.error(`Refusing to read outside repository: ${fileArg}`);
  process.exit(1);
}
if (!fs.existsSync(absolute)) {
  console.error(`Log file not found: ${fileArg}`);
  process.exit(1);
}

const stat = fs.statSync(absolute);
const maxBytes = 2 * 1024 * 1024;
const start = Math.max(0, stat.size - maxBytes);
const buffer = Buffer.alloc(stat.size - start);
const fd = fs.openSync(absolute, "r");
try {
  fs.readSync(fd, buffer, 0, buffer.length, start);
} finally {
  fs.closeSync(fd);
}

const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
const allLines = text.split(/\r?\n/);
const recentLines = allLines.slice(-lineLimit);
const matches = [];
allLines.forEach((line, index) => {
  if (pattern.test(line)) {
    matches.push({ line: start === 0 ? index + 1 : null, text: line.slice(0, 500) });
  }
});

const newestMatches = matches.slice(-20);
const summary = {
  file: path.relative(repoRoot, absolute).replaceAll(path.sep, "/"),
  bytes: stat.size,
  scannedBytes: buffer.length,
  truncatedFromStart: start > 0,
  recentLineCount: recentLines.length,
  pattern: patternText || pattern.source,
  matchCountInScannedSlice: matches.length,
  newestMatches,
  recentLines,
};

if (asJson) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`Log summary: ${summary.file}`);
  console.log(`Bytes: ${summary.bytes}; scanned: ${summary.scannedBytes}; recent lines: ${summary.recentLineCount}; matches: ${summary.matchCountInScannedSlice}`);
  if (summary.truncatedFromStart) console.log("Note: scanned newest 2 MiB only.");
  if (newestMatches.length) {
    console.log("Newest matches:");
    for (const match of newestMatches) console.log(`- ${match.text}`);
  }
  console.log("Recent lines:");
  for (const line of recentLines) console.log(line);
}
