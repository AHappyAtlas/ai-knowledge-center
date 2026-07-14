import fs from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { clientDistPath, stateRoot } from './paths.js';
import { findRunnable, getProject, listKnowledgeFiles, listProjects, previewKnowledgeFile, searchKnowledge } from './project-service.js';
import { runProjectCommand } from './command-runner.js';
import { setupTelemetry } from './telemetry.js';
import type { CommandRunRequest } from '../shared/api.js';

const port = Number(process.env['AIKC_PORT'] ?? 4318);
const host = process.env['AIKC_HOST'] ?? '127.0.0.1';

setupTelemetry();

const app = Fastify({
  logger: {
    level: process.env['AIKC_LOG_LEVEL'] ?? 'warn',
  },
});

if (fs.existsSync(clientDistPath)) {
  await app.register(fastifyStatic, {
    root: clientDistPath,
    prefix: '/',
  });
}

app.get('/api/health', () => ({
  ok: true,
  name: 'ai-knowledge-center',
  updatedAt: new Date().toISOString(),
}));

app.get('/api/projects', async () => listProjects());

app.get<{ Params: { projectId: string } }>('/api/projects/:projectId', async (request, reply) => {
  const project = await getProject(request.params.projectId);
  if (!project) {
    return reply.code(404).send({ error: `Project not found: ${request.params.projectId}` });
  }
  return project;
});

app.get<{ Params: { projectId: string }; Querystring: { sort?: string } }>('/api/projects/:projectId/knowledge', async (request, reply) => {
  const sort = request.query.sort === 'createdAt' || request.query.sort === 'updatedAt' || request.query.sort === 'references' ? request.query.sort : 'references';
  const result = await listKnowledgeFiles(request.params.projectId, sort);
  if (!result) {
    return reply.code(404).send({ error: `Project not found: ${request.params.projectId}` });
  }
  return result;
});

app.get<{ Params: { projectId: string }; Querystring: { q?: string } }>('/api/projects/:projectId/knowledge/search', async (request, reply) => {
  const result = await searchKnowledge(request.params.projectId, request.query.q ?? '');
  if (!result) {
    return reply.code(404).send({ error: `Project not found: ${request.params.projectId}` });
  }
  return result;
});

app.get<{ Params: { projectId: string }; Querystring: { path?: string } }>('/api/projects/:projectId/knowledge/preview', async (request, reply) => {
  if (!request.query.path) {
    return reply.code(400).send({ error: 'path is required' });
  }

  try {
    const result = await previewKnowledgeFile(request.params.projectId, request.query.path);
    if (!result) {
      return await reply.code(404).send({ error: `Knowledge file not found: ${request.query.path}` });
    }
    return result;
  } catch (error) {
    return await reply.code(403).send({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post<{ Params: { projectId: string; commandId: string }; Body: Partial<CommandRunRequest> }>(
  '/api/projects/:projectId/run/:commandId',
  async (request, reply) => {
    const project = await getProject(request.params.projectId);
    if (!project) {
      return reply.code(404).send({ error: `Project not found: ${request.params.projectId}` });
    }

    const command = findRunnable(project, request.params.commandId);
    if (!command) {
      return reply.code(404).send({ error: `Command not found: ${request.params.commandId}` });
    }

    if (command.dangerous && request.body.confirmDangerous !== true) {
      return reply.code(409).send({ error: `Command requires confirmDangerous=true: ${command.id}` });
    }

    return runProjectCommand({
      projectId: project.id,
      projectRoot: project.root,
      command,
    });
  }
);

app.setNotFoundHandler(async (request, reply) => {
  if (request.url.startsWith('/api/')) {
    return reply.code(404).send({ error: 'API route not found' });
  }

  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return reply.type('text/html').send(fs.createReadStream(indexPath));
  }

  return reply.code(404).send({ error: 'Client build not found. Run npm run build or use npm run dev.' });
});

try {
  await app.listen({ host, port });
  fs.mkdirSync(stateRoot, { recursive: true });
  fs.writeFileSync(
    path.join(stateRoot, 'server.pid.json'),
    `${JSON.stringify({ pid: process.pid, host, port, args: process.argv.slice(2), startedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8'
  );
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

function removePidFile(): void {
  try {
    fs.rmSync(path.join(stateRoot, 'server.pid.json'), { force: true });
  } catch {
    // Best-effort cleanup only.
  }
}

process.once('SIGINT', () => {
  removePidFile();
  process.exit(0);
});

process.once('SIGTERM', () => {
  removePidFile();
  process.exit(0);
});
