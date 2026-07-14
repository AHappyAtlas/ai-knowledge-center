#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cac } from 'cac';

type ServerOptions = {
  host?: string;
  port?: string;
  projects?: string;
  workspace?: string;
  configDir?: string;
  logLevel?: string;
  foreground?: boolean;
};

const cli = cac('aikc');
const passThroughOptions = ['--host', '--port', '--projects', '--workspace', '--config-dir', '--log-level'];
const backgroundEnvName = 'AIKC_FOREGROUND_SERVER';

function packageVersion(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (dir !== path.dirname(dir)) {
    const packagePath = path.join(dir, 'package.json');
    if (fs.existsSync(packagePath)) {
      const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { version?: unknown };
      return typeof parsed.version === 'string' ? parsed.version : '0.0.0';
    }
    dir = path.dirname(dir);
  }
  return '0.0.0';
}

cli.version(packageVersion(), '-v, --version');

function stateRoot(): string {
  return path.resolve(process.env['AIKC_HOME'] ?? path.join(os.homedir(), '.ai-knowledge-center'));
}

function pidFilePath(): string {
  return path.join(stateRoot(), 'server.pid.json');
}

function optionArgs(args: string[], names: string[]): string[] {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    const option = names.find(name => arg === name || arg.startsWith(`${name}=`));
    if (!option) continue;

    values.push(arg);
    if (arg === option) {
      const next = args[index + 1];
      if (next && !next.startsWith('--')) {
        values.push(next);
        index += 1;
      }
    }
  }

  return values;
}

async function startServer(options: ServerOptions): Promise<void> {
  if (options.host) process.env['AIKC_HOST'] = options.host;
  if (options.port) process.env['AIKC_PORT'] = options.port;
  if (options.projects) process.env['AIKC_PROJECTS'] = options.projects;
  if (options.workspace) process.env['AIKC_WORKSPACE'] = options.workspace;
  if (options.configDir) process.env['AIKC_CONFIG_DIR'] = options.configDir;
  if (options.logLevel) process.env['AIKC_LOG_LEVEL'] = options.logLevel;
  process.env['AIKC_LOG_LEVEL'] ??= 'warn';

  await import('../server/index.js');
}

function startServerInBackground(): void {
  const args = process.argv.slice(1).filter(arg => arg !== '--foreground');
  const port = readInlineOption(args, '--port') ?? process.env['AIKC_PORT'] ?? '4318';
  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      [backgroundEnvName]: '1',
      AIKC_LOG_LEVEL: process.env['AIKC_LOG_LEVEL'] ?? 'warn',
    },
    windowsHide: true,
  });
  child.unref();
  console.log(`AI Knowledge Center started in the background. Open http://127.0.0.1:${port}`);
}

function readInlineOption(args: string[], name: string): string | null {
  const equalsPrefix = `${name}=`;
  const inline = args.find(arg => arg.startsWith(equalsPrefix));
  if (inline) return inline.slice(equalsPrefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
}

function stopServer(): void {
  const pidPath = pidFilePath();
  if (!fs.existsSync(pidPath)) {
    console.log('AI Knowledge Center server is not running.');
    return;
  }

  const raw = fs.readFileSync(pidPath, 'utf8').replace(/^\uFEFF/, '');
  const parsed = JSON.parse(raw) as { pid?: unknown; port?: unknown };
  if (typeof parsed.pid !== 'number') {
    fs.rmSync(pidPath, { force: true });
    console.log('AI Knowledge Center server pid file was invalid and has been removed.');
    return;
  }

  try {
    process.kill(parsed.pid);
    fs.rmSync(pidPath, { force: true });
    console.log(`AI Knowledge Center server stopped${typeof parsed.port === 'number' ? ` on port ${String(parsed.port)}` : ''}.`);
  } catch {
    fs.rmSync(pidPath, { force: true });
    console.log('AI Knowledge Center server was not running; stale pid file removed.');
  }
}

function addServerOptions(command: ReturnType<typeof cli.command>) {
  return command
    .option('--host <host>', 'Bind host. Default: 127.0.0.1')
    .option('--port <port>', 'HTTP port. Default: 4318')
    .option('--projects <paths>', 'Project paths separated by semicolon or newline')
    .option('--workspace <path>', 'Workspace root used for project auto-discovery. Default: user home')
    .option('--config-dir <path>', 'Directory containing projects.json')
    .option('--log-level <level>', 'Fastify log level. Default: warn')
    .option('--foreground', 'Run the server in the current terminal for debugging');
}

addServerOptions(cli.command('', 'Start the AI Knowledge Center dashboard')).action(async (options: ServerOptions) => {
  if (!options.foreground && process.env[backgroundEnvName] !== '1') {
    startServerInBackground();
    return;
  }
  await startServer(options);
});

cli.command('stop', 'Stop the background AI Knowledge Center server').action(() => {
  stopServer();
});

cli
  .command('doctor', 'Diagnose AIKC project workflow health')
  .option('--project <path>', 'Target project root. Default: current directory')
  .option('--json', 'Print JSON output')
  .action(async (options: { project?: string; json?: boolean }) => {
    const { runDoctor } = await import('./doctor.js');
    await runDoctor(options);
  });

cli
  .command('context-pack', 'Create a compact project reading plan for one task')
  .option('--project <path>', 'Target project root. Default: current directory')
  .option('--task <task>', 'Task description used for context routing')
  .option('--summary', 'Return the compact summary instead of the full plan')
  .option('--enforce', 'Fail when the selected context exceeds the token budget')
  .option('--max-total-tokens <count>', 'Maximum total context tokens when enforcing')
  .action(async (options: { project?: string; task?: string; summary?: boolean; enforce?: boolean; maxTotalTokens?: string }) => {
    if (!options.task?.trim()) {
      throw new Error('Usage: aikc context-pack --task <task> [--project <path>]');
    }
    const { runContextPack } = await import('./context-pack.js');
    runContextPack({ ...options, task: options.task });
  });

cli
  .command('mcp', 'Run the AIKC MCP server over stdio')
  .option('--project <path>', 'Limit MCP context to one project root. Default: configured projects')
  .action(async (options: { project?: string }) => {
    const { runMcpServer } = await import('./mcp-server.js');
    await runMcpServer(options);
  });

addServerOptions(cli.command('autostart <action>', 'Manage login autostart')).action(async (action: string) => {
  if (action !== 'install' && action !== 'uninstall' && action !== 'status') {
    console.error('Usage: aikc autostart <install|uninstall|status> [options]');
    process.exit(1);
  }

  const { runAutostart } = await import('./autostart.js');
  const result = await runAutostart({
    action,
    cliPath: process.argv[1] ?? '',
    args: optionArgs(process.argv.slice(4), passThroughOptions),
  });

  if (action === 'status') {
    console.log(result ? 'AI Knowledge Center autostart is installed.' : 'AI Knowledge Center autostart is not installed.');
  } else {
    console.log(`AI Knowledge Center autostart ${action === 'install' ? 'installed' : 'removed'}.`);
  }
});

cli
  .command('upgrade', 'Upgrade or initialize project AI workflow files')
  .option('--project <path>', 'Target project root. Default: current directory')
  .option('--write', 'Create missing files, candidate templates, and an AI handoff prompt')
  .option('--ai', 'Write the AI handoff prompt even when no conflict is detected')
  .option('--force', 'Overwrite conflicting templates after writing backups; use rarely')
  .option('--dry-run', 'Explicit dry-run mode. This is the default')
  .action(async () => {
    const { runProjectUpgrade } = await import('./project-upgrader.js');
    await runProjectUpgrade(process.argv.slice(3));
  });

cli.help();
cli.example('aikc');
cli.example('aikc stop');
cli.example('aikc doctor --project C:/repo/app');
cli.example('aikc context-pack --project C:/repo/app --task "fix login timeout" --summary');
cli.example('aikc mcp --project C:/repo/app');
cli.example('aikc --port 4318');
cli.example('aikc --projects "C:/repo/a;C:/repo/b"');
cli.example('aikc autostart install');
cli.example('aikc autostart status');
cli.example('aikc upgrade --project C:/repo/app');
cli.example('aikc upgrade --project C:/repo/app --write');
cli.parse();
