#!/usr/bin/env node

const fs = require("node:fs");
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
  node ai-knowledge/scripts/run-bounded.cjs -- <command> [args...]
  node ai-knowledge/scripts/run-bounded.cjs --shell -- <command string...>
  node ai-knowledge/scripts/run-bounded.cjs --json --max-chars 12000 -- <command> [args...]

Runs a command, stores full output under .aikc/runs, and prints only a bounded summary.`);
}

if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

const separator = args.indexOf("--");
const commandParts = separator >= 0 ? args.slice(separator + 1) : [];
if (commandParts.length === 0) {
  usage();
  process.exit(1);
}

const asJson = args.includes("--json");
const useShell = args.includes("--shell");
const maxCharsRaw = Number(argValue("--max-chars", "12000"));
const maxChars = Number.isFinite(maxCharsRaw) && maxCharsRaw > 0 ? Math.floor(maxCharsRaw) : 12000;
const maxLinesRaw = Number(argValue("--lines", "120"));
const maxLines = Number.isFinite(maxLinesRaw) && maxLinesRaw > 0 ? Math.floor(maxLinesRaw) : 120;
const command = commandParts[0];
const commandArgs = commandParts.slice(1);
const startedAt = new Date();
const runsDir = path.join(repoRoot, ".aikc", "runs");
fs.mkdirSync(runsDir, { recursive: true });

const result = spawnSync(command, commandArgs, {
  cwd: repoRoot,
  encoding: "utf8",
  shell: useShell,
  maxBuffer: 64 * 1024 * 1024,
});

const endedAt = new Date();
const stdout = result.stdout || "";
const stderr = result.stderr || "";
const output = `${stdout}${stderr}`;
const safeName = commandParts.join("_").replace(/[^a-zA-Z0-9_.-]+/g, "_").slice(0, 80) || "command";
const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
const logPath = path.join(runsDir, `${stamp}-${safeName}.log`);
fs.writeFileSync(logPath, output, "utf8");

function recentText(text) {
  const lines = text.split(/\r?\n/).slice(-maxLines).join("\n");
  if (lines.length <= maxChars) return lines;
  return lines.slice(Math.max(0, lines.length - maxChars));
}

const errorPattern = /\b(error|fail(?:ed|ure)?|exception|panic|fatal|timeout|denied|eaddrinuse|enoent|ts\d{4}|traceback)\b/i;
const newestMatches = output
  .split(/\r?\n/)
  .filter(line => errorPattern.test(line))
  .slice(-20)
  .map(line => line.slice(0, 500));

const summary = {
  command: commandParts.join(" "),
  status: result.status ?? 1,
  signal: result.signal || null,
  startedAt: startedAt.toISOString(),
  endedAt: endedAt.toISOString(),
  durationMs: endedAt.getTime() - startedAt.getTime(),
  outputBytes: Buffer.byteLength(output),
  fullLogPath: path.relative(repoRoot, logPath).replaceAll(path.sep, "/"),
  truncated: output.length > maxChars,
  newestMatches,
  recentOutput: recentText(output),
};

if (asJson) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`Command: ${summary.command}`);
  console.log(`Status: ${summary.status}; durationMs: ${summary.durationMs}; outputBytes: ${summary.outputBytes}`);
  console.log(`Full log: ${summary.fullLogPath}`);
  if (newestMatches.length) {
    console.log("Newest error-like lines:");
    for (const line of newestMatches) console.log(`- ${line}`);
  }
  console.log("Recent output:");
  console.log(summary.recentOutput);
}

process.exit(summary.status);
