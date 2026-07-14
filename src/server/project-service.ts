import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import MiniSearch from 'minisearch';
import { simpleGit, type StatusResult } from 'simple-git';
import { loadRegistryEntries } from './config.js';
import { loadManifest } from './manifest-loader.js';
import { ensureProjectInitialized } from './project-initializer.js';
import { stateRoot } from './paths.js';
import type {
  CommandRunSummary,
  DaggerStatus,
  FileProbe,
  GateStatus,
  GitSummary,
  IntegrationStatus,
  KnowledgeListItem,
  KnowledgeListResponse,
  KnowledgeListSort,
  KnowledgePreview,
  KnowledgeRevision,
  KnowledgeSearchResponse,
  KnowledgeSearchResult,
  McpServerStatus,
  ProjectSummary,
  RegistrySummary,
  TelemetryStatus,
} from '../shared/api.js';
import type { McpServer, WorkflowCommand, WorkflowGate, WorkflowManifest } from '../shared/manifest.js';

type KnowledgeLineDocument = {
  id: string;
  projectId: string;
  projectName: string;
  path: string;
  line: number;
  content: string;
  excerpt: string;
};

const lastRuns = new Map<string, CommandRunSummary>();
const searchableExtensions = new Set(['.md', '.mdx', '.txt', '.yaml', '.yml', '.json']);
const maxSearchFiles = 250;
const maxSearchResults = 80;
const maxSearchFileBytes = 512_000;
const maxPreviewBytes = 256_000;

function persistedRunPath(projectId: string, commandId: string): string {
  return path.join(stateRoot, 'runs', encodeURIComponent(projectId), `${encodeURIComponent(commandId)}.json`);
}

function persistedRun(projectId: string, commandId: string): CommandRunSummary | null {
  const inMemory = lastRuns.get(`${projectId}:${commandId}`);
  if (inMemory) return inMemory;

  try {
    const parsed = JSON.parse(fsSync.readFileSync(persistedRunPath(projectId, commandId), 'utf8')) as Partial<CommandRunSummary>;
    if (parsed.projectId !== projectId || parsed.commandId !== commandId || typeof parsed.id !== 'string') return null;
    return {
      ...parsed,
      stdout: '',
      stderr: '',
      exitCode: typeof parsed.exitCode === 'number' ? parsed.exitCode : null,
      timedOut: parsed.timedOut === true,
      durationMs: typeof parsed.durationMs === 'number' ? parsed.durationMs : 0,
      label: parsed.label ?? commandId,
      command: parsed.command ?? '',
      startedAt: parsed.startedAt ?? '',
      finishedAt: parsed.finishedAt ?? '',
      traceId: parsed.traceId ?? '',
      aikcVersion: parsed.aikcVersion ?? 'unknown',
      summary: parsed.summary ?? 'Recorded result.',
      residualRisk: parsed.residualRisk ?? 'No residual risk recorded.',
      id: parsed.id,
      projectId,
      commandId,
    };
  } catch {
    return null;
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function probeAsync(projectRoot: string, relPath: string): Promise<FileProbe> {
  return {
    path: relPath,
    exists: await pathExists(path.join(projectRoot, relPath)),
  };
}

async function gitSummary(projectRoot: string): Promise<GitSummary> {
  const git = simpleGit({ baseDir: projectRoot, binary: 'git' });
  try {
    const [status, head] = await Promise.all([
      git.status(),
      git
        .revparse(['HEAD'])
        .then(value => value.trim())
        .catch(() => null),
    ]);
    return {
      branch: status.current || null,
      head,
      shortHead: head?.slice(0, 7) ?? null,
      ahead: status.ahead,
      behind: status.behind,
      changed: status.files.length,
      staged: status.staged.length,
      conflicted: status.conflicted.length,
      files: status.files.map((file: StatusResult['files'][number]) => file.path).slice(0, 30),
    };
  } catch {
    return {
      branch: null,
      head: null,
      shortHead: null,
      ahead: 0,
      behind: 0,
      changed: 0,
      staged: 0,
      conflicted: 0,
      files: [],
    };
  }
}

function normalizeGitPath(relPath: string): string {
  return relPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function fileTouchesPath(filePath: string, watchedPath: string): boolean {
  const file = normalizeGitPath(filePath);
  const watched = normalizeGitPath(watchedPath);
  return file === watched || file.startsWith(`${watched}/`);
}

function uniqueKnowledgePaths(manifest: WorkflowManifest): string[] {
  return Array.from(
    new Set(
      [
        manifest.knowledge.load,
        manifest.knowledge.core,
        manifest.knowledge.aiLoad,
        manifest.knowledge.skills,
        manifest.knowledge.skillIndex,
        manifest.knowledge.agentsFile,
        ...(manifest.knowledge.closeoutPrompt ? [manifest.knowledge.closeoutPrompt] : []),
      ]
        .map(normalizeGitPath)
        .filter(Boolean)
    )
  );
}

function resolveProjectPath(projectRoot: string, relPath: string): string {
  const target = path.resolve(projectRoot, relPath);
  const relative = path.relative(projectRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes project root: ${relPath}`);
  }
  return target;
}

function isKnowledgePathAllowed(relPath: string, allowedPaths: string[]): boolean {
  return allowedPaths.some(allowedPath => fileTouchesPath(relPath, allowedPath));
}

function isSearchableFile(relPath: string): boolean {
  return searchableExtensions.has(path.extname(relPath).toLowerCase());
}

async function collectKnowledgeFiles(projectRoot: string, relPaths: string[]): Promise<{ files: string[]; truncated: boolean }> {
  const files = new Set<string>();
  let truncated = false;

  for (const relPath of relPaths) {
    if (files.size >= maxSearchFiles) {
      truncated = true;
      break;
    }

    const normalizedRoot = normalizeGitPath(relPath);
    const target = resolveProjectPath(projectRoot, relPath);
    let stat;
    try {
      stat = await fs.stat(target);
    } catch {
      continue;
    }

    if (stat.isFile()) {
      if (stat.size <= maxSearchFileBytes && isSearchableFile(normalizedRoot)) files.add(normalizedRoot);
      continue;
    }

    if (!stat.isDirectory()) continue;

    const matches = await fg(`${normalizedRoot}/**/*`, {
      absolute: false,
      cwd: projectRoot,
      dot: false,
      ignore: ['**/.git/**', '**/node_modules/**', '**/dist/**'],
      onlyFiles: true,
      unique: true,
    });

    for (const match of matches) {
      if (files.size >= maxSearchFiles) {
        truncated = true;
        break;
      }
      const normalized = normalizeGitPath(match);
      if (!isSearchableFile(normalized)) continue;
      const fileStat = await fs.stat(resolveProjectPath(projectRoot, normalized)).catch(() => null);
      if (fileStat?.isFile() && fileStat.size <= maxSearchFileBytes) files.add(normalized);
    }
  }

  return { files: Array.from(files).sort(), truncated };
}

function excerptLine(line: string, query: string): string {
  const collapsed = line.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= 180) return collapsed;
  const index = collapsed.toLowerCase().indexOf(query.toLowerCase());
  const start = Math.max(0, index - 70);
  return `${start > 0 ? '...' : ''}${collapsed.slice(start, start + 180)}...`;
}

function countTextOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle.toLowerCase());
  while (index >= 0) {
    count += 1;
    index = haystack.indexOf(needle.toLowerCase(), index + needle.length);
  }
  return count;
}

function compareKnowledgeItems(sort: KnowledgeListSort) {
  return (left: KnowledgeListItem, right: KnowledgeListItem): number => {
    if (sort === 'references') {
      return right.references - left.references || right.updatedAt.localeCompare(left.updatedAt) || left.path.localeCompare(right.path);
    }
    if (sort === 'createdAt') {
      return right.createdAt.localeCompare(left.createdAt) || left.path.localeCompare(right.path);
    }
    return right.updatedAt.localeCompare(left.updatedAt) || left.path.localeCompare(right.path);
  };
}

function emptyKnowledgeRevision(paths: string[]): KnowledgeRevision {
  return {
    paths,
    latestCommit: null,
    shortLatestCommit: null,
    latestAt: null,
    latestSubject: null,
    dirty: false,
    changedFiles: [],
  };
}

async function knowledgeRevision(projectRoot: string, relPaths: string[]): Promise<KnowledgeRevision> {
  const paths = Array.from(new Set(relPaths.map(normalizeGitPath).filter(Boolean)));
  if (paths.length === 0) return emptyKnowledgeRevision(paths);

  const git = simpleGit({ baseDir: projectRoot, binary: 'git' });
  try {
    const [status, log] = await Promise.all([
      git.status(),
      git
        .raw(['log', '-1', '--format=%H%x00%h%x00%aI%x00%s', '--', ...paths])
        .then(value => value.trim())
        .catch(() => ''),
    ]);
    const changedFiles = status.files
      .map((file: StatusResult['files'][number]) => normalizeGitPath(file.path))
      .filter(file => paths.some(watchedPath => fileTouchesPath(file, watchedPath)))
      .slice(0, 30);

    if (!log) {
      return {
        ...emptyKnowledgeRevision(paths),
        dirty: changedFiles.length > 0,
        changedFiles,
      };
    }

    const [latestCommit, shortLatestCommit, latestAt, latestSubject] = log.split('\0');
    return {
      paths,
      latestCommit: latestCommit || null,
      shortLatestCommit: shortLatestCommit || null,
      latestAt: latestAt || null,
      latestSubject: latestSubject || null,
      dirty: changedFiles.length > 0,
      changedFiles,
    };
  } catch {
    return emptyKnowledgeRevision(paths);
  }
}

function gateStatus(projectId: string, gate: WorkflowGate): GateStatus {
  return {
    id: gate.id,
    label: gate.label,
    category: gate.category,
    command: gate.command,
    lastRun: persistedRun(projectId, gate.id),
  };
}

async function mcpServerStatus(projectRoot: string, server: McpServer): Promise<McpServerStatus> {
  const config = server.configPath ? await probeAsync(projectRoot, server.configPath) : null;
  return {
    id: server.id,
    label: server.label,
    type: server.type,
    configured: Boolean(server.command || server.url || config?.exists),
    command: server.command ?? null,
    args: server.args,
    scope: server.scope,
    config,
    url: server.url ?? null,
    description: server.description ?? null,
  };
}

function telemetryStatus(manifest: WorkflowManifest): TelemetryStatus {
  return {
    enabled: manifest.telemetry.enabled,
    serviceName: manifest.telemetry.serviceName ?? manifest.id,
    exporter: manifest.telemetry.exporter,
    endpoint: manifest.telemetry.endpoint ?? null,
  };
}

function integrationStatus(manifest: WorkflowManifest): IntegrationStatus[] {
  return Object.entries(manifest.integrations).map(([id, integration]) => ({
    id,
    ...integration,
  }));
}

async function daggerStatus(projectRoot: string, manifest: WorkflowManifest): Promise<DaggerStatus> {
  const modulePath = normalizeGitPath(manifest.dagger.modulePath);
  const moduleFile = modulePath === '.' ? 'dagger.json' : `${modulePath}/dagger.json`;
  const module = await probeAsync(projectRoot, moduleFile);
  const legacyDir = await pathExists(path.join(projectRoot, modulePath === '.' ? '.dagger' : modulePath, '.dagger'));
  const rootLegacyDir = modulePath === '.' ? await pathExists(path.join(projectRoot, '.dagger')) : false;

  return {
    enabled: manifest.dagger.enabled,
    module,
    pipeline: manifest.dagger.pipeline ?? null,
    command: manifest.dagger.command ?? null,
    detected: module.exists || legacyDir || rootLegacyDir,
  };
}

export function rememberRun(run: CommandRunSummary): void {
  lastRuns.set(`${run.projectId}:${run.commandId}`, run);
  const target = persistedRunPath(run.projectId, run.commandId);
  const safeRecord = { ...run, stdout: '', stderr: '' };
  try {
    fsSync.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.${String(process.pid)}.${String(Date.now())}.tmp`;
    fsSync.writeFileSync(temporary, `${JSON.stringify(safeRecord, null, 2)}\n`, 'utf8');
    fsSync.renameSync(temporary, target);
  } catch {
    // In-memory reporting remains available when a local state directory is unavailable.
  }
}

export async function listProjects(): Promise<RegistrySummary> {
  const registry = await loadRegistryEntries();
  const projects: ProjectSummary[] = [];
  const errors = [...registry.errors];

  for (const entry of registry.projects) {
    const projectRoot = path.resolve(entry.path);
    const projectErrors: string[] = [];
    try {
      const initialization = await ensureProjectInitialized(projectRoot, entry);
      if (initialization.missingBefore && !initialization.autoInit) {
        errors.push(`${projectRoot}: Project path does not exist. Set autoInit=true in config/projects.json to create a minimal scaffold.`);
        continue;
      }
      if (initialization.initializedNow) {
        projectErrors.push(`Auto-initialized project workflow: ${initialization.createdFiles.join(', ')}`);
      }

      const loaded = await loadManifest(projectRoot);
      const manifest = loaded.manifest;
      const closeoutPrompt = manifest.knowledge.closeoutPrompt
        ? await probeAsync(projectRoot, manifest.knowledge.closeoutPrompt)
        : null;
      if (loaded.inferred) {
        projectErrors.push('Using inferred manifest. Add ai-workflow.yaml for exact gates and commands.');
      }
      const knowledgePaths = uniqueKnowledgePaths(manifest);
      const watchPaths = Array.from(new Set(manifest.dashboard.watch.filter(watchPath => !knowledgePaths.includes(watchPath))));

      projects.push({
        id: manifest.id,
        name: manifest.name,
        root: projectRoot,
        description: manifest.description ?? null,
        manifest,
        manifestPath: loaded.manifestPath,
        initialization,
        git: await gitSummary(projectRoot),
        knowledge: {
          load: await probeAsync(projectRoot, manifest.knowledge.load),
          skills: await probeAsync(projectRoot, manifest.knowledge.skills),
          closeoutPrompt,
          agentsFile: await probeAsync(projectRoot, manifest.knowledge.agentsFile),
          revision: await knowledgeRevision(projectRoot, knowledgePaths),
        },
        mcp: await Promise.all(manifest.mcp.servers.map(server => mcpServerStatus(projectRoot, server))),
        integrations: integrationStatus(manifest),
        telemetry: telemetryStatus(manifest),
        dagger: await daggerStatus(projectRoot, manifest),
        watch: await Promise.all(watchPaths.map(watchPath => probeAsync(projectRoot, watchPath))),
        gates: manifest.gates.map(gate => gateStatus(manifest.id, gate)),
        links: manifest.dashboard.links,
        errors: projectErrors,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      errors.push(`${projectRoot}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    projects,
    errors,
    updatedAt: new Date().toISOString(),
  };
}

export async function getProject(projectId: string): Promise<ProjectSummary | null> {
  const registry = await listProjects();
  return registry.projects.find(project => project.id === projectId) ?? null;
}

export async function searchKnowledge(projectId: string, query: string): Promise<KnowledgeSearchResponse | null> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length === 0) {
    return {
      query: normalizedQuery,
      results: [],
      searchedFiles: 0,
      truncated: false,
    };
  }

  const project = await getProject(projectId);
  if (!project) return null;

  const knowledgePaths = uniqueKnowledgePaths(project.manifest);
  const collected = await collectKnowledgeFiles(project.root, knowledgePaths);
  const results: KnowledgeSearchResult[] = [];
  const seen = new Set<string>();
  const documents: KnowledgeLineDocument[] = [];
  const queryLower = normalizedQuery.toLowerCase();
  let truncated = collected.truncated;

  for (const filePath of collected.files) {
    const content = await fs.readFile(resolveProjectPath(project.root, filePath), 'utf8').catch(() => '');
    if (!content) continue;

    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      const lineNumber = index + 1;
      const document: KnowledgeLineDocument = {
        id: `${filePath}:${String(lineNumber)}`,
        projectId: project.id,
        projectName: project.name,
        path: filePath,
        line: lineNumber,
        excerpt: excerptLine(line, normalizedQuery),
        content: line,
      };
      documents.push(document);

      if (results.length < maxSearchResults && line.toLowerCase().includes(queryLower)) {
        seen.add(document.id);
        results.push({
          projectId: document.projectId,
          projectName: document.projectName,
          path: document.path,
          line: document.line,
          excerpt: document.excerpt,
        });
      }
    }
  }

  if (results.length < maxSearchResults && documents.length > 0) {
    const index = new MiniSearch<KnowledgeLineDocument>({
      fields: ['path', 'content'],
      storeFields: ['projectId', 'projectName', 'path', 'line', 'excerpt'],
    });
    index.addAll(documents);

    for (const match of index.search(normalizedQuery, { prefix: true }).slice(0, maxSearchResults)) {
      if (results.length >= maxSearchResults) {
        truncated = true;
        break;
      }
      const id = String(match.id);
      if (seen.has(id)) continue;
      seen.add(id);
      results.push({
        projectId: String(match['projectId']),
        projectName: String(match['projectName']),
        path: String(match['path']),
        line: Number(match['line']),
        excerpt: String(match['excerpt']),
      });
    }
  }

  return {
    query: normalizedQuery,
    results,
    searchedFiles: collected.files.length,
    truncated,
  };
}

export async function listKnowledgeFiles(projectId: string, sort: KnowledgeListSort): Promise<KnowledgeListResponse | null> {
  const project = await getProject(projectId);
  if (!project) return null;

  const knowledgePaths = uniqueKnowledgePaths(project.manifest);
  const collected = await collectKnowledgeFiles(project.root, knowledgePaths);
  const contents = new Map<string, string>();

  await Promise.all(
    collected.files.map(async filePath => {
      const content = await fs.readFile(resolveProjectPath(project.root, filePath), 'utf8').catch(() => '');
      contents.set(filePath, content.toLowerCase());
    })
  );

  const items = await Promise.all(
    collected.files.map(async filePath => {
      const stat = await fs.stat(resolveProjectPath(project.root, filePath));
      const basename = path.basename(filePath).toLowerCase();
      const normalized = filePath.toLowerCase();
      let references = 0;

      for (const [otherPath, content] of contents) {
        if (otherPath === filePath) continue;
        references += countTextOccurrences(content, normalized);
        if (basename !== normalized) references += countTextOccurrences(content, basename);
      }

      return {
        projectId: project.id,
        projectName: project.name,
        path: filePath,
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
        references,
      };
    })
  );

  return {
    projectId: project.id,
    projectName: project.name,
    items: items.sort(compareKnowledgeItems(sort)),
    sort,
    truncated: collected.truncated,
  };
}

export async function previewKnowledgeFile(projectId: string, relPath: string): Promise<KnowledgePreview | null> {
  const project = await getProject(projectId);
  if (!project) return null;

  const normalizedPath = normalizeGitPath(relPath);
  const knowledgePaths = uniqueKnowledgePaths(project.manifest);
  if (!isKnowledgePathAllowed(normalizedPath, knowledgePaths) || !isSearchableFile(normalizedPath)) {
    throw new Error(`Knowledge preview path is not allowed: ${relPath}`);
  }

  const target = resolveProjectPath(project.root, normalizedPath);
  const stat = await fs.stat(target).catch(() => null);
  if (!stat?.isFile()) return null;

  const handle = await fs.open(target, 'r');
  try {
    const length = Math.min(stat.size, maxPreviewBytes);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, 0);
    return {
      projectId: project.id,
      projectName: project.name,
      path: normalizedPath,
      content: buffer.toString('utf8'),
      size: stat.size,
      truncated: stat.size > maxPreviewBytes,
      updatedAt: stat.mtime.toISOString(),
    };
  } finally {
    await handle.close();
  }
}

export function findRunnable(project: ProjectSummary, commandId: string): WorkflowCommand | WorkflowGate | null {
  return project.manifest.commands.find(command => command.id === commandId) ?? project.manifest.gates.find(gate => gate.id === commandId) ?? null;
}
