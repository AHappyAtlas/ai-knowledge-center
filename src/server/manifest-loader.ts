import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { workflowManifestSchema, type WorkflowManifest } from '../shared/manifest.js';

const manifestNames = ['ai-workflow.yaml', 'ai-workflow.yml'];

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readPackageScripts(projectRoot: string): Promise<Record<string, string>> {
  const packagePath = path.join(projectRoot, 'package.json');
  try {
    const raw = JSON.parse(await fs.readFile(packagePath, 'utf8')) as { scripts?: Record<string, string> };
    return raw.scripts ?? {};
  } catch {
    return {};
  }
}

function normalizeProjectId(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
}

async function inferManifest(projectRoot: string): Promise<WorkflowManifest> {
  const basename = path.basename(projectRoot);
  const scripts = await readPackageScripts(projectRoot);
  const gates: Array<Record<string, unknown>> = [];
  const commands: Array<Record<string, unknown>> = [];

  const addGate = (id: string, label: string, scriptName: string, category: WorkflowManifest['gates'][number]['category']) => {
    if (scripts[scriptName]) {
      gates.push({
        id,
        label,
        script: scriptName,
        packageManager: 'yarn',
        category,
        dangerous: false,
      });
    }
  };

  const addCommand = (id: string, label: string, scriptName: string, dangerous = false) => {
    if (scripts[scriptName]) {
      commands.push({
        id,
        label,
        script: scriptName,
        packageManager: 'yarn',
        dangerous,
      });
    }
  };

  addGate('precommit', 'Precommit Check', 'precommit:check', 'custom');
  addGate('lint', 'Lint', 'lint', 'lint');
  addGate('test', 'Test', 'test', 'test');
  addGate('test-unit', 'Unit Test', 'test:unit', 'test');
  addGate('security-audit', 'Security Audit', 'audit', 'security');
  addGate('typecheck', 'Typecheck', 'typecheck', 'typecheck');
  addGate('typecheck-panorama', 'Panorama Typecheck', 'typecheck:panorama', 'typecheck');
  addGate('typecheck-vscripts', 'VScript Typecheck', 'typecheck:vscripts', 'typecheck');
  addCommand('ai-start', 'AI Start', 'ai:start');
  addCommand('ai-closeout', 'AI Closeout', 'ai:closeout');

  return workflowManifestSchema.parse({
    id: normalizeProjectId(basename),
    name: basename,
    description: 'Auto-discovered project. Add ai-workflow.yaml to customize gates and links.',
    knowledge: {
      load: 'ai-knowledge/LOAD.md',
      core: 'ai-knowledge/core',
      aiLoad: 'ai-knowledge/ai/LOAD.md',
      skills: 'ai-knowledge/skills',
      skillIndex: 'ai-knowledge/skills/SKILL_INDEX.md',
      agentsFile: 'AGENTS.md',
      closeoutPrompt: 'ai-knowledge/core/LOAD-END.md',
    },
    commands,
    gates,
    dashboard: {
      watch: ['ai-knowledge', 'content/panorama/src', 'game/scripts/src'],
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
}

export async function loadManifest(projectRoot: string): Promise<{ manifest: WorkflowManifest; manifestPath: string; inferred: boolean }> {
  for (const name of manifestNames) {
    const manifestPath = path.join(projectRoot, name);
    if (!(await pathExists(manifestPath))) continue;

    const raw = YAML.parse(await fs.readFile(manifestPath, 'utf8')) as unknown;
    return {
      manifest: workflowManifestSchema.parse(raw),
      manifestPath,
      inferred: false,
    };
  }

  return {
    manifest: await inferManifest(projectRoot),
    manifestPath: path.join(projectRoot, 'ai-workflow.yaml'),
    inferred: true,
  };
}
