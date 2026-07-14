import { spawn } from 'node:child_process';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { runProjectCommand } from '../server/command-runner.js';
import {
  findRunnable,
  getProject,
  listKnowledgeFiles,
  listProjects,
  previewKnowledgeFile,
  searchKnowledge,
} from '../server/project-service.js';

type McpOptions = {
  project?: string;
};

const maxScriptOutput = 256_000;

function toolResult(payload: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function errorResult(message: string) {
  return toolResult({ status: 'error', error: message });
}

async function firstProjectId(): Promise<string | null> {
  const registry = await listProjects();
  return registry.projects[0]?.id ?? null;
}

async function resolveProjectId(projectId?: string): Promise<string | null> {
  return projectId?.trim() || (await firstProjectId());
}

async function projectRoot(projectId?: string): Promise<string | null> {
  const id = await resolveProjectId(projectId);
  if (!id) return null;
  const project = await getProject(id);
  return project?.root ?? null;
}

function runProjectScript(root: string, scriptPath: string, args: string[]): Promise<Record<string, unknown>> {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: root,
      shell: false,
      windowsHide: true,
    });
    const stdout: string[] = [];
    const stderr: string[] = [];

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout.push(String(chunk));
    });
    child.stderr.on('data', chunk => {
      stderr.push(String(chunk));
    });
    child.on('error', error => {
      resolve({ status: 'error', error: error.message });
    });
    child.on('close', exitCode => {
      const rawStdout = stdout.join('');
      const rawStderr = stderr.join('');
      const stdoutText = rawStdout.slice(0, maxScriptOutput);
      const stderrText = rawStderr.slice(0, maxScriptOutput);
      let parsed: unknown = null;
      try {
        parsed = stdoutText.trim() ? (JSON.parse(stdoutText) as unknown) : null;
      } catch {
        parsed = null;
      }
      resolve({
        status: exitCode === 0 ? 'ok' : 'error',
        exitCode,
        stdout: parsed ?? stdoutText,
        stderr: stderrText,
        truncated: rawStdout.length > maxScriptOutput || rawStderr.length > maxScriptOutput,
      });
    });
  });
}

export async function runMcpServer(options: McpOptions): Promise<void> {
  if (options.project) {
    process.env['AIKC_PROJECTS'] = path.resolve(options.project);
  }

  const server = new McpServer({
    name: 'ai-knowledge-center',
    version: '0.1.0',
  });

  const optionalProjectId = {
    projectId: z.string().optional().describe('AIKC project id. Defaults to the first configured project.'),
  };

  server.registerTool(
    'list_projects',
    {
      description: 'List AIKC projects visible in the current project scope.',
      inputSchema: {},
    },
    async () => {
      const registry = await listProjects();
      return toolResult(registry);
    }
  );

  server.registerTool(
    'get_project_manifest',
    {
      description: 'Return one project summary and its parsed ai-workflow.yaml manifest.',
      inputSchema: optionalProjectId,
    },
    async ({ projectId }) => {
      const id = await resolveProjectId(projectId);
      if (!id) return errorResult('No AIKC project is available.');
      const project = await getProject(id);
      return project ? toolResult(project) : errorResult(`Project not found: ${id}`);
    }
  );

  server.registerTool(
    'run_doctor',
    {
      description: 'Run the project AIKC doctor script with JSON output.',
      inputSchema: optionalProjectId,
    },
    async ({ projectId }) => {
      const root = await projectRoot(projectId);
      if (!root) return errorResult('No AIKC project is available.');
      return toolResult(await runProjectScript(root, 'ai-knowledge/scripts/doctor.cjs', ['--json']));
    }
  );

  server.registerTool(
    'get_context_pack',
    {
      description: 'Run the project context-pack script for a task and return the compact reading plan.',
      inputSchema: {
        ...optionalProjectId,
        task: z.string().min(1).describe('Task description used for context routing.'),
      },
    },
    async ({ projectId, task }) => {
      const root = await projectRoot(projectId);
      if (!root) return errorResult('No AIKC project is available.');
      return toolResult(await runProjectScript(root, 'ai-knowledge/scripts/context-pack.cjs', ['--task', task]));
    }
  );

  server.registerTool(
    'search_knowledge',
    {
      description: 'Search AI-facing knowledge files in one project.',
      inputSchema: {
        ...optionalProjectId,
        query: z.string().min(1),
      },
    },
    async ({ projectId, query }) => {
      const id = await resolveProjectId(projectId);
      if (!id) return errorResult('No AIKC project is available.');
      const result = await searchKnowledge(id, query);
      return result ? toolResult(result) : errorResult(`Project not found: ${id}`);
    }
  );

  server.registerTool(
    'preview_knowledge',
    {
      description: 'Preview an allowed AI-facing knowledge file.',
      inputSchema: {
        ...optionalProjectId,
        path: z.string().min(1).describe('Repository-relative knowledge file path.'),
      },
    },
    async ({ projectId, path: relPath }) => {
      const id = await resolveProjectId(projectId);
      if (!id) return errorResult('No AIKC project is available.');
      try {
        const result = await previewKnowledgeFile(id, relPath);
        return result ? toolResult(result) : errorResult(`Knowledge file not found: ${relPath}`);
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'list_skills',
    {
      description: 'List project skill files from ai-knowledge/skills.',
      inputSchema: optionalProjectId,
    },
    async ({ projectId }) => {
      const id = await resolveProjectId(projectId);
      if (!id) return errorResult('No AIKC project is available.');
      const project = await getProject(id);
      if (!project) return errorResult(`Project not found: ${id}`);
      const skillsRoot = project.manifest.knowledge.skills.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      const result = await listKnowledgeFiles(id, 'references');
      if (!result) return errorResult(`Project not found: ${id}`);
      return toolResult({
        projectId: id,
        skillsRoot,
        items: result.items.filter(item => item.path === skillsRoot || item.path.startsWith(`${skillsRoot}/`)),
      });
    }
  );

  server.registerTool(
    'run_manifest_command',
    {
      description: 'Run an allowlisted project command or gate from ai-workflow.yaml. Dangerous commands require confirmDangerous=true.',
      inputSchema: {
        ...optionalProjectId,
        commandId: z.string().min(1),
        confirmDangerous: z.boolean().default(false),
      },
    },
    async ({ projectId, commandId, confirmDangerous }) => {
      const id = await resolveProjectId(projectId);
      if (!id) return errorResult('No AIKC project is available.');
      const project = await getProject(id);
      if (!project) return errorResult(`Project not found: ${id}`);
      const command = findRunnable(project, commandId);
      if (!command) return errorResult(`Command not found in manifest: ${commandId}`);
      if (command.dangerous && !confirmDangerous) {
        return errorResult(`Command requires confirmDangerous=true: ${command.id}`);
      }
      const run = await runProjectCommand({
        projectId: project.id,
        projectRoot: project.root,
        command,
      });
      return toolResult(run);
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AI Knowledge Center MCP server running on stdio.');
}
