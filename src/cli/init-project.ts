import fs from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import { workflowManifestSchema } from '../shared/manifest.js';

function argValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

function normalizeProjectId(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
}

const projectRoot = path.resolve(argValue('--project') ?? process.cwd());
const basename = path.basename(projectRoot);
const manifestPath = path.join(projectRoot, 'ai-workflow.yaml');

const manifest = workflowManifestSchema.parse({
  id: normalizeProjectId(basename),
  name: basename,
  description: 'Project-provided AI workflow manifest.',
  knowledge: {
    load: 'ai-knowledge/LOAD.md',
    skills: 'ai-knowledge/skills',
    agentsFile: 'AGENTS.md',
    closeoutPrompt: 'ai-knowledge/prompt/任务收尾-Review并沉淀.md',
  },
  gates: [
    {
      id: 'precommit',
      label: 'Precommit Check',
      script: 'precommit:check',
      packageManager: 'yarn',
      category: 'custom',
    },
    {
      id: 'typecheck',
      label: 'Typecheck',
      script: 'typecheck',
      packageManager: 'yarn',
      category: 'typecheck',
    },
  ],
  commands: [
    {
      id: 'ai-start',
      label: 'AI Start',
      command: 'yarn ai:start --task "{task}"',
      description: 'Start the project AI workflow with a task prompt.',
    },
    {
      id: 'ai-closeout',
      label: 'AI Closeout',
      script: 'ai:closeout',
      packageManager: 'yarn',
    },
  ],
  dashboard: {
    watch: ['ai-knowledge'],
    links: [],
  },
  mcp: {
    servers: [],
  },
  telemetry: {
    enabled: true,
    serviceName: normalizeProjectId(basename),
    exporter: 'console',
  },
  dagger: {
    enabled: false,
    modulePath: '.',
  },
});

try {
  await fs.access(manifestPath);
  console.error(`Manifest already exists: ${manifestPath}`);
  process.exit(1);
} catch {
  await fs.writeFile(manifestPath, stringify(manifest), 'utf8');
  console.log(`Wrote ${manifestPath}`);
}
