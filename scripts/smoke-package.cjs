#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { basename, join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const tempRoot = mkdtempSync(join(tmpdir(), 'aikc-package-smoke-'));
const projectDir = join(tempRoot, 'project');
const globalPrefix = join(tempRoot, 'global');
const globalProjectDir = join(tempRoot, 'global-project');
const npm = 'npm';
let tarball = null;

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    ...options,
  });
}

function assertDoctorHealthy(result, label) {
  const errors = Array.isArray(result.checks)
    ? result.checks.filter((item) => item && item.status === 'error')
    : [];
  if (result.status === 'fail' || errors.length > 0) {
    const evidence = errors.map((item) => `${item.id}: ${item.evidence}`).join('; ');
    throw new Error(`${label} doctor reported errors${evidence ? `: ${evidence}` : ''}`);
  }
  if (result.status === 'warn') {
    const warnings = Array.isArray(result.checks)
      ? result.checks.filter((item) => item && item.status === 'warn').map((item) => item.id).join(', ')
      : 'unspecified';
    console.log(`${label} doctor warnings (non-blocking): ${warnings}`);
  }
}

try {
  const packed = JSON.parse(run(npm, ['pack', '--json']));
  tarball = join(root, packed[0].filename);
  if (!existsSync(tarball)) throw new Error(`npm pack did not create ${tarball}`);

  writeFileSync(join(tempRoot, 'package.json'), '{"private":true}\n');
  run(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], { cwd: tempRoot });
  mkdirSync(projectDir);
  writeFileSync(join(projectDir, 'package.json'), '{"name":"aikc-smoke-project","private":true}\n');

  const cli = join(tempRoot, 'node_modules', 'ai-knowledge-center', 'dist', 'cli', 'aikc.js');
  const env = { ...process.env, AIKC_HOME: join(tempRoot, 'state') };
  run(process.execPath, [cli, 'upgrade', '--project', projectDir, '--write', '--ai'], { env, shell: false });
  const doctor = run(process.execPath, [cli, 'doctor', '--project', projectDir, '--json'], { env, shell: false });
  const result = JSON.parse(doctor);
  const contextPack = run(process.execPath, [cli, 'context-pack', '--project', projectDir, '--task', 'package smoke', '--summary'], { env, shell: false });
  const context = JSON.parse(contextPack);

  assertDoctorHealthy(result, 'Generated project');
  if (!Array.isArray(context.recommendedFiles)) throw new Error('Context pack did not return recommendedFiles');
  if (!existsSync(join(projectDir, 'ai-workflow.yaml'))) throw new Error('Generated project is missing ai-workflow.yaml');
  if (!existsSync(join(projectDir, 'ai-knowledge', 'LOAD.md'))) throw new Error('Generated project is missing ai-knowledge/LOAD.md');

  run(npm, ['install', '-g', '--prefix', globalPrefix, '--ignore-scripts', '--no-audit', '--no-fund', tarball], { cwd: tempRoot });
  const globalPackageRoot = process.platform === 'win32'
    ? join(globalPrefix, 'node_modules', 'ai-knowledge-center')
    : join(globalPrefix, 'lib', 'node_modules', 'ai-knowledge-center');
  const globalBin = process.platform === 'win32' ? join(globalPrefix, 'aikc.cmd') : join(globalPrefix, 'bin', 'aikc');
  const globalCli = join(globalPackageRoot, 'dist', 'cli', 'aikc.js');
  if (!existsSync(globalBin) || !existsSync(globalCli)) throw new Error('Temporary global installation did not create the aikc executable');

  mkdirSync(globalProjectDir);
  writeFileSync(join(globalProjectDir, 'package.json'), '{"name":"aikc-global-smoke-project","private":true}\n');
  run(process.execPath, [globalCli, 'upgrade', '--project', globalProjectDir, '--write', '--ai'], { env, shell: false });
  const globalDoctor = JSON.parse(run(process.execPath, [globalCli, 'doctor', '--project', globalProjectDir, '--json'], { env, shell: false }));
  assertDoctorHealthy(globalDoctor, 'Global installation');
  if (!existsSync(join(globalProjectDir, 'ai-workflow.yaml'))) throw new Error('Global installation did not initialize a project');

  console.log(`package smoke ok (local and global install: ${basename(tarball)})`);
} finally {
  if (tarball && existsSync(tarball)) rmSync(tarball, { force: true });
  rmSync(tempRoot, { force: true, recursive: true });
}
