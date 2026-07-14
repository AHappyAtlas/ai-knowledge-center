import type {
  CommandRunRequest,
  CommandRunSummary,
  KnowledgeListResponse,
  KnowledgeListSort,
  KnowledgePreview,
  KnowledgeSearchResponse,
  ProjectSummary,
  RegistrySummary,
} from '../shared/api.js';

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    return String(payload.error);
  }
  return fallback;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = { error: text };
    }
  }
  if (!response.ok) {
    throw new Error(errorMessage(payload, response.statusText));
  }
  return payload as T;
}

export async function fetchProjects(): Promise<RegistrySummary> {
  return readJson<RegistrySummary>(await fetch('/api/projects'));
}

export async function fetchProject(projectId: string): Promise<ProjectSummary> {
  return readJson<ProjectSummary>(await fetch(`/api/projects/${encodeURIComponent(projectId)}`));
}

export async function runCommand(request: CommandRunRequest): Promise<CommandRunSummary> {
  return readJson<CommandRunSummary>(
    await fetch(`/api/projects/${encodeURIComponent(request.projectId)}/run/${encodeURIComponent(request.commandId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
  );
}

export async function searchKnowledge(projectId: string, query: string): Promise<KnowledgeSearchResponse> {
  const params = new URLSearchParams({ q: query });
  return readJson<KnowledgeSearchResponse>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/knowledge/search?${params.toString()}`));
}

export async function listKnowledge(projectId: string, sort: KnowledgeListSort): Promise<KnowledgeListResponse> {
  const params = new URLSearchParams({ sort });
  return readJson<KnowledgeListResponse>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/knowledge?${params.toString()}`));
}

export async function previewKnowledge(projectId: string, path: string): Promise<KnowledgePreview> {
  const params = new URLSearchParams({ path });
  return readJson<KnowledgePreview>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/knowledge/preview?${params.toString()}`));
}
