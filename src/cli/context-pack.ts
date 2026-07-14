import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type ContextPackOptions = {
  project?: string;
  task: string;
  summary?: boolean;
  enforce?: boolean;
  maxTotalTokens?: string;
};

export function runContextPack(options: ContextPackOptions): void {
  const projectRoot = path.resolve(options.project ?? process.cwd());
  const script = path.join(projectRoot, 'ai-knowledge', 'scripts', 'context-pack.cjs');

  if (!fs.existsSync(script)) {
    throw new Error(`AIKC context-pack script not found: ${script}. Run \`aikc upgrade --project ${projectRoot} --write\` first.`);
  }

  const args = [script, '--task', options.task];
  if (options.summary) args.push('--summary');
  if (options.enforce) args.push('--enforce');
  if (options.maxTotalTokens) args.push('--max-total-tokens', options.maxTotalTokens);

  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    shell: false,
    stdio: 'inherit',
    windowsHide: true,
  });

  if (result.error) throw result.error;
  if (result.status && result.status !== 0) process.exitCode = result.status;
}
