import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadManifest } from '../server/manifest-loader.js';

type DoctorOptions = {
  project?: string;
  json?: boolean;
};

type DoctorCheck = {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'error';
  evidence: string;
};

function run(command: string, args: string[], cwd: string): { status: number; output: string } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout}${result.stderr}`.trim(),
  };
}

function check(id: string, label: string, ok: boolean, evidence: string, severity: 'warn' | 'error' = 'error'): DoctorCheck {
  return {
    id,
    label,
    status: ok ? 'pass' : severity,
    evidence,
  };
}

function serverState(): string {
  const root = path.resolve(process.env['AIKC_HOME'] ?? path.join(os.homedir(), '.ai-knowledge-center'));
  const pidPath = path.join(root, 'server.pid.json');
  if (!fs.existsSync(pidPath)) return 'no pid file';
  try {
    const parsed = JSON.parse(fs.readFileSync(pidPath, 'utf8').replace(/^\uFEFF/, '')) as { pid?: unknown; port?: unknown };
    if (typeof parsed.pid !== 'number') return 'invalid pid file';
    try {
      process.kill(parsed.pid, 0);
      const port = typeof parsed.port === 'number' || typeof parsed.port === 'string' ? String(parsed.port) : 'unknown';
      return `running pid=${String(parsed.pid)} port=${port}`;
    } catch {
      return `stale pid=${String(parsed.pid)}`;
    }
  } catch {
    return 'invalid pid file';
  }
}

function unresolvedCandidates(projectRoot: string): string[] {
  const found: string[] = [];
  const stack = [projectRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      if (entry.isFile() && entry.name.endsWith('.aikc-upgrade.md')) found.push(path.relative(projectRoot, absolute).replace(/\\/g, '/'));
    }
  }
  return found.sort();
}

export async function runDoctor(options: DoctorOptions): Promise<void> {
  const projectRoot = path.resolve(options.project ?? process.cwd());
  const checks: DoctorCheck[] = [];

  try {
    const { manifest, inferred } = await loadManifest(projectRoot);
    checks.push(check('manifest', 'Workflow manifest', !inferred, inferred ? 'using inferred manifest' : `${manifest.id}: ${manifest.name}`, 'warn'));
    checks.push(check('loops', 'Bounded loops', Object.keys(manifest.loops).length > 0, `${String(Object.keys(manifest.loops).length)} loops declared`, 'warn'));
  } catch (error) {
    checks.push(check('manifest', 'Workflow manifest', false, error instanceof Error ? error.message : String(error)));
  }

  for (const [id, script] of [
    ['knowledge-check', 'ai-knowledge/scripts/knowledge-check.cjs'],
    ['human-docs-check', 'ai-knowledge/scripts/human-docs-check.cjs'],
    ['eval-workflow', 'ai-knowledge/scripts/eval-workflow.cjs'],
  ] as const) {
    if (!fs.existsSync(path.join(projectRoot, script))) {
      checks.push(check(id, script, false, 'script missing', 'warn'));
      continue;
    }
    const result = run('node', [script], projectRoot);
    checks.push(check(id, script, result.status === 0, result.output || 'ok', id === 'eval-workflow' ? 'warn' : 'error'));
  }

  const candidates = unresolvedCandidates(projectRoot);
  checks.push(check('upgrade-candidates', 'Unresolved upgrade candidates', candidates.length === 0, candidates.length === 0 ? 'none' : candidates.join(', '), 'warn'));

  const npmGlobal = run('npm', ['list', '-g', 'ai-knowledge-center', '--depth=0', '--json'], projectRoot);
  checks.push(check('global-cli', 'Global AIKC package', npmGlobal.status === 0, npmGlobal.status === 0 ? 'installed' : npmGlobal.output, 'warn'));
  checks.push(check('web-server', 'Background Web server', !serverState().startsWith('stale') && !serverState().startsWith('invalid'), serverState(), 'warn'));

  const status = checks.some(item => item.status === 'error') ? 'fail' : checks.some(item => item.status === 'warn') ? 'warn' : 'pass';
  const summary = { status, projectRoot, checks };

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`AIKC doctor: ${status}`);
    for (const item of checks) console.log(`[${item.status}] ${item.id}: ${item.evidence}`);
  }

  if (status === 'fail') process.exitCode = 1;
}
