import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { registryPath, userHome, workspaceRoot } from './paths.js';
import { registryEntrySchema, registrySchema, type RegistryEntry } from '../shared/manifest.js';

const manifestNames = ['ai-workflow.yaml', 'ai-workflow.yml'];
const discoverySignalPatterns = [
  'ai-workflow.yaml',
  'ai-workflow.yml',
  'ai-knowledge/LOAD.md',
  '*/ai-workflow.yaml',
  '*/ai-workflow.yml',
  '*/ai-knowledge/LOAD.md',
];

function splitEnvPaths(value: string | undefined): string[] {
  return (value ?? '')
    .split(/[;\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function hasWorkflowSignals(projectRoot: string): Promise<boolean> {
  for (const name of manifestNames) {
    if (await pathExists(path.join(projectRoot, name))) return true;
  }
  if (await pathExists(path.join(projectRoot, 'ai-knowledge', 'LOAD.md'))) return true;
  return false;
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of paths) {
    const resolved = path.resolve(item);
    const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(resolved);
  }
  return result;
}

async function existingDirectories(paths: string[]): Promise<string[]> {
  const result: string[] = [];
  for (const item of uniquePaths(paths)) {
    const stat = await fs.stat(item).catch(() => null);
    if (stat?.isDirectory()) result.push(item);
  }
  return result;
}

async function discoveryRoots(): Promise<string[]> {
  const explicitWorkspace = process.env['AIKC_WORKSPACE'];
  if (explicitWorkspace) {
    return existingDirectories([workspaceRoot]);
  }

  return existingDirectories([
    process.cwd(),
    workspaceRoot,
    path.join(userHome, 'Documents', 'GitHub'),
    path.join(userHome, 'Documents', 'Gitlab'),
    path.join(userHome, 'Documents', 'Projects'),
    path.join(userHome, 'Documents'),
    path.join(userHome, 'GitHub'),
    path.join(userHome, 'Projects'),
    path.join(userHome, 'source', 'repos'),
  ]);
}

function rootFromSignal(root: string, signalPath: string): string {
  const normalized = signalPath.split(/[\\/]/);
  if (normalized[0] === 'ai-workflow.yaml' || normalized[0] === 'ai-workflow.yml') return root;
  if (normalized[0] === 'ai-knowledge') return root;
  return path.join(root, normalized[0] ?? '.');
}

async function discoverProjects(): Promise<{ projects: RegistryEntry[]; roots: string[] }> {
  const roots = await discoveryRoots();
  const projectPaths: string[] = [];

  for (const root of roots) {
    if (await hasWorkflowSignals(root)) {
      projectPaths.push(root);
    }

    const matches = await fg(discoverySignalPatterns, {
      cwd: root,
      onlyFiles: true,
      unique: true,
      dot: false,
      followSymbolicLinks: false,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
    });

    for (const match of matches) {
      projectPaths.push(rootFromSignal(root, match));
    }
  }

  const projects = uniquePaths(projectPaths).map(projectPath => registryEntrySchema.parse({ path: projectPath }));
  return { projects, roots };
}

export async function loadRegistryEntries(): Promise<{ projects: RegistryEntry[]; errors: string[] }> {
  const errors: string[] = [];
  const envProjects = splitEnvPaths(process.env['AIKC_PROJECTS']);
  if (envProjects.length > 0) {
    return { projects: envProjects.map(projectPath => registryEntrySchema.parse({ path: projectPath })), errors };
  }

  if (await pathExists(registryPath)) {
    try {
      const raw = JSON.parse((await fs.readFile(registryPath, 'utf8')).replace(/^\uFEFF/, '')) as unknown;
      const parsed = registrySchema.parse(raw);
      if (parsed.projects.length > 0) {
        return { projects: parsed.projects, errors };
      }
      errors.push(`No projects listed in ${registryPath}; falling back to auto-discovery.`);
    } catch (error) {
      errors.push(`Failed to read config/projects.json: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const discovered = await discoverProjects();
  const discoveredProjects = discovered.projects;
  if (discoveredProjects.length === 0) {
    errors.push(`No projects discovered. Set AIKC_PROJECTS, create ${registryPath}, run aikc from a project directory, or set AIKC_WORKSPACE. Searched: ${discovered.roots.join('; ') || workspaceRoot}.`);
  }
  return { projects: discoveredProjects, errors };
}
