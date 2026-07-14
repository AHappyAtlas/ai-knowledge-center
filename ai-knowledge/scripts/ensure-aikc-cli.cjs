#!/usr/bin/env node

const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PACKAGE_NAME = "ai-knowledge-center";
const CLI_NAME = "aikc";
const REGISTRY = "https://registry.npmjs.org/";
const repoRoot = path.resolve(__dirname, "..", "..");

function stateRoot() {
  return path.resolve(process.env.AIKC_HOME || path.join(os.homedir(), ".ai-knowledge-center"));
}

function pidFilePath() {
  return path.join(stateRoot(), "server.pid.json");
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    ...options,
  });
}

function combinedOutput(result) {
  return `${result.stdout || ""}${result.stderr || ""}`.trim();
}

function npm(args, options) {
  return run("npm", [...args, "--registry", REGISTRY], options);
}

function latestVersion() {
  const result = npm(["view", PACKAGE_NAME, "version"]);
  if (result.status !== 0) {
    throw new Error(`Unable to query ${PACKAGE_NAME} from npm registry: ${combinedOutput(result)}`);
  }
  return result.stdout.trim();
}

function installedVersion() {
  const result = npm(["list", "-g", PACKAGE_NAME, "--depth=0", "--json"]);
  if (!result.stdout.trim()) return null;
  try {
    const parsed = JSON.parse(result.stdout);
    return parsed.dependencies?.[PACKAGE_NAME]?.version || null;
  } catch {
    return null;
  }
}

function commandExists() {
  const result = process.platform === "win32" ? run("where", [CLI_NAME]) : run("sh", ["-lc", `command -v ${CLI_NAME}`]);
  return result.status === 0;
}

function installGlobal(version, reason) {
  console.log(`[aikc] ${reason}; installing ${PACKAGE_NAME}@${version} from ${REGISTRY}`);
  const result = npm(["install", "-g", `${PACKAGE_NAME}@${version}`], { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(manualRetryMessage(version));
  }
}

function manualRetryMessage(version) {
  return [
    `Failed to install ${PACKAGE_NAME}@${version}.`,
    "Manual retry:",
    "  aikc stop",
    `  npm install -g ${PACKAGE_NAME}@${version}`,
    "  aikc",
  ].join("\n");
}

function readServerState() {
  const pidPath = pidFilePath();
  if (!fs.existsSync(pidPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(pidPath, "utf8").replace(/^\uFEFF/, ""));
    if (typeof parsed.pid !== "number") return null;
    return {
      pid: parsed.pid,
      host: typeof parsed.host === "string" ? parsed.host : undefined,
      port: typeof parsed.port === "number" ? parsed.port : undefined,
      args: Array.isArray(parsed.args) ? parsed.args.filter(arg => typeof arg === "string") : [],
    };
  } catch {
    return null;
  }
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function waitForExit(pid, timeoutMs = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!isProcessRunning(pid)) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  return !isProcessRunning(pid);
}

function stopServerState(state) {
  if (!state || !isProcessRunning(state.pid)) {
    fs.rmSync(pidFilePath(), { force: true });
    return false;
  }
  process.kill(state.pid);
  waitForExit(state.pid);
  fs.rmSync(pidFilePath(), { force: true });
  return true;
}

function restartServerIfNeeded(state, restartAfterUpdate) {
  if (!state || !isProcessRunning(state.pid)) return;
  if (!restartAfterUpdate) {
    stopServerState(state);
    return;
  }
  const restartArgs = state.args.length > 0 ? state.args.filter(arg => arg !== "--foreground") : [];
  if (restartArgs.length === 0) {
    if (state.host) restartArgs.push("--host", state.host);
    if (typeof state.port === "number") restartArgs.push("--port", String(state.port));
  }
  console.log("[aikc] Restarting running AI Knowledge Center server after CLI update.");
  stopServerState(state);
  const child = spawn(CLI_NAME, restartArgs, {
    cwd: repoRoot,
    detached: true,
    shell: process.platform === "win32",
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

function startServerFromState(state) {
  if (!state) return;
  const restartArgs = state.args.length > 0 ? state.args.filter(arg => arg !== "--foreground") : [];
  if (restartArgs.length === 0) {
    if (state.host) restartArgs.push("--host", state.host);
    if (typeof state.port === "number") restartArgs.push("--port", String(state.port));
  }
  const child = spawn(CLI_NAME, restartArgs, {
    cwd: repoRoot,
    detached: true,
    shell: process.platform === "win32",
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

function installGlobalWithServerHandling(version, reason, runningServer, restartAfterUpdate) {
  const wasRunning = runningServer && isProcessRunning(runningServer.pid);
  if (wasRunning) {
    console.log("[aikc] Stopping running AI Knowledge Center server before global CLI update.");
    stopServerState(runningServer);
  }
  try {
    installGlobal(version, reason);
  } catch (error) {
    if (wasRunning && restartAfterUpdate) startServerFromState(runningServer);
    throw error;
  }
  if (wasRunning && restartAfterUpdate) {
    console.log("[aikc] Restarting AI Knowledge Center server after CLI update.");
    startServerFromState(runningServer);
  }
}

function ensureCli(options = {}) {
  const latest = latestVersion();
  const installed = installedVersion();
  const hasCommand = commandExists();
  const runningServer = readServerState();
  const restartAfterUpdate = options.restartAfterUpdate !== false;

  if (!installed || !hasCommand) {
    installGlobalWithServerHandling(latest, `${CLI_NAME} is missing`, runningServer, restartAfterUpdate);
    return;
  }

  if (installed !== latest) {
    installGlobalWithServerHandling(latest, `${CLI_NAME} is ${installed}, latest is ${latest}`, runningServer, restartAfterUpdate);
    return;
  }

  console.log(`[aikc] ${CLI_NAME} ${installed} is installed and matches npm latest ${latest}.`);
}

function upgradeArgsWithDefaults(extraArgs) {
  const skipAi = extraArgs.includes("--no-ai");
  const filtered = extraArgs.filter(arg => arg !== "--no-ai");
  if (!skipAi && !filtered.includes("--ai")) filtered.push("--ai");
  return filtered;
}

function runUpgrade(extraArgs) {
  const result = run(CLI_NAME, ["upgrade", "--project", repoRoot, "--write", ...upgradeArgsWithDefaults(extraArgs)], { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`Failed to run ${CLI_NAME} upgrade.`);
  }
}

function startDashboard(extraArgs) {
  const child = spawn(CLI_NAME, ["--projects", repoRoot, ...extraArgs], {
    cwd: repoRoot,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  child.on("exit", code => process.exit(code || 0));
}

try {
  const args = process.argv.slice(2);
  ensureCli({ restartAfterUpdate: !args.includes("--start") });
  if (args.includes("--upgrade")) {
    const index = args.indexOf("--upgrade");
    const extraArgs = args.slice(index + 1).filter(arg => arg !== "--");
    runUpgrade(extraArgs);
  }

  if (args.includes("--start")) {
    const index = args.indexOf("--start");
    const extraArgs = args.slice(index + 1).filter(arg => arg !== "--");
    startDashboard(extraArgs);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
