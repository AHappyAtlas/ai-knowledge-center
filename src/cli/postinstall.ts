import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type ServerState = {
  pid: number;
  host?: string;
  port?: number;
  args: string[];
};

function isGlobalInstall(): boolean {
  return process.env['npm_config_global'] === 'true' || process.env['npm_config_location'] === 'global';
}

function stateRoot(): string {
  return path.resolve(process.env['AIKC_HOME'] ?? path.join(os.homedir(), '.ai-knowledge-center'));
}

function pidFilePath(): string {
  return path.join(stateRoot(), 'server.pid.json');
}

function readServerState(): ServerState | null {
  const pidPath = pidFilePath();
  if (!fs.existsSync(pidPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(pidPath, 'utf8').replace(/^\uFEFF/, '')) as {
      pid?: unknown;
      host?: unknown;
      port?: unknown;
      args?: unknown;
    };
    if (typeof parsed.pid !== 'number') return null;
    const state: ServerState = {
      pid: parsed.pid,
      args: Array.isArray(parsed.args) ? parsed.args.filter((arg): arg is string => typeof arg === 'string') : [],
    };
    if (typeof parsed.host === 'string') state.host = parsed.host;
    if (typeof parsed.port === 'number') state.port = parsed.port;
    return state;
  } catch {
    return null;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function waitForExit(pid: number, timeoutMs = 4000): void {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!isProcessRunning(pid)) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
}

function restartArgs(state: ServerState): string[] {
  const args = state.args.filter(arg => arg !== '--foreground');
  if (args.length > 0) return args;
  const fallback: string[] = [];
  if (state.host) fallback.push('--host', state.host);
  if (typeof state.port === 'number') fallback.push('--port', String(state.port));
  return fallback;
}

function restartServer(state: ServerState): void {
  if (!isProcessRunning(state.pid)) {
    fs.rmSync(pidFilePath(), { force: true });
    return;
  }

  process.kill(state.pid);
  waitForExit(state.pid);
  fs.rmSync(pidFilePath(), { force: true });

  const cliPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'aikc.js');
  const child = spawn(process.execPath, [cliPath, ...restartArgs(state)], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

if (isGlobalInstall()) {
  const state = readServerState();
  if (state) restartServer(state);
}
