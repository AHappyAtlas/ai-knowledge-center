import type { WorkflowGate, WorkflowIntegration, WorkflowManifest } from './manifest.js';

export type GitSummary = {
  branch: string | null;
  head: string | null;
  shortHead: string | null;
  ahead: number;
  behind: number;
  changed: number;
  staged: number;
  conflicted: number;
  files: string[];
};

export type FileProbe = {
  path: string;
  exists: boolean;
};

export type KnowledgeRevision = {
  paths: string[];
  latestCommit: string | null;
  shortLatestCommit: string | null;
  latestAt: string | null;
  latestSubject: string | null;
  dirty: boolean;
  changedFiles: string[];
};

export type ProjectInitialization = {
  autoInit: boolean;
  initializedNow: boolean;
  missingBefore: boolean;
  createdFiles: string[];
};

export type GateStatus = {
  id: string;
  label: string;
  category: WorkflowGate['category'];
  command: string;
  lastRun: CommandRunSummary | null;
};

export type McpServerStatus = {
  id: string;
  label: string;
  type: string;
  configured: boolean;
  command: string | null;
  args: string[];
  scope: string;
  config: FileProbe | null;
  url: string | null;
  description: string | null;
};

export type TelemetryStatus = {
  enabled: boolean;
  serviceName: string;
  exporter: string;
  endpoint: string | null;
};

export type DaggerStatus = {
  enabled: boolean;
  module: FileProbe;
  pipeline: string | null;
  command: string | null;
  detected: boolean;
};

export type IntegrationStatus = WorkflowIntegration & {
  id: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  root: string;
  description: string | null;
  manifest: WorkflowManifest;
  manifestPath: string;
  initialization: ProjectInitialization;
  git: GitSummary;
  knowledge: {
    load: FileProbe;
    skills: FileProbe;
    closeoutPrompt: FileProbe | null;
    agentsFile: FileProbe;
    revision: KnowledgeRevision;
  };
  mcp: McpServerStatus[];
  integrations: IntegrationStatus[];
  telemetry: TelemetryStatus;
  dagger: DaggerStatus;
  watch: FileProbe[];
  gates: GateStatus[];
  links: Array<{ label: string; url: string }>;
  errors: string[];
  updatedAt: string;
};

export type RegistrySummary = {
  projects: ProjectSummary[];
  errors: string[];
  updatedAt: string;
};

export type KnowledgeSearchResult = {
  projectId: string;
  projectName: string;
  path: string;
  line: number;
  excerpt: string;
};

export type KnowledgeSearchResponse = {
  query: string;
  results: KnowledgeSearchResult[];
  searchedFiles: number;
  truncated: boolean;
};

export type KnowledgePreview = {
  projectId: string;
  projectName: string;
  path: string;
  content: string;
  size: number;
  truncated: boolean;
  updatedAt: string;
};

export type KnowledgeListSort = 'references' | 'updatedAt' | 'createdAt';

export type KnowledgeListItem = {
  projectId: string;
  projectName: string;
  path: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  references: number;
};

export type KnowledgeListResponse = {
  projectId: string;
  projectName: string;
  items: KnowledgeListItem[];
  sort: KnowledgeListSort;
  truncated: boolean;
};

export type CommandRunSummary = {
  id: string;
  projectId: string;
  commandId: string;
  label: string;
  command: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  traceId: string;
  aikcVersion: string;
  summary: string;
  residualRisk: string;
};

export type CommandRunRequest = {
  projectId: string;
  commandId: string;
  confirmDangerous?: boolean;
};

export type ApiError = {
  error: string;
};
