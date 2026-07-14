#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const stateDir = path.join(repoRoot, ".aikc", "task-state");
const currentPath = path.join(stateDir, "current.json");

function now() {
  return new Date().toISOString();
}

function readState() {
  if (!fs.existsSync(currentPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(currentPath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return { status: "corrupt", path: currentPath };
  }
}

function writeState(state) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(currentPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function argValue(args, name, fallback = "") {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] || fallback;
  const inline = args.find(arg => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

function print(value, asJson) {
  if (asJson) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  if (!value || value.status === "none") {
    console.log("AIKC task state: none");
    return;
  }
  console.log(`AIKC task state: ${value.status}`);
  console.log(`Task: ${value.task || "(not set)"}`);
  console.log(`Phase: ${value.phase || "(not set)"}`);
  console.log(`Next: ${value.next || "(not set)"}`);
  if (Array.isArray(value.pendingGates) && value.pendingGates.length) {
    console.log(`Pending gates: ${value.pendingGates.join(", ")}`);
  }
}

function usage() {
  console.log(`Usage:
  node ai-knowledge/scripts/task-state.cjs start --task "<task>"
  node ai-knowledge/scripts/task-state.cjs checkpoint --phase "<phase>" --summary "<summary>" --next "<next>" [--gate "<gate>"]
  node ai-knowledge/scripts/task-state.cjs status [--json]
  node ai-knowledge/scripts/task-state.cjs resume [--json]
  node ai-knowledge/scripts/task-state.cjs close --summary "<summary>" [--json]`);
}

const args = process.argv.slice(2);
const command = args[0] || "status";
const asJson = args.includes("--json");

if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

if (command === "start") {
  const task = argValue(args, "--task", args.slice(1).join(" ").trim() || "(task not provided)");
  const state = {
    status: "active",
    task,
    phase: "start",
    summary: "Workflow entrypoints loaded.",
    next: "Run ai-workflow-start, load matching skills, then plan and execute the task.",
    pendingGates: ["code-review", "knowledge-check"],
    checkpoints: [
      {
        at: now(),
        phase: "start",
        summary: "Task state initialized.",
        next: "Run workflow start and continue with project task.",
      },
    ],
    createdAt: now(),
    updatedAt: now(),
  };
  writeState(state);
  print(state, asJson);
  process.exit(0);
}

if (command === "checkpoint") {
  const existing = readState();
  const state = existing && existing.status !== "corrupt" ? existing : {
    status: "active",
    task: "(unknown task; recovered from checkpoint)",
    checkpoints: [],
    createdAt: now(),
  };
  const phase = argValue(args, "--phase", "checkpoint");
  const summary = argValue(args, "--summary", "Checkpoint recorded.");
  const next = argValue(args, "--next", state.next || "Continue the active task.");
  const gates = args
    .map((arg, index) => (arg === "--gate" ? args[index + 1] : null))
    .filter(Boolean);
  state.status = "active";
  state.phase = phase;
  state.summary = summary;
  state.next = next;
  if (gates.length > 0) state.pendingGates = gates;
  state.updatedAt = now();
  state.checkpoints = Array.isArray(state.checkpoints) ? state.checkpoints : [];
  state.checkpoints.push({ at: state.updatedAt, phase, summary, next, pendingGates: state.pendingGates || [] });
  state.checkpoints = state.checkpoints.slice(-20);
  writeState(state);
  print(state, asJson);
  process.exit(0);
}

if (command === "close") {
  const state = readState() || { task: "(unknown task)", checkpoints: [], createdAt: now() };
  if (state.status === "corrupt") {
    console.error(`Task state is corrupt: ${currentPath}`);
    process.exit(1);
  }
  state.status = "closed";
  state.phase = "closeout";
  state.summary = argValue(args, "--summary", "Task closed.");
  state.next = "No active task. Start a new task through ai-knowledge/LOAD.md.";
  state.pendingGates = [];
  state.updatedAt = now();
  state.closedAt = state.updatedAt;
  state.checkpoints = Array.isArray(state.checkpoints) ? state.checkpoints : [];
  state.checkpoints.push({ at: state.updatedAt, phase: "closeout", summary: state.summary, next: state.next, pendingGates: [] });
  state.checkpoints = state.checkpoints.slice(-20);
  writeState(state);
  print(state, asJson);
  process.exit(0);
}

if (command === "status") {
  const state = readState();
  print(state || { status: "none", path: currentPath }, asJson);
  process.exit(state && state.status === "corrupt" ? 1 : 0);
}

if (command === "resume") {
  const state = readState();
  if (!state) {
    const empty = {
      status: "none",
      path: currentPath,
      next: "Start a task with ai-knowledge/LOAD.md before resuming.",
    };
    print(empty, asJson);
    process.exit(1);
  }
  if (state.status === "corrupt") {
    console.error(`Task state is corrupt: ${currentPath}`);
    process.exit(1);
  }
  const resumed = {
    ...state,
    resumeInstructions: [
      "Read AGENTS.md, ai-knowledge/LOAD.md, ai-knowledge/core/LOAD.md, and ai-knowledge/ai/LOAD.md.",
      "Use this task state as the current plan instead of relying on chat history.",
      "Continue from next, then write a checkpoint after the next meaningful action.",
      "Before final response, run ai-closeout and applicable gates.",
    ],
  };
  print(resumed, asJson);
  process.exit(state.status === "closed" ? 1 : 0);
}

usage();
process.exit(1);
