import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parse, stringify } from 'yaml';

type UpgradeAction = 'create' | 'unchanged' | 'conflict' | 'propose' | 'update' | 'skip' | 'handoff' | 'register';

type UpgradeReportItem = {
  path: string;
  action: UpgradeAction;
  note: string;
};

type UpgradeOptions = {
  projectRoot: string;
  write: boolean;
  force: boolean;
  ai: boolean;
};

const TEMPLATE_VERSION = '2026-06-22';

function userRegistryPath(): string {
  const stateRoot = path.resolve(process.env['AIKC_HOME'] ?? path.join(os.homedir(), '.ai-knowledge-center'));
  return path.join(stateRoot, 'config', 'projects.json');
}

function readOption(args: string[], name: string): string | null {
  const equalsPrefix = `${name}=`;
  const inline = args.find(arg => arg.startsWith(equalsPrefix));
  if (inline) return inline.slice(equalsPrefix.length);
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] ?? null;
  return null;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function normalizeProjectId(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(target: string): Promise<string | null> {
  try {
    return await fs.readFile(target, 'utf8');
  } catch {
    return null;
  }
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}

function mergeArrayById(existing: unknown, incoming: unknown): unknown[] {
  const current: unknown[] = Array.isArray(existing) ? Array.from(existing as unknown[]) : [];
  const additions: unknown[] = Array.isArray(incoming) ? Array.from(incoming as unknown[]) : [];
  const ids = new Set(current.map(item => (item && typeof item === 'object' && 'id' in item ? String((item as { id?: unknown }).id) : null)).filter(Boolean));

  for (const item of additions) {
    const id = item && typeof item === 'object' && 'id' in item ? String((item as { id?: unknown }).id) : null;
    if (!id || ids.has(id)) continue;
    current.push(item);
    ids.add(id);
  }

  return current;
}

function mergeStringArray(existing: unknown, incoming: unknown): string[] {
  const current = Array.isArray(existing) ? existing.filter((item): item is string => typeof item === 'string') : [];
  const values = Array.isArray(incoming) ? incoming.filter((item): item is string => typeof item === 'string') : [];
  const seen = new Set(current);
  for (const value of values) {
    if (!seen.has(value)) {
      current.push(value);
      seen.add(value);
    }
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeWorkflowYaml(existingText: string, templateText: string): string | null {
  const existing = parse(existingText) as unknown;
  const template = parse(templateText) as unknown;
  if (!isRecord(existing) || !isRecord(template)) return null;

  let changed = false;
  const merged: Record<string, unknown> = { ...existing };

  for (const key of ['schemaVersion', 'id', 'name', 'description', 'knowledge', 'mcp', 'telemetry', 'dagger']) {
    if (!(key in merged) && key in template) {
      merged[key] = template[key];
      changed = true;
    }
  }

  if (isRecord(template['integrations'])) {
    const currentIntegrations = isRecord(merged['integrations']) ? { ...merged['integrations'] } : {};
    for (const [id, integration] of Object.entries(template['integrations'])) {
      if (!(id in currentIntegrations)) {
        currentIntegrations[id] = integration;
        changed = true;
      }
    }
    merged['integrations'] = currentIntegrations;
  }

  if (isRecord(template['mcp'])) {
    const currentMcp = isRecord(merged['mcp']) ? { ...merged['mcp'] } : {};
    const nextServers = mergeArrayById(currentMcp['servers'], template['mcp']['servers']);
    if (JSON.stringify(nextServers) !== JSON.stringify(currentMcp['servers'] ?? [])) {
      currentMcp['servers'] = nextServers;
      changed = true;
    }
    if (Object.keys(currentMcp).length > 0) merged['mcp'] = currentMcp;
  }

  for (const key of ['commands', 'gates']) {
    const next = mergeArrayById(merged[key], template[key]);
    if (JSON.stringify(next) !== JSON.stringify(merged[key] ?? [])) {
      merged[key] = next;
      changed = true;
    }
  }

  if (isRecord(template['loops'])) {
    const currentLoops = isRecord(merged['loops']) ? { ...merged['loops'] } : {};
    for (const [id, loop] of Object.entries(template['loops'])) {
      if (!(id in currentLoops)) {
        currentLoops[id] = loop;
        changed = true;
      }
    }
    merged['loops'] = currentLoops;
  }

  const templateDashboard = isRecord(template['dashboard']) ? template['dashboard'] : {};
  const currentDashboard = isRecord(merged['dashboard']) ? { ...merged['dashboard'] } : {};
  const nextWatch = mergeStringArray(currentDashboard['watch'], templateDashboard['watch']);
  if (JSON.stringify(nextWatch) !== JSON.stringify(currentDashboard['watch'] ?? [])) {
    currentDashboard['watch'] = nextWatch;
    changed = true;
  }
  if (!('links' in currentDashboard) && 'links' in templateDashboard) {
    currentDashboard['links'] = templateDashboard['links'];
    changed = true;
  }
  if (Object.keys(currentDashboard).length > 0) merged['dashboard'] = currentDashboard;

  return changed ? stringify(merged) : existingText;
}

function loadMd(projectName: string): string {
  return [
    '# ${projectName} AI Knowledge Entry',
    '',
    '<!-- aikc-template-version: ${TEMPLATE_VERSION} -->',
    '',
    'User entrypoint:',
    '',
    '\u6309 ai-knowledge/LOAD.md \u6267\u884c, \u4efb\u52a1\uff1a<one sentence task>',
    '',
    'The agent must:',
    '',
    '1. Read `AGENTS.md`, this file, `ai-knowledge/core/LOAD.md`, and `ai-knowledge/ai/LOAD.md`.',
    '2. Run `node ai-knowledge/scripts/ensure-aikc-cli.cjs --upgrade`, then run `node ai-knowledge/scripts/ai-workflow-start.cjs --task "<task>"`.',
    '3. Run `node ai-knowledge/scripts/task-state.cjs status --json` before planning, after interruptions, and before final closeout.',
    '4. Read `ai-knowledge/skills/SKILL_INDEX.md` and load matching project skills.',
    '5. Read `ai-knowledge/core/knowledge-capture-policy.md` and make a task-start knowledge-capture precheck.',
    '6. Write task checkpoints with `node ai-knowledge/scripts/task-state.cjs checkpoint --phase "<phase>" --summary "<summary>" --next "<next>"` after planning, after meaningful edits, before validation, and when blocked.',
    '7. Never ask the user to manually run npm, yarn, pnpm, aikc, or knowledge scripts.',
    '8. After code, config, or knowledge changes, complete `ai-knowledge/core/LOAD-END.md` before final response.',
    '',
    'Do not rely on chat history alone for task memory. `.aikc/task-state/current.json` is the compact durable task state; recover with `node ai-knowledge/scripts/task-state.cjs resume --json` after interruption or context loss.',
    '',
    'Priority order:',
    '',
    '1. Current user request.',
    '2. Root `AGENTS.md`.',
    '3. `ai-knowledge/core/**` AIKC-maintained workflow.',
    '4. Matched `ai-knowledge/skills/**/SKILL.md`.',
    '5. `ai-workflow.yaml` commands, gates, dashboard, MCP, and telemetry.',
    '6. This file and `ai-knowledge/ai/LOAD.md` compatibility router.',
    '',
    'Knowledge capture rules:',
    '',
    '- Do not capture one-off chat history, unverified guesses, account data, secrets, tokens, or proxy subscription URLs.',
    '- `ai-knowledge/core/**` is AIKC-maintained workflow. Do not capture project-specific lessons there.',
    '- Reusable project constraints, failure modes, validation steps, deployment notes, and operation workflows must be judged by `ai-knowledge/core/knowledge-capture-policy.md`.',
    '- If knowledge is captured as a skill, update `ai-knowledge/skills/SKILL_INDEX.md`.',
    '- If no knowledge is captured after a non-read-only task, the final response must explain why.',
  ].join('\n').replaceAll('${projectName}', projectName).replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function aiLoadMd(): string {
  return [
    '# Agent Load - Stage 0',
    '',
    '<!-- aikc-template-version: ${TEMPLATE_VERSION} -->',
    '',
    'Compatibility router. AIKC-maintained core workflow lives in `ai-knowledge/core/LOAD.md`.',
    '',
    'User invoke: \u6309 ai-knowledge/LOAD.md \u6267\u884c, \u4efb\u52a1\uff1axxxxxx',
    '',
    '## Task Start',
    '',
    'Extract the text after \u4efb\u52a1\uff1a. Read `ai-knowledge/core/LOAD.md`. Then run:',
    '',
    'node ai-knowledge/scripts/ensure-aikc-cli.cjs --upgrade',
    'node ai-knowledge/scripts/ai-workflow-start.cjs --task "<task>"',
    'node ai-knowledge/scripts/task-state.cjs status --json',
    '',
    '`aikc:ensure` confirms the local `aikc` CLI is installed and current. Do not hand these commands to the user.',
    'After interruption, context compaction, or long tool sequences, recover from `.aikc/task-state/current.json` with `node ai-knowledge/scripts/task-state.cjs resume --json`.',
    '',
    '## Knowledge Capture Precheck',
    '',
    'At task start, read:',
    '',
    'ai-knowledge/core/knowledge-capture-policy.md',
    '',
    'Then decide:',
    '',
    '- Could this task produce a reusable constraint, failure mode, validation flow, deployment/operation step, or project convention?',
    '- If yes, is the likely target an existing skill, a new skill, or a reference file?',
    '- If no, why: one-off operation, already covered by existing skill, unverified guess, sensitive material, or no reuse value?',
    '',
    '## Required First Reply',
    '',
    '\u5df2\u8bfb\u53d6\u9879\u76ee\u7ea6\u675f\uff0c\u5c06\u6309\u672c\u9879\u76ee AI \u5de5\u4f5c\u6d41\u6267\u884c\u3002',
    '\u672c\u6b21\u4efb\u52a1\uff1a<task>',
    '\u5df2\u52a0\u8f7d\u5165\u53e3\uff1aAGENTS.md, ai-knowledge/LOAD.md, ai-knowledge/core/LOAD.md, ai-knowledge/ai/LOAD.md',
    '\u5c06\u81ea\u52a8\u6267\u884c\uff1aaikc:ensure, ai:start, \u5339\u914d skill, \u9002\u7528 gate, LOAD-END closeout',
    '\u77e5\u8bc6\u6c89\u6dc0\u9884\u5224\uff1a<\u53ef\u80fd\u6c89\u6dc0\u5230 skill/reference\uff0c\u6216\u8bf4\u660e\u6682\u4e0d\u6c89\u6dc0\u7684\u539f\u56e0>',
    '\u9700\u8981\u7528\u6237\u63d0\u4f9b\uff1a\u6682\u65e0',
    '',
    '## Skill Routing',
    '',
    'Read `ai-knowledge/skills/SKILL_INDEX.md` first. Load the matching `SKILL.md`.',
    '',
    '## Skill Generation Rule',
    '',
    'Create a new skill only when new reusable knowledge has a distinct trigger and workflow that does not fit an existing skill.',
    '',
    'New skill path:',
    '',
    'ai-knowledge/skills/<skill-id>/SKILL.md',
    '',
    'When creating a skill, also update `ai-knowledge/skills/SKILL_INDEX.md`.',
    '',
    'Do not create a skill mechanically for every task. Creation, update, or skip must be explained in the final response.',
    '',
    'Do not put project-specific lessons in `ai-knowledge/core`; core is upgraded from AIKC templates.',
  ].join('\n').replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function coreLoadMd(): string {
  return [
    '# AIKC Core Load - Stage 0',
    '',
    '<!-- aikc-template-version: ${TEMPLATE_VERSION} -->',
    '',
    'This file is AIKC-maintained core workflow. Project-specific knowledge belongs in `ai-knowledge/skills` or project references, not here.',
    '',
    '## Task Start',
    '',
    'When the user says `\u6309 ai-knowledge/LOAD.md \u6267\u884c, \u4efb\u52a1\uff1a...`:',
    '',
    '1. Extract the text after `\u4efb\u52a1\uff1a` as the task.',
    '2. Run `node ai-knowledge/scripts/ensure-aikc-cli.cjs --upgrade`.',
    '3. Run `node ai-knowledge/scripts/ai-workflow-start.cjs --task "<task>"`.',
    '4. Run `node ai-knowledge/scripts/task-state.cjs status --json` before planning, after interruptions, and before final closeout.',
    '5. Read `ai-knowledge/core/knowledge-capture-policy.md` and make a task-start knowledge-capture precheck.',
    '6. Read `ai-knowledge/skills/SKILL_INDEX.md`, then load only the matching project skills.',
    '7. Write task checkpoints with `node ai-knowledge/scripts/task-state.cjs checkpoint --phase "<phase>" --summary "<summary>" --next "<next>"` after planning, after meaningful edits, before validation, and when blocked.',
    '',
    'Do not ask the user to manually run npm, yarn, pnpm, aikc, or knowledge scripts.',
    'Do not rely on chat history alone for task memory. `.aikc/task-state/current.json` is the compact durable task state. If the conversation resumes after an interruption or context loss, run `node ai-knowledge/scripts/task-state.cjs resume --json` before continuing.',
    '',
    '## Ownership Boundary',
    '',
    '- `ai-knowledge/core/**` is upstream AIKC workflow and should be upgraded from AIKC templates.',
    '- `ai-knowledge/skills/**` is project-owned reusable knowledge.',
    '- `ai-knowledge/references/**` is project-owned support material unless a file explicitly says it is a compatibility wrapper for core.',
    '- `AGENTS.md` and `ai-workflow.yaml` may contain project-local rules and should be semantically merged during upgrades.',
    '',
    '## Skill Generation Rule',
    '',
    'Create a new project skill only when reusable knowledge has a distinct trigger and workflow that does not fit an existing skill.',
    '',
    'New project skill path:',
    '',
    '```text',
    'ai-knowledge/skills/<skill-id>/SKILL.md',
    '```',
    '',
    'When creating a skill, also update `ai-knowledge/skills/SKILL_INDEX.md`.',
    '',
    'Do not create a skill mechanically for every task. Creation, update, or skip must be explained in the final response.',
    '',
    '## Reusable Automation Rule',
    '',
    'When a task repeats an operation that future agents are likely to run again, prefer packaging it instead of re-explaining it in prompts.',
    '',
    'Choose the lightest durable form:',
    '',
    '- Project script: repeatable repository operation, validation gate, deployment helper, or local file transformation.',
    '- Project skill: reusable decision workflow, troubleshooting path, or domain procedure that still needs agent judgment.',
    '- MCP/server tool: structured operation that benefits from typed inputs, external state, permissions, or repeated tool calls.',
    '- Reference document: checklist or long explanation that supports a skill but is not directly executable.',
    '',
    'Separate execution environments before packaging:',
    '',
    '- Local host OS: Windows, macOS, or Linux where the Agent is currently running.',
    '- Remote target OS: Windows, macOS, or Linux reached through SSH, remoting, container exec, CI, or another transport.',
    '- Cross-platform path and shell behavior must be explicit. Prefer a small dispatcher script when local and remote OS differ.',
    '',
    'Good automation reduces token cost when it replaces repeated command discovery, long shell snippets, or fragile manual steps. Do not add automation for one-off work, secrets, unverified guesses, or operations that need a fresh human decision each time.',
    '',
    '## Token Efficiency Rule',
    '',
    'Use `ai-knowledge/core/token-efficiency.md` when tasks involve token/context cost, repeated diagnostics, long logs, project health checks, operations catalogs, doctor commands, or workflow-size concerns.',
    'Use `ai-knowledge/core/open-source-token-tools.md` when evaluating open-source skills or MCP servers for prompt-cache hits, semantic code retrieval, current docs lookup, or reusable token-saving workflow integrations.',
    '',
    'Default stance:',
    '',
    '- load the smallest useful context;',
    '- prefer summaries and structured output before raw logs;',
    '- cache low-frequency checks with explicit invalidation;',
    '- use operations indexes and doctor commands when repeated actions become numerous;',
    '- keep closeout compact and evidence-based.',
    '',
    '## Script Automation Rule',
    '',
    'Use `ai-knowledge/core/script-automation-policy.md` when the Agent repeats an operation or sees a repeated workflow emerging. AI workflow scripts belong in `ai-knowledge/scripts`, must be documented for human maintainers, and must be wired through exact `command` entries in `ai-workflow.yaml` instead of host-project `package.json` scripts.',
    '',
    '## Bounded Loop Rule',
    '',
    'Use `ai-knowledge/core/bounded-loop-policy.md` when a task creates or changes an Agent loop, recurring workflow, self-update path, review cycle, retry cycle, maintenance check, or autonomous automation. AIKC loops must be bounded: each loop needs an input, output, validation, budget, stop condition, and human escalation point.',
    '',
    '## Human-Readable Knowledge Rule',
    '',
    'Use `ai-knowledge/core/human-readable-knowledge-policy.md` when changing AI-facing knowledge, skills, human-readable companions, documentation, onboarding, or knowledge migrations. Agents should read compact AI-facing files by default and read `ai-knowledge/human/**` only for human documentation, explanation, review, or companion-update tasks.',
    '',
    '## Capability Reference',
    '',
    'Use `ai-knowledge/core/project-capabilities.md` when tasks touch AIKC project discovery, manifests, dashboard behavior, gates, commands, MCP, telemetry, Dagger, API automation, upgrade semantics, auto-initialization, or package release.',
    '',
    '## Open Source Usage Rule',
    '',
    'Use `ai-knowledge/core/open-source-usage.md` before hand-rolling functionality that mature packages already solve, especially CLI parsing, file discovery, search/indexing, schema/API contracts, logs, config/cache paths, watchers, retries, process execution, or MCP/server tooling.',
  ].join('\n').replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function loadEndMd(): string {
  return [
    '# Agent Load - Stage 1 Closeout',
    '',
    '<!-- aikc-template-version: ${TEMPLATE_VERSION} -->',
    '',
    'Read this before finishing any non-read-only task. Do not replace it with a short summary.',
    '',
    '## Mandatory Closeout',
    '',
    '1. Re-check the user request and the current diff. Confirm unrelated user work was not changed.',
    '2. Read `ai-knowledge/core/code-review-policy.md`, perform the review, and run `node ai-knowledge/scripts/code-review.cjs`.',
    '3. Run every applicable gate from `ai-workflow.yaml`. Knowledge-only changes must at least run `node ai-knowledge/scripts/knowledge-check.cjs`.',
    '4. Check V1-V5 in `ai-knowledge/core/task-closeout-verification.md`.',
    '5. Check R1-R13 in `ai-knowledge/core/task-closeout-risk-report.md`.',
    '6. Review changed knowledge entrypoints and confirm paths still point to real files.',
    '7. Read `ai-knowledge/core/knowledge-capture-policy.md` and make a knowledge-capture decision.',
    '8. If project knowledge is reusable and verified, update `ai-knowledge/skills` or project-owned `ai-knowledge/references`.',
    '9. If a new skill is created, add `ai-knowledge/skills/<skill-id>/SKILL.md` and update `ai-knowledge/skills/SKILL_INDEX.md`.',
    '10. If the task exposed a repeated operation, decide whether it should become a project script, skill, MCP/server tool, or reference. Consider local host OS and remote target OS separately.',
    '11. If the task exposed token waste, long logs, repeated diagnostics, or repeated health checks, decide whether to add summaries, structured output, caches, operations index entries, or a doctor command.',
    '12. If AI-facing knowledge or skills changed, read `ai-knowledge/core/human-readable-knowledge-policy.md` and update the human-readable companion only when the meaning changed.',
    '13. Do not put project-specific lessons into `ai-knowledge/core`.',
    '14. Final response must include the code review decision and the knowledge-capture decision: yes/no, location, and reason.',
    '15. Follow `ai-knowledge/core/human-friendly-task-summary.md` for final response shape.',
    '',
    'Read-only answers may skip builds, but still state that no code changed and validation is N/A.',
    'Non-read-only tasks are incomplete until code review and all applicable gates pass.',
    '',
    '## Reply Message Rules',
    '',
    '- Progress replies should be short and say what is being checked, changed, or validated.',
    '- Final replies for non-read-only work must include changed files, code review result, validation commands and results, remaining risk, knowledge-capture decision, and reusable automation/token-efficiency decision when applicable.',
    '- Use tables for final replies when any area contains multiple sub-items. Prefer rows over nested bullets for changed files, validation commands, knowledge decisions, automation candidates, cache decisions, and risks.',
    '- Final replies must not paste secrets, account data, subscription URLs, raw tokens, or long logs.',
    '- If validation or publishing failed, the final reply must say the exact command that failed and the remaining risk.',
    '- If no files changed, say validation is N/A or list the read-only checks that were run.',
    '',
    'If knowledge should have been captured but was not, the task is not complete.',
    'If a repeated operation was observed but no automation packaging decision was reported, the task is not complete.',
  ].join('\n').replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function humanFriendlySummaryMd(): string {
  return [
    '# Human-Friendly Task Summary',
    '',
    '<!-- aikc-template-version: ${TEMPLATE_VERSION} -->',
    '',
    'Replies are part of the workflow contract. Keep them short, concrete, and honest.',
    '',
    '## Progress Replies',
    '',
    '- Say what is being inspected, changed, or validated.',
    '- Mention blockers as soon as they are known.',
    '- Do not paste secrets, account data, subscription URLs, raw tokens, or long logs.',
    '',
    '## Final Replies',
    '',
    'Recommended shape:',
    '',
    'Conclusion: one sentence explaining what changed or what is blocked.',
    '',
    '| Area | Item | Status | Details |',
    '| --- | --- | --- | --- |',
    '| Changed | `path/a` | changed | What changed and why. |',
    '| Code review | `node ai-knowledge/scripts/code-review.cjs` | passed/failed/N/A | Review decision and notable finding. |',
    '| Validation | `command` | passed/failed/not run | Reason, failure summary, or skipped-check explanation. |',
    '| Knowledge capture | `ai-knowledge/...` or N/A | yes/no | Reusable lesson captured, or why not. |',
    '| Automation/efficiency | script/skill/MCP/reference/cache/doctor/N/A | yes/no | Repeated operation, token saving, or why no packaging was warranted. |',
    '| Risk | item | none/low/medium/high | What remains for the user to know or confirm. |',
    '',
    'Rules:',
    '',
    '- Non-read-only tasks must mention changed files, code review, validation, remaining risk, and knowledge-capture decision.',
    '- Use a table when an area has more than one sub-item, repeated command, skipped check, or risk. It is acceptable to repeat the same `Area` value across rows.',
    '- Keep table cells compact; put long logs, stack traces, or transcripts behind a referenced file, command, or summary instead of pasting them.',
    '- Mention reusable automation or token-efficiency decisions when the task exposed repeated operations, long commands, repeated diagnostics, expensive context, or wasted context.',
    '- Build failures cannot be reported as complete; include the failed command and residual risk.',
    '- Publish failures cannot be reported as complete; include the package/version and failed command.',
    '- Explain skipped checks.',
    '- Do not paste secrets, accounts, subscription URLs, or long logs into the final reply.',
    '- If no files changed, state that the task was read-only and validation is N/A or list the checks performed.',
    '',
    '## Multi-Item Tables',
    '',
    'When a section has many sub-items, prefer one table per concern rather than deeply nested bullets.',
    '',
    '| Table | Columns | Use When |',
    '| --- | --- | --- |',
    '| Changed files | `File`, `Status`, `Reason` | More than two files changed, or files have different purposes. |',
    '| Validation | `Command`, `Status`, `Evidence`, `Residual risk` | Multiple gates, skipped checks, or failures. |',
    '| Knowledge and automation | `Decision`, `Location`, `Trigger`, `Reason` | Reusable knowledge, script candidates, MCP/tool candidates, cache candidates, or explicit no-capture decisions. |',
    '| Remaining risk | `Risk`, `Level`, `Owner/Next check` | There are several caveats or user-visible follow-ups. |',
  ].join('\n').replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function verificationMd(): string {
  return [
    '# Task Closeout Verification',
    '',
    '<!-- aikc-template-version: ${TEMPLATE_VERSION} -->',
    '',
    'Report V1-V5 before finishing non-read-only tasks.',
    '',
    '| ID | Item | Applies When | Passing Signal |',
    '| --- | --- | --- | --- |',
    '| V1 | Knowledge check | Any AI knowledge or workflow change | `node ai-knowledge/scripts/knowledge-check.cjs` exits 0 |',
    '| V2 | Typecheck/build | Source code or config changed | The project typecheck/build gate exits 0 |',
    '| V3 | Artifact/build output | Generated assets, bundles, docs, or release artifacts changed | Artifacts are regenerated and no stale/missing output remains |',
    '| V4 | Runtime/performance/load | Server, background task, polling, broadcast, or hot path changed | No unexplained errors or load regressions in the relevant check |',
    '| V5 | Code review | Any non-read-only task | `node ai-knowledge/scripts/code-review.cjs` exits 0 and the Agent reports a review decision |',
    '',
    'Use the real command for the changed surface. Do not invent pass results.',
  ].join('\n').replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function riskReportMd(): string {
  return "# Task Closeout Risk Report\n\n<!-- aikc-template-version: ${TEMPLATE_VERSION} -->\n\nReport R1-R13 before finishing non-read-only tasks.\n\n| ID | Dimension | Check |\n| --- | --- | --- |\n| R1 | Build/typecheck | Did the selected V1-V5 gates run, or is the reason for skipping explicit? |\n| R2 | Frontend/UI | Did UI/API-client changes build, avoid overlap, and preserve existing workflow ergonomics? |\n| R3 | Backend/runtime | Did service, polling, broadcast, cache, or hot-path changes avoid unnecessary load? |\n| R4 | Shared state/critical path | Did changes avoid corrupting accounts, sessions, queues, cluster state, and ownership boundaries? |\n| R5 | Operational regression | Are important user workflows and deployment scenarios considered when relevant? |\n| R6 | Secrets/network | Did output and docs avoid secrets, broad host binding, risky proxy/TUN changes, and exposed paths? |\n| R7 | Knowledge loop | Did reusable, verified lessons get added to skills or references when warranted, and did the final response explain why? |\n| R8 | Diff scope | Are unrelated uncommitted changes preserved and ignored unless directly required? |\n| R9 | Reusable automation | Did repeated operations get evaluated for packaging as scripts, skills, MCP/server tools, or references with local/remote OS boundaries? |\n| R10 | Token efficiency | Did long logs, repeated diagnostics, health checks, or workflow-size problems get evaluated for summaries, structured output, caches, operations indexes, or doctor commands? |\n| R11 | Code review | Did review inspect correctness, tests, security, operations, docs, maintainability, and unresolved findings before completion? |\n| R12 | Bounded loops | Did any new or changed loop define input, output, validation, budget, stop condition, and human escalation? |\n| R13 | Human-readable knowledge | Did AI-facing knowledge or skill changes update, skip, or backfill the human-readable companion intentionally? |\n\nUse clear labels: passed, failed, skipped, or N/A. Explain any skipped check.".replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function codeReviewPolicyMd(): string {
  return [
    '# Code Review Policy',
    '',
    '<!-- aikc-template-version: ${TEMPLATE_VERSION} -->',
    '',
    'Code review is a required completion gate for every non-read-only task. A task is not done until the code review decision and all applicable gates pass.',
    '',
    '## Review Standard',
    '',
    '- Require a review before merge or completion, similar to required pull request reviews.',
    '- Require checks to pass, similar to required status checks.',
    '- Review the change for correctness, design, maintainability, tests, security, operations, and documentation.',
    '- Prefer actionable comments with severity and location when issues remain.',
    '',
    '## Required Review Steps',
    '',
    '1. Re-read the user request and compare it with the actual changed files.',
    '2. Inspect the diff or changed files for behavior regressions, missing validation, unsafe filesystem/network changes, secrets, and unrelated edits.',
    '3. Confirm unresolved upgrade candidates such as `*.aikc-upgrade.md` are either semantically merged or intentionally left with a clear reason.',
    '4. Run `node ai-knowledge/scripts/code-review.cjs`.',
    '5. Run all applicable gates from `ai-workflow.yaml`.',
    '6. If any review issue or gate fails, fix it and rerun review plus gates before final response.',
    '',
    '## Final Response Requirement',
    '',
    '- Code review: passed/failed/skipped, command run, and review decision.',
    '- Gates: commands run and results.',
    '- Remaining risk: no known risk or specific residual risk.',
    '',
    'Read-only tasks may mark code review as N/A and explain why.',
  ].join('\n').replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function agentsMd(projectName: string): string {
  return [
    '# ${projectName} Agent Guide',
    '',
    '<!-- aikc-template-version: ${TEMPLATE_VERSION} -->',
    '',
    '## Start',
    '',
    '- When the user says \u6309 ai-knowledge/LOAD.md \u6267\u884c, \u4efb\u52a1\uff1a..., read `ai-knowledge/LOAD.md` first, then `ai-knowledge/core/LOAD.md`, then `ai-knowledge/ai/LOAD.md`.',
    '- Run declared workflow scripts yourself. Do not ask the user to manually run npm, yarn, pnpm, aikc, or knowledge scripts.',
    '- Treat `ai-workflow.yaml` as the project manifest for knowledge entrypoints, gates, MCP, telemetry, and dashboard metadata.',
    '- Treat `ai-knowledge/core/**` as AIKC-maintained core workflow. Project-specific reusable knowledge belongs in `ai-knowledge/skills/**` or project-owned references.',
    '',
    '## Constraints',
    '',
    '- Never overwrite existing human docs, project config, or uncommitted work.',
    '- Understand the current structure and owners before changing code or docs.',
    '- Run applicable gates before declaring completion.',
    '- Preserve the documented ability to disable telemetry export with `AIKC_TELEMETRY_EXPORTER=none` when telemetry exists.',
    '',
    '## Knowledge Capture',
    '',
    '- Every non-read-only task must include a knowledge-capture decision: whether a skill/reference was added or updated, and why.',
    '- Add durable lessons to `ai-knowledge/skills` only when they are reusable project knowledge, not one-off chat history.',
    '- Do not store project-specific lessons in `ai-knowledge/core/**`; core files are upgraded from AIKC templates.',
    '- If no lesson is added, state the reason in the final response.',
    '- If a new skill is created, update `ai-knowledge/skills/SKILL_INDEX.md` in the same change.',
    '',
    '## Closeout',
    '',
    '- Before final response after non-read-only work, read and follow `ai-knowledge/core/LOAD-END.md`.',
    '- Final response must list changed files, validation run, remaining risk, and knowledge-capture decision.',
  ].join('\n').replaceAll('${projectName}', projectName).replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function knowledgeCapturePolicyMd(): string {
  return [
    '# Knowledge Capture Policy',
    '',
    '<!-- aikc-template-version: ${TEMPLATE_VERSION} -->',
    '',
    'Use this policy at task start and closeout.',
    '',
    '## Capture When',
    '',
    'Capture knowledge when a task produces any reusable, verified item:',
    '',
    '- A project constraint that future agents must obey.',
    '- A repeated failure mode and its proven fix.',
    '- A validation command, gate, or environment caveat.',
    '- A deployment, runtime, cluster, proxy, login, or operational workflow that is likely to recur.',
    '- A stable UI/backend contract or state-machine rule.',
    '- A repeated local or remote operation that should become a script, skill, MCP/server tool, or reference to reduce future token and command-discovery cost.',
    '',
    '## Where To Capture',
    '',
    '- Update an existing `ai-knowledge/skills/**/SKILL.md` when the lesson fits its trigger.',
    '- Create `ai-knowledge/skills/<skill-id>/SKILL.md` when the knowledge has a distinct trigger and workflow. Also update `ai-knowledge/skills/SKILL_INDEX.md`.',
    '- Keep `SKILL.md` files compact and trigger-oriented for AI token efficiency.',
    '- Add or update `ai-knowledge/human/skills/<skill-id>.md` only when the corresponding skill meaning changes or a missing companion is being backfilled.',
    '- Use project-owned `ai-knowledge/references/*.md` for checklists, templates, long explanations, or decision policies that support skills.',
    '- Add or update project scripts when the reusable lesson is executable and repeatable.',
    '- Add MCP/server tools when the reusable operation needs typed inputs, permission boundaries, external state, or many repeated tool calls.',
    '- Do not capture project-specific lessons in `ai-knowledge/core`; core is AIKC-maintained workflow.',
    '',
    '## Automation Packaging Decision',
    '',
    'Before adding a new script, skill, or MCP/server tool, identify:',
    '',
    '- Local host OS: Windows, macOS, or Linux.',
    '- Remote target OS, when applicable: Windows, macOS, Linux, container, CI, or unknown.',
    '- Transport: local shell, SSH, PowerShell remoting, Docker, API, MCP, or CI runner.',
    '- Stable inputs and outputs.',
    '- Validation command and failure signal.',
    '',
    'Prefer small scripts for deterministic command sequences, skills for judgment-heavy workflows, and MCP/server tools for structured operations that are called often.',
    '',
    '## Do Not Capture',
    '',
    'Do not capture:',
    '',
    '- One-off chat transcripts or temporary task narration.',
    '- Unverified guesses.',
    '- Secrets, account credentials, session data, proxy subscription URLs, tokens, or private runtime dumps.',
    '- Ephemeral values such as current process IDs, temporary ports, transient queue contents, or today\'s node health unless they reveal a durable rule.',
    '',
    '## Required Final Decision',
    '',
    'Every non-read-only final response must include:',
    '',
    '\u77e5\u8bc6\u6c89\u6dc0: yes/no',
    'Location: ai-knowledge/... or N/A',
    'Reason: why it was captured or why it was not captured',
    '',
    'If knowledge should have been captured but was not, the task is not complete.',
  ].join('\n').replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function scriptAutomationPolicyMd(): string {
  return [
    '# Script Automation Policy',
    '',
    '<!-- aikc-template-version: ${TEMPLATE_VERSION} -->',
    '',
    'Repeated Agent operations should become maintained AI knowledge scripts when doing so reduces repeated discovery, long prompts, fragile shell snippets, or token-heavy troubleshooting.',
    '',
    '## When To Script',
    '',
    'Create or update a script when an operation is expected to repeat and has stable inputs, validation, or failure handling. Common candidates:',
    '',
    '- project health checks, doctor commands, and environment verification;',
    '- upgrade, migration, release, and package-publish preparation;',
    '- log summarization, config normalization, and generated-file validation;',
    '- cross-platform local/remote operation wrappers;',
    '- MCP setup checks and dashboard gate runners.',
    '',
    'Do not script one-off judgment calls, secrets, unverified guesses, or operations that require fresh human approval each time.',
    '',
    '## Script Standards',
    '',
    '- support `--help` for non-trivial scripts;',
    '- support `--dry-run` before destructive or broad changes;',
    '- prefer explicit named flags over positional arguments when ambiguity is likely;',
    '- print concise, structured summaries by default, with verbose output behind a flag;',
    '- be idempotent where possible;',
    '- use safe defaults and fail closed;',
    '- separate local host OS behavior from remote target OS behavior;',
    '- document required environment variables without printing secret values.',
    '',
    '## Agent Responsibilities',
    '',
    '1. Decide whether the operation should become a script, skill, MCP/server tool, or reference.',
    '2. Discover required parameters from existing project config, environment, manifests, and files before asking the user.',
    '3. Add or update the script under `ai-knowledge/scripts` when it is AI workflow automation.',
    '4. Add human-facing usage notes to `ai-knowledge/scripts/README.md`.',
    '5. Register runnable commands or gates in `ai-workflow.yaml` using exact `command` entries, not host-project package scripts.',
    '6. Add validation to `ai-knowledge/scripts/knowledge-check.cjs` when the script becomes part of the core workflow contract.',
    '7. During upgrades, preserve project-specific scripts and semantically merge AIKC-maintained scripts.',
    '',
    'Host project `package.json` must not be used as the registry for AIKC internal workflow scripts.',
    '',
    '## Automation Candidate Table',
    '',
    'During closeout, report every repeated operation or script-worthy opportunity in a compact table, even when the decision is "no script".',
    '',
    '| Operation | Evidence | Decision | Location | Reason |',
    '| --- | --- | --- | --- | --- |',
    '| Brief operation name | Repeated command, long diagnostic, fragile shell snippet, or recurring project workflow | script/skill/MCP/reference/cache/doctor/no | `ai-knowledge/...` or N/A | Why this packaging is or is not worth it |',
    '',
    'Use this table when the task involved repeated shell commands, long commands, manual log filtering, status summarization, config normalization, generated-file validation, setup, upgrade, release, deployment, rollback, health checks, or repeated context loading.',
  ].join('\n').replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function boundedLoopPolicyMd(): string {
  return [
    '# Bounded Loop Policy',
    '',
    '<!-- aikc-template-version: ${TEMPLATE_VERSION} -->',
    '',
    'Use bounded loops for AI workflow automation. AIKC should prefer explicit, verifiable loops over open-ended autonomous agents.',
    '',
    '## Loop Contract',
    '',
    'Every loop must define input, output, validation, budget, stop condition, and human escalation.',
    '',
    'If any of these fields cannot be stated, keep the workflow as a human-guided task instead of an automated loop.',
    '',
    '## Preferred Loops',
    '',
    '- Task loop: load knowledge, act, verify, review, capture reusable knowledge, then respond.',
    '- Upgrade loop: update AIKC, preserve project knowledge, merge candidates, validate manifests, and restart running Web when needed.',
    '- Review loop: inspect changed behavior, run gates, fix findings, and repeat until code review and applicable gates pass.',
    '- Knowledge loop: decide whether a lesson is reusable, put project-specific knowledge in skills or references, and keep AIKC-maintained workflow in core.',
    '- Automation loop: when repeated operations appear, package them as scripts, skills, MCP/server tools, or references with local and remote OS boundaries.',
    '- Maintenance loop: check package version, core template drift, project registration, Web process health, and manifest validity.',
    '',
    '## Anti-Patterns',
    '',
    '- Do not run indefinite autonomous loops without a budget and stop condition.',
    '- Do not let a loop overwrite human docs, local config, project knowledge, or uncommitted work blindly.',
    '- Do not hide failed validation behind a summarized success message.',
    '- Do not keep retrying commands after the same blocker repeats; escalate with evidence.',
    '- Do not use loop automation for secrets, destructive operations, broad network exposure, or decisions that require fresh human judgment.',
    '',
    '## Manifest Guidance',
    '',
    'When a loop becomes durable project behavior, describe it in `ai-workflow.yaml` using exact commands, gates, watched paths, or dashboard metadata. Keep executable AI workflow helpers inside `ai-knowledge/scripts`, not host project `package.json`, unless the command belongs to the host project build, test, or runtime surface.',
  ].join('\n').replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function humanReadableKnowledgePolicyMd(): string {
  return [
    '# Human-Readable Knowledge Policy',
    '',
    '<!-- aikc-template-version: ${TEMPLATE_VERSION} -->',
    '',
    'AIKC knowledge should have two layers:',
    '',
    '- AI-facing knowledge: compact, trigger-oriented, and optimized for minimal token loading.',
    '- Human-readable knowledge: explanatory, reviewable, and suitable for maintainers who need context without reading every AI prompt.',
    '',
    '## Storage Layout',
    '',
    '- Keep AI-facing entrypoints in `ai-knowledge/LOAD.md`, `ai-knowledge/ai/LOAD.md`, `ai-knowledge/core/LOAD.md`, and `ai-knowledge/skills/**/SKILL.md`.',
    '- Keep human-readable companions under `ai-knowledge/human/**`.',
    '- Use `ai-knowledge/human/README.md` as the human entrypoint.',
    '- For each project skill at `ai-knowledge/skills/<skill-id>/SKILL.md`, add a companion at `ai-knowledge/human/skills/<skill-id>.md`.',
    '- Use `ai-knowledge/human/core-workflow.md` for the human overview of AIKC-maintained core workflow.',
    '',
    '## Update Rule',
    '',
    'Update human-readable companions only when the corresponding AI-facing knowledge, skill, or workflow meaning changes.',
    '',
    'Do not rewrite human docs for mechanical formatting, generated timestamps, one-off task chatter, or runtime-only values.',
    '',
    '## AI Reading Rule',
    '',
    'Agents should load the compact AI-facing layer first and avoid reading human-readable companions unless the user asks for explanation, docs, onboarding, review, or a companion update.',
    '',
    '## Backfill Rule',
    '',
    'When existing skills or durable knowledge have no human-readable companion, add one during the next relevant knowledge, documentation, or workflow upgrade task.',
  ].join('\n').replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function tokenEfficiencyMd(): string {
  return [
    '# Token Efficiency Policy',
    '',
    '<!-- aikc-template-version: ${TEMPLATE_VERSION} -->',
    '',
    'Use this policy to reduce repeated context, command discovery, and verbose output in AIKC-managed projects.',
    '',
    '## Minimal Context Loading',
    '',
    '- Load compact entrypoints first: `ai-knowledge/LOAD.md`, `ai-knowledge/core/LOAD.md`, `ai-knowledge/ai/LOAD.md`, and `ai-knowledge/skills/SKILL_INDEX.md`.',
    '- Load only matched `SKILL.md` files. Do not recursively read all skills or references.',
    '- Do not load `ai-knowledge/human/**` by default. Human-readable companions are for explanation, review, onboarding, and companion-update tasks.',
    '- Keep long explanations, examples, and checklists in references; read them only when a skill or task explicitly needs them.',
    '- At task start, state the expected context scope when the task is broad or knowledge-heavy.',
    '- Keep `.aikcignore` current and apply it consistently in context planning, repo maps, diagnostics, and MCP file previews.',
    '',
    '## Stable Cache Prefix',
    '',
    '- Keep stable workflow instructions before task-specific content in prompts and generated context packs.',
    '- Put volatile details such as task text, timestamps, logs, diffs, command output, and runtime state after stable entrypoints and matched skills.',
    '- Avoid inserting generated timestamps, random ordering, or full raw logs into stable context. These reduce prompt-cache hits.',
    '- Use file hashes or mtimes to detect whether low-frequency context really changed before re-reading it.',
    '',
    '## Summaries Before Raw Logs',
    '',
    '- Prefer scripts or tools that summarize long logs, CI output, health checks, and runtime status before the Agent reads them.',
    '- Summaries should include stable fields such as status, failed step, error code, relevant file, timestamp, and next likely action.',
    '- Keep raw logs available for drilldown, but do not paste or load them by default.',
    '- Default log reads to the newest 100 lines. Reading more than 300 lines or any full watch/dev log needs a concrete reason such as an error timestamp, pattern, or failing step.',
    '- Use `node ai-knowledge/scripts/log-summary.cjs --file "<log>" --lines 100 --json` before asking an Agent to inspect long local logs or captured command output.',
    '- Use `node ai-knowledge/scripts/run-bounded.cjs --json -- <command>` for commands that may emit long build, test, watch, or diagnostic output.',
    '',
    '## Structured Tool Output',
    '',
    '- Prefer JSON or small tables for reusable status and diagnostic scripts.',
    '- Useful fields include `status`, `changedFiles`, `failedChecks`, `warnings`, `nextAction`, and `evidence`.',
    '- Stable structured output is cheaper than natural-language command transcripts and easier for agents to compare across runs.',
    '',
    '## Low-Frequency Caches',
    '',
    '- Cache expensive or low-drift checks with file hashes or mtimes.',
    '- Good cache candidates: skill index scan, template version check, manifest health, environment detection, installed CLI version, and known project gates.',
    '- Invalidate caches when core entrypoints, `AGENTS.md`, `ai-workflow.yaml`, `SKILL_INDEX.md`, or related scripts change.',
    '',
    '## Operations Directory',
    '',
    'Projects may add an `ai-knowledge/operations/INDEX.md` when repeated actions become numerous.',
    '',
    'Each operation entry should point to the script, skill, MCP/server tool, or reference that owns it.',
    '',
    '## Doctor Command',
    '',
    'Prefer a project doctor command when setup or health checks become repeated. It should verify core files, AI knowledge scripts, host project scripts when relevant, unresolved upgrade candidates, skill index links, gates, and last known failures.',
    '',
    '## Repo Map',
    '',
    'Prefer `node ai-knowledge/scripts/repo-map.cjs --write --query "<task>"` before broad code exploration. The repo map should store `.aikc/index/repo-map.json` with file hashes, imports, exported symbols, and task-ranked recommendations. Agents should use the repo map before broad recursive reads.',
    '',
    '## Workflow Observations',
    '',
    'Use `node ai-knowledge/scripts/observe-workflow.cjs --phase start|end --task "<task>" --json` to record compact cross-session metrics. Observations belong in JSONL files under `.aikc/observability/` and the user-level AIKC observations directory. Store budgets, gate status, checkpoint counts, bounded-run sizes, repo-map metadata, and upgrade-candidate counts; do not store chat transcripts, secrets, full logs, or raw command output.',
    '',
    '## Fixed Closeout Shape',
    '',
    'Final replies should stay compact: conclusion, changed files, validation, knowledge capture decision, reusable automation decision when applicable, and remaining risk.',
    '',
    '## Context Pack Command',
    '',
    'Prefer `node ai-knowledge/scripts/context-pack.cjs --task "<task>"` when a task is broad, knowledge-heavy, or explicitly mentions token/context cost. Use `--summary` at task start or after interruptions when the Agent only needs the recommended file list, budget, and output policy. Use `--enforce --max-total-tokens <n>` when a workflow should fail rather than silently exceed the budget. Context packs should group files into `stablePrefixFiles`, `taskFiles`, `deferredFiles`, `avoidByDefault`, `toolOutputPolicy`, and `logReadPolicy`. For each concrete file, include a small token estimate and a content hash or mtime when cheap to compute.',
    '',
    '## Do Not Optimize Blindly',
    '',
    'Do not add scripts, caches, or tools for one-off operations. Token savings should preserve correctness, evidence, and rollback clarity.',
    '',
    '## Bound The Loop',
    '',
    'Token-efficient loops are bounded loops. Before repeating an Agent action, retry, review cycle, upgrade cycle, or maintenance check, confirm the loop has an input, output, validation, budget, stop condition, and human escalation point as described in `ai-knowledge/core/bounded-loop-policy.md`.',
  ].join('\n').replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function projectCapabilitiesMd(): string {
  return [
    '# AIKC Project Capabilities',
    '',
    '<!-- aikc-template-version: ${TEMPLATE_VERSION} -->',
    '',
    'Use this file when a task touches AIKC project setup, dashboard metadata, workflow manifests, gates, MCP, integrations, telemetry, Dagger, project discovery, upgrade behavior, or package lifecycle.',
    '',
    '## Core Runtime Shape',
    '',
    '- AIKC is distributed as the global npm CLI `aikc` / `ai-knowledge-center`.',
    '- AIKC can also run as a stdio MCP server with `aikc mcp --project <path>` for agent clients that need structured access to manifests, doctor, context-pack, knowledge search, skills, and allowlisted commands.',
    '- Production serves the dashboard UI and `/api/*` from one Fastify process and one local port, default `127.0.0.1:4318`.',
    '- `aikc` starts the server in the background by default and keeps request logging quiet; use `--foreground --log-level info` for debugging and `aikc stop` to stop the background server.',
    '- When `node ai-knowledge/scripts/ensure-aikc-cli.cjs` updates the global CLI and a background `aikc` Web process is already running, it should restart that process automatically so the dashboard uses the new package.',
    '- Development may use Vite for the UI and Fastify for the API, but generated project workflows should not assume a separate frontend host.',
    '- Binding to `0.0.0.0` or broad network exposure is intentional operational work and should not be introduced casually.',
    '',
    '## Project Discovery',
    '',
    '- Projects can come from `--projects`, `AIKC_PROJECTS`, config dir, `projects.json`, persisted user registry entries, or workspace auto-discovery.',
    '- `aikc upgrade --project <path> --write` registers the project in `~/.ai-knowledge-center/config/projects.json` without replacing existing entries.',
    '- Auto-discovery can fall back to the current directory, configured workspace, or common local code folders when no registry entries exist.',
    '- Project initialization must not overwrite human docs, local config, or uncommitted project work.',
    '- Project registration must merge with the user registry and preserve existing entries.',
    '',
    '## Manifest Contract',
    '',
    '`ai-workflow.yaml` is the project manifest for knowledge entrypoints, gates, commands, dashboard watched paths and links, MCP metadata, optional integrations, telemetry settings, and Dagger metadata.',
    '',
    'Commands and gates should use exact shell commands for AIKC internal workflow scripts, usually under `ai-knowledge/scripts`. Host project package scripts are for the host project build, test, and runtime tasks. Commands marked `dangerous: true` require explicit confirmation through trusted automation.',
    'Gate categories should accept common workflow categories such as `knowledge`, `typecheck`, `lint`, `test`, `security`, `build`, and `custom`; unknown project-specific categories should degrade to `custom` instead of breaking dashboard loading.',
    'The standard gate set should include an internal code review command such as `node ai-knowledge/scripts/code-review.cjs`; non-read-only work is incomplete until code review and all applicable gates pass.',
    'Durable Agent loops should be declared through manifest commands, gates, watched paths, or dashboard metadata. Each loop must follow `ai-knowledge/core/bounded-loop-policy.md`: define input, output, validation, budget, stop condition, and human escalation.',
    'Standard projects should declare the repo-scoped AIKC MCP server (`aikc mcp --project .`) and use `integrations` to advertise optional helpers such as Context7 docs, repository-docs lookup, semantic code search, Playwright browser QA, and GitHub MCP without silently granting network, browser, GitHub, semantic indexing, or broader filesystem access.',
    '',
    '## Dashboard Contract',
    '',
    '- The dashboard is document-first and should expose project context without becoming the source of truth.',
    '- Stable surfaces include project search, Git state, knowledge assets, MCP, integrations, telemetry, Dagger, gates, commands, links, knowledge search, Markdown preview, and the AI Agent setup prompt.',
    '- The repository checkout remains the source of truth; AIKC does not copy project knowledge into an internal database.',
    '',
    '## Upgrade And Initialization',
    '',
    '- `aikc upgrade --project <path> --write --ai` is the standard safe setup and upgrade path.',
    '- It creates missing workflow files and scripts, keeps differing files unchanged, writes `*.aikc-upgrade.md` candidates, writes `.aikc/upgrade/AI_UPGRADE_PROMPT.md`, and registers the project in the user registry.',
    '- The Agent should semantically merge candidates instead of blindly overwriting project rules.',
    '- `ai-knowledge/core/**` stays AIKC-maintained; project-specific rules stay in skills or project references.',
    '- `--force` may overwrite conflicts after backups, but should be rare maintenance work.',
    '',
    '## Token And Template Updates',
    '',
    '- `node ai-knowledge/scripts/ensure-aikc-cli.cjs` checks the global CLI against npm and installs or updates it when needed.',
    '- `node ai-knowledge/scripts/ensure-aikc-cli.cjs --upgrade` should actively try to update the global CLI, stop and restart a running background `aikc` server when needed, then call the current global CLI to refresh templates for the current project with `aikc upgrade --project . --write --ai` by default.',
    '- Pass `--no-ai` after `--upgrade` only when the AI handoff prompt should be skipped.',
    '- If npm global update fails, the Agent must report the failure and provide manual retry commands: `aikc stop`, `npm install -g ai-knowledge-center@latest`, and `aikc`.',
    '- If a background `aikc` Web process is already running when the global CLI is updated, the ensure script must restart it so the dashboard uses the new package.',
    '- Token checks should stay sparse: explicit token/context/routing tasks, first local state creation, or changes to core entrypoints, `AGENTS.md`, `ai-workflow.yaml`, or `SKILL_INDEX.md`.',
    '- Template upgrades should preserve package manager choices, gates, MCP settings, integrations, dashboard metadata, response templates, and project skills.',
    '- Template upgrades should merge missing MCP servers and integrations by id, preserving project-local settings.',
    '',
    '## API And Automation',
    '',
    'Useful local API surfaces include health, project list/detail, knowledge list/search/preview, and command run endpoints. The API is for trusted local automation or AI workflows that already understand the project manifest.',
    'Useful MCP tool surfaces include project listing, manifest summary, doctor, context-pack, knowledge search/preview, skill listing, and manifest-command execution. Manifest-command execution must remain allowlisted by `ai-workflow.yaml`; dangerous commands still require explicit confirmation.',
    '',
    '## Release Discipline',
    '',
    '- Edit `src/` and rebuild `dist/`.',
    '- Keep README, dashboard prompt, project-upgrader templates, and server auto-initializer templates aligned.',
    '- Run `node ai-knowledge/scripts/knowledge-check.cjs`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm pack --dry-run`.',
    '- Verify temporary project initialization when template behavior changes.',
    '- Never publish with a token that fails `npm whoami`.',
  ].join('\n').replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function openSourceUsageMd(): string {
  return [
    '# Open Source Usage Policy',
    '',
    '<!-- aikc-template-version: ${TEMPLATE_VERSION} -->',
    '',
    'Use mature open-source packages when they reduce custom code, repeated agent reasoning, cross-platform bugs, or token-heavy diagnostics.',
    '',
    '## Prefer Libraries For',
    '',
    '- CLI parsing and subcommand routing.',
    '- Cross-platform file discovery, watching, path handling, and config/cache directories.',
    '- Full-text search, indexing, ranking, and Markdown processing.',
    '- Schema validation, OpenAPI generation, and typed API contracts.',
    '- Structured logging, log formatting, diagnostics, and health checks.',
    '- Retry, concurrency, process execution, archive handling, and release automation.',
    '- MCP/server tools or other structured agent integrations.',
    '',
    '## Selection Criteria',
    '',
    '- active maintenance and recent releases;',
    '- TypeScript support or reliable type definitions;',
    '- license compatibility;',
    '- package size and transitive dependency risk;',
    '- cross-platform behavior for Windows, macOS, Linux, containers, and CI;',
    '- security posture and audit result;',
    '- whether the package replaces enough custom code or token-heavy workflow to justify itself.',
    '',
    '## Implementation Rules',
    '',
    '- Prefer one focused library over broad frameworks unless the framework is already part of the project.',
    '- Keep wrappers thin and local, so packages can be swapped later.',
    '- Preserve existing behavior with targeted tests, smoke checks, or fixture runs.',
    '- Update `README.md`, core docs, skills, and templates when a package changes the recommended workflow.',
    '- Do not introduce network-facing behavior, telemetry changes, or filesystem scope expansion as a side effect of adopting a package.',
    '',
    '## Useful Package Categories',
    '',
    '- `@modelcontextprotocol/sdk`: AIKC MCP servers or project-scoped MCP tools.',
    '- `@modelcontextprotocol/server-filesystem`: repository-scoped filesystem MCP, never broader paths without explicit need.',
    '- Context7: optional current package documentation lookup when stale API knowledge is likely.',
    '- GitMCP-style repository docs MCP: optional task-scoped lookup for external open-source repository documentation.',
    '- Serena-style semantic code MCP: optional repository-scoped retrieval for large codebases when AIKC repo-map recommendations are too broad.',
    '- Playwright or Playwright MCP: browser smoke tests and dashboard QA when visual or interactive behavior matters.',
    '- GitHub MCP: optional issue, pull request, release, and workflow automation when GitHub permissions are needed.',
    '',
    'Do not introduce heavy agent runtimes such as durable workflow frameworks unless the project actually needs resumable multi-step execution, human approval nodes, or long-running state beyond AIKC manifest loops, task-state checkpoints, and gates.',
  ].join('\n').replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function openSourceTokenToolsMd(): string {
  return [
    '# Open Source Token And Cache Tools',
    '',
    '<!-- aikc-template-version: ${TEMPLATE_VERSION} -->',
    '',
    'Use this AIKC-maintained reference when evaluating open-source skills or MCP servers for better prompt-cache hit rates, lower context load, or cheaper repeated code/docs lookup.',
    '',
    '## Default AIKC Path',
    '',
    '- Prefer AIKC built-ins first: `context-pack.cjs`, `repo-map.cjs`, `log-summary.cjs`, `run-bounded.cjs`, `token-budget-check.cjs`, repo-scoped filesystem MCP, and `aikc mcp --project .`.',
    '- Context7 is the approved optional docs lookup integration when package API knowledge may be stale. It saves tokens by pulling focused current docs instead of loading broad README files or dependency source.',
    '- Semantic code-search MCPs are optional, not default. Use one only when `repo-map.cjs --query "<task>"` is not selective enough, the repository is large enough to justify an index, and the server can stay repository-scoped.',
    '- Do not add generic memory/cache MCPs by default. They can lower repeated lookup cost, but they also risk stale project state, secret retention, and broad filesystem scope unless they have clear invalidation and storage boundaries.',
    '',
    '## Useful Open-Source Candidates',
    '',
    '| Candidate | Role | When To Use | Default |',
    '| --- | --- | --- | --- |',
    '| Model Context Protocol SDK and official servers | Typed agent tools and repo-scoped filesystem access | Building or exposing structured AIKC operations | Built in |',
    '| Context7 MCP | Current package docs on demand | Implementation tasks involving external libraries or drifting APIs | Optional integration |',
    '| GitMCP-style repository docs MCP | Turn public GitHub repos into docs context | External open-source repo research where docs are more useful than cloning | Optional task-scoped integration |',
    '| Serena-style semantic code MCP | Symbol-aware code retrieval and edits | Large repos where lexical repo-map recommendations are too broad | Optional repo-scoped integration |',
    '',
    '## Adoption Rules',
    '',
    '1. Keep stable instructions first in prompts and context packs. External MCP output belongs after stable prefix files.',
    '2. Prefer read-only, repository-scoped MCP configuration unless a task explicitly needs broader access.',
    '3. Require an invalidation rule before caching generated knowledge: file hash, mtime, package version, or explicit user refresh.',
    '4. Do not persist secrets, chat transcripts, raw logs, tokens, private account data, or external session state.',
    '5. Add a project skill only when the workflow needs agent judgment. Add an MCP/server tool only when repeated typed operations would replace many fragile tool calls.',
    '',
    '## Decision Shortcut',
    '',
    '- Docs drift: use Context7.',
    '- External open-source repo docs: consider a task-scoped repository-docs MCP.',
    '- Large local code search: use AIKC `repo-map` first; consider semantic MCP only if the map is too broad.',
    '- Long logs or noisy commands: use AIKC bounded/summarizing scripts.',
    '- Repeated project operation: package as an AIKC script or skill before adding another MCP.',
  ].join('\n').replaceAll('${TEMPLATE_VERSION}', TEMPLATE_VERSION);
}

function taskCloseoutMd(): string {
  return "Compatibility prompt. Read `ai-knowledge/core/LOAD-END.md` and complete the mandatory closeout workflow before final response.\n";
}

function skillIndexMd(): string {
  return "# Skill Index\n\n| id | when to use | path |\n| --- | --- | --- |\n";
}

function aikcIgnoreMd(): string {
  return [
    '# AIKC context denylist. Keep high-churn and generated files out of default AI context.',
    '.git/**',
    '.aikc/runs/**',
    '.aikc/index/**',
    'ai-knowledge/human/**',
    'ai-knowledge/references/**',
    'ai-knowledge/.token-check-state.json',
    'node_modules/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '.cache/**',
    '.vite/**',
    '.next/**',
    '.turbo/**',
    '*.log',
    '*.tmp',
    '*.aikc-upgrade.md',
    'npm-debug.log*',
    'yarn-debug.log*',
    'yarn-error.log*',
    'pnpm-debug.log*',
    '',
  ].join('\n');
}

function knowledgeScriptsReadmeMd(): string {
  return [
    '# AI Knowledge Scripts',
    '',
    'These scripts are internal AI Knowledge Center workflow tools. They live inside `ai-knowledge/scripts` so project-level files such as `package.json` stay focused on the host project build, test, and runtime commands.',
    '',
    'Human maintainers may run them from the project root when debugging AIKC workflow behavior:',
    '',
    '```bash',
    'node ai-knowledge/scripts/ensure-aikc-cli.cjs --upgrade',
    'node ai-knowledge/scripts/ai-workflow-start.cjs --task "<task>"',
    'node ai-knowledge/scripts/code-review.cjs',
    'node ai-knowledge/scripts/knowledge-check.cjs',
    'node ai-knowledge/scripts/human-docs-check.cjs',
    'node ai-knowledge/scripts/doctor.cjs',
    'node ai-knowledge/scripts/context-pack.cjs --task "<task>"',
    'node ai-knowledge/scripts/context-pack.cjs --summary --task "<task>"',
    'node ai-knowledge/scripts/log-summary.cjs --file "<log-or-output-file>" --lines 100 --json',
    'node ai-knowledge/scripts/run-bounded.cjs --json -- <command> [args...]',
    'node ai-knowledge/scripts/repo-map.cjs --write --query "<task>"',
    'node ai-knowledge/scripts/token-budget-check.cjs',
    'node ai-knowledge/scripts/observe-workflow.cjs --phase start --task "<task>" --json',
    'node ai-knowledge/scripts/task-state.cjs status --json',
    'node ai-knowledge/scripts/task-state.cjs resume --json',
    'node ai-knowledge/scripts/eval-workflow.cjs',
    'node ai-knowledge/scripts/ai-closeout.cjs',
    'aikc mcp --project .',
    '```',
    '',
    'Do not add these commands to a host project `package.json`. If the dashboard or another tool needs to run one, declare the exact command in `ai-workflow.yaml`.',
    '',
    'Follow `ai-knowledge/core/script-automation-policy.md` when adding or updating scripts.',
    '',
    '`ensure-aikc-cli.cjs --upgrade` actively updates the global AIKC CLI, refreshes project templates with `aikc upgrade --project . --write --ai`, and prints manual retry commands if npm global update fails. Pass `--no-ai` after `--upgrade` only when the AI handoff prompt should be skipped.',
    '`doctor.cjs` provides compact workflow diagnostics. Use `--json` for AI consumption.',
    '`context-pack.cjs` provides a compact reading plan for token-aware Agent runs. Use `--summary` for task-start budgets, recommended files, and long-output policy.',
    '`log-summary.cjs` reads only the newest bounded slice of a repository log or captured command-output file and reports recent lines plus error-like matches. Use it before loading raw watch/dev/build logs into Agent context.',
    '`run-bounded.cjs` executes a command, writes complete stdout/stderr to `.aikc/runs/*.log`, and prints only a bounded summary.',
    '`repo-map.cjs` builds a compact file, symbol, and import map at `.aikc/index/repo-map.json` for token-efficient file selection.',
    '`token-budget-check.cjs` is a regression gate for context-pack size, repo-map availability, and bounded command output.',
    '`observe-workflow.cjs` writes compact workflow metrics to project and user-level JSONL logs without storing chat transcripts, secrets, full logs, or raw command output.',
    '`task-state.cjs` writes and reads `.aikc/task-state/current.json` so long tasks can recover after context loss.',
    '`eval-workflow.cjs` runs smoke eval cases from `ai-knowledge/evals`.',
    '`aikc mcp --project .` exposes AIKC as a repo-scoped stdio MCP server for agent clients. It provides structured access to the manifest, doctor, context-pack, knowledge search/preview, skill listing, and allowlisted manifest command execution.',
    '',
  ].join('\n');
}

function aiWorkflowStartScript(): string {
  return "#!/usr/bin/env node\n\nconst fs = require('node:fs');\nconst path = require('node:path');\nconst { spawnSync } = require('node:child_process');\n\nconst root = path.resolve(__dirname, '..', '..');\nconst args = process.argv.slice(2);\nconst taskIndex = args.indexOf('--task');\nconst task = taskIndex >= 0 ? args[taskIndex + 1] : args.join(' ');\n\nconst required = [\n  'AGENTS.md',\n  'ai-workflow.yaml',\n  'ai-knowledge/LOAD.md',\n  'ai-knowledge/core/LOAD.md',\n  'ai-knowledge/core/knowledge-capture-policy.md',\n  'ai-knowledge/core/LOAD-END.md',\n  'ai-knowledge/ai/LOAD.md',\n  'ai-knowledge/skills/SKILL_INDEX.md',\n  'ai-knowledge/scripts/task-state.cjs',\n  'ai-knowledge/scripts/context-pack.cjs',\n];\n\nfor (const rel of required) {\n  fs.accessSync(path.join(root, rel));\n}\n\nconst state = spawnSync('node', ['ai-knowledge/scripts/task-state.cjs', 'start', '--task', task || '(task not provided)'], { cwd: root, shell: process.platform === 'win32', stdio: 'inherit' });\nif (state.status !== 0) process.exit(state.status || 1);\n\nconst pack = spawnSync('node', ['ai-knowledge/scripts/context-pack.cjs', '--summary', '--task', task || '(task not provided)'], { cwd: root, shell: process.platform === 'win32', encoding: 'utf8' });\nif (pack.status === 0 && pack.stdout.trim()) {\n  console.log('Context pack summary:');\n  console.log(pack.stdout.trim());\n}\n\nconsole.log('AI workflow ready.');\nconsole.log(`Task: ${task || '(not provided)'}`);\nconsole.log('Entrypoints: AGENTS.md, ai-knowledge/LOAD.md, ai-knowledge/core/LOAD.md, ai-knowledge/ai/LOAD.md');\nconsole.log('Task state: .aikc/task-state/current.json');\nconsole.log('Knowledge capture: read ai-knowledge/core/knowledge-capture-policy.md');\nconsole.log('Closeout: ai-knowledge/core/LOAD-END.md');";
}

function aiCloseoutScript(): string {
  return "#!/usr/bin/env node\n\nconst fs = require('node:fs');\nconst path = require('node:path');\nconst { spawnSync } = require('node:child_process');\n\nconst root = path.resolve(__dirname, '..', '..');\nconst required = [\n  'ai-knowledge/core/LOAD-END.md',\n  'ai-knowledge/core/human-friendly-task-summary.md',\n  'ai-knowledge/core/task-closeout-verification.md',\n  'ai-knowledge/core/task-closeout-risk-report.md',\n  'ai-knowledge/core/knowledge-capture-policy.md',\n  'ai-knowledge/core/code-review-policy.md',\n];\n\nfor (const rel of required) {\n  fs.accessSync(path.join(root, rel));\n}\n\nconst review = spawnSync('node', ['ai-knowledge/scripts/code-review.cjs'], { cwd: root, shell: process.platform === 'win32', stdio: 'inherit' });\nif (review.status !== 0) process.exit(review.status || 1);\n\nconst knowledge = spawnSync('node', ['ai-knowledge/scripts/knowledge-check.cjs'], { cwd: root, shell: process.platform === 'win32', stdio: 'inherit' });\nif (knowledge.status !== 0) process.exit(knowledge.status || 1);\n\nconst state = spawnSync('node', ['ai-knowledge/scripts/task-state.cjs', 'close', '--summary', 'Closeout gates passed.'], { cwd: root, shell: process.platform === 'win32', stdio: 'inherit' });\nif (state.status !== 0) process.exit(state.status || 1);\n\nconsole.log('Code review and knowledge gate passed. Read ai-knowledge/core/LOAD-END.md before final response.');";
}

function codeReviewScript(): string {
  return "#!/usr/bin/env node\n\nconst fs = require('node:fs');\nconst path = require('node:path');\nconst { spawnSync } = require('node:child_process');\n\nconst root = path.resolve(__dirname, '..', '..');\nconst required = [\n  'ai-knowledge/core/code-review-policy.md',\n  'ai-knowledge/core/LOAD-END.md',\n  'ai-workflow.yaml',\n];\n\nfor (const rel of required) {\n  fs.accessSync(path.join(root, rel));\n}\n\nconst policy = fs.readFileSync(path.join(root, 'ai-knowledge/core/code-review-policy.md'), 'utf8');\nif (!policy.includes('Required Review Steps') || !policy.includes('Final Response Requirement')) {\n  console.error('Code review policy is missing required sections.');\n  process.exit(1);\n}\n\nconst loadEnd = fs.readFileSync(path.join(root, 'ai-knowledge/core/LOAD-END.md'), 'utf8');\nif (!loadEnd.includes('code-review-policy.md') || !loadEnd.includes('ai-knowledge/scripts/code-review.cjs')) {\n  console.error('Core closeout does not require code review.');\n  process.exit(1);\n}\n\nfunction run(command, args) {\n  return spawnSync(command, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });\n}\n\nfunction candidateFiles() {\n  const git = run('git', ['rev-parse', '--is-inside-work-tree']);\n  if (git.status === 0 && git.stdout.trim() === 'true') {\n    const changed = run('git', ['diff', '--name-only', '--diff-filter=ACMRTUXB', 'HEAD', '--']);\n    const untracked = run('git', ['ls-files', '--others', '--exclude-standard']);\n    if (changed.status === 0 && untracked.status === 0) {\n      return [...changed.stdout.split(/\\r?\\n/), ...untracked.stdout.split(/\\r?\\n/)].filter(Boolean);\n    }\n  }\n  return [];\n}\n\nconst files = candidateFiles();\nconst unresolved = files.filter(file => file.endsWith('.aikc-upgrade.md'));\nif (unresolved.length > 0) {\n  console.error(`Unresolved AIKC upgrade candidates remain:\\n${unresolved.map(file => `- ${file}`).join('\\n')}`);\n  process.exit(1);\n}\n\nfor (const file of files) {\n  const absolute = path.join(root, file);\n  if (!fs.existsSync(absolute) || fs.statSync(absolute).size > 1024 * 1024) continue;\n  const content = fs.readFileSync(absolute, 'utf8');\n  if (/^(<<<<<<< |=======\\s*$|>>>>>>> )/m.test(content)) {\n    console.error(`Conflict markers found in ${file}`);\n    process.exit(1);\n  }\n}\n\nconsole.log(`code review gate ok (${files.length} changed files considered)`);";
}

function knowledgeCheckScript(): string {
  return "#!/usr/bin/env node\n\nconst fs = require('node:fs');\nconst path = require('node:path');\n\nconst root = path.resolve(__dirname, '..', '..');\nconst required = [\n  'AGENTS.md',\n  'ai-workflow.yaml',\n  '.aikcignore',\n  'ai-knowledge/LOAD.md',\n  'ai-knowledge/core/LOAD.md',\n  'ai-knowledge/core/LOAD-END.md',\n  'ai-knowledge/core/human-friendly-task-summary.md',\n  'ai-knowledge/core/task-closeout-verification.md',\n  'ai-knowledge/core/task-closeout-risk-report.md',\n  'ai-knowledge/core/code-review-policy.md',\n  'ai-knowledge/core/knowledge-capture-policy.md',\n  'ai-knowledge/core/script-automation-policy.md',\n  'ai-knowledge/core/bounded-loop-policy.md',\n  'ai-knowledge/core/human-readable-knowledge-policy.md',\n  'ai-knowledge/core/token-efficiency.md',\n  'ai-knowledge/core/open-source-token-tools.md',\n  'ai-knowledge/core/project-capabilities.md',\n  'ai-knowledge/core/open-source-usage.md',\n  'ai-knowledge/ai/LOAD.md',\n  'ai-knowledge/skills/SKILL_INDEX.md',\n  'ai-knowledge/human/README.md',\n  'ai-knowledge/human/core-workflow.md',\n  'ai-knowledge/prompt/task-closeout.md',\n  'ai-knowledge/scripts/README.md',\n  'ai-knowledge/scripts/ensure-aikc-cli.cjs',\n  'ai-knowledge/scripts/ai-workflow-start.cjs',\n  'ai-knowledge/scripts/ai-closeout.cjs',\n  'ai-knowledge/scripts/code-review.cjs',\n  'ai-knowledge/scripts/context-pack.cjs',\n  'ai-knowledge/scripts/log-summary.cjs',\n  'ai-knowledge/scripts/run-bounded.cjs',\n  'ai-knowledge/scripts/repo-map.cjs',\n  'ai-knowledge/scripts/token-budget-check.cjs',\n  'ai-knowledge/scripts/observe-workflow.cjs',\n  'ai-knowledge/scripts/doctor.cjs',\n  'ai-knowledge/scripts/task-state.cjs',\n  'ai-knowledge/scripts/eval-workflow.cjs',\n  'ai-knowledge/scripts/human-docs-check.cjs',\n  'ai-knowledge/scripts/knowledge-check.cjs',\n  'ai-knowledge/evals/workflow-smoke.json',\n];\n\nconst missing = required.filter(rel => !fs.existsSync(path.join(root, rel)));\nif (missing.length > 0) {\n  console.error(`Missing AI knowledge files:\\n${missing.map(rel => `- ${rel}`).join('\\n')}`);\n  process.exit(1);\n}\n\nconst load = fs.readFileSync(path.join(root, 'ai-knowledge/LOAD.md'), 'utf8');\nif (!load.includes('ai-knowledge/core/LOAD.md') || !load.includes('knowledge-capture-policy.md')) {\n  console.error('LOAD.md does not route through core or require the knowledge capture policy.');\n  process.exit(1);\n}\nconst coreLoad = fs.readFileSync(path.join(root, 'ai-knowledge/core/LOAD.md'), 'utf8');\nif (!load.includes('task-state.cjs') || !coreLoad.includes('task-state.cjs') || !coreLoad.includes('resume --json')) {\n  console.error('LOAD entrypoints are missing durable task-state write/read/recover requirements.');\n  process.exit(1);\n}\n\nconst loadEnd = fs.readFileSync(path.join(root, 'ai-knowledge/core/LOAD-END.md'), 'utf8');\nif (!loadEnd.includes('knowledge-capture-policy.md') || !(loadEnd.includes('Knowledge Capture') || loadEnd.includes('knowledge-capture'))) {\n  console.error('Core closeout does not enforce knowledge capture decisions.');\n  process.exit(1);\n}\nif (!loadEnd.includes('Reply Message Rules') || !loadEnd.includes('code-review-policy.md') || !loadEnd.includes('ai-knowledge/scripts/code-review.cjs')) {\n  console.error('Core closeout does not enforce reply or code review rules.');\n  process.exit(1);\n}\n\nconst scriptsReadme = fs.readFileSync(path.join(root, 'ai-knowledge/scripts/README.md'), 'utf8');\nif (!scriptsReadme.includes('Do not add these commands to a host project') || !scriptsReadme.includes('script-automation-policy.md') || !scriptsReadme.includes('task-state.cjs')) {\n  console.error('AI knowledge scripts README is missing human usage guidance.');\n  process.exit(1);\n}\n\nconst replySummary = fs.readFileSync(path.join(root, 'ai-knowledge/core/human-friendly-task-summary.md'), 'utf8');\nif (!replySummary.includes('Progress Replies') || !replySummary.includes('Final Replies') || !replySummary.includes('Code review') || !replySummary.includes('Multi-Item Tables')) {\n  console.error('Human-friendly task summary is missing progress, final reply, or table rules.');\n  process.exit(1);\n}\n\nconst scriptPolicy = fs.readFileSync(path.join(root, 'ai-knowledge/core/script-automation-policy.md'), 'utf8');\nif (!scriptPolicy.includes('Automation Candidate Table')) {\n  console.error('Script automation policy is missing automation candidate table guidance.');\n  process.exit(1);\n}\n\nconst contextPack = fs.readFileSync(path.join(root, 'ai-knowledge/scripts/context-pack.cjs'), 'utf8');\nif (!contextPack.includes('stablePrefixFiles') || !contextPack.includes('estimatedTokens') || !contextPack.includes('hash') || !contextPack.includes('toolOutputPolicy') || !contextPack.includes('deferredFiles')) {\n  console.error('Context pack script is missing stable-prefix cache metadata or bounded output policy.');\n  process.exit(1);\n}\nconst logSummary = fs.readFileSync(path.join(root, 'ai-knowledge/scripts/log-summary.cjs'), 'utf8');\nif (!logSummary.includes('--lines') || !logSummary.includes('recentLines') || !logSummary.includes('Refusing to read outside repository')) {\n  console.error('Log summary script is missing bounded repository-scoped log-reading behavior.');\n  process.exit(1);\n}\nconst runBounded = fs.readFileSync(path.join(root, 'ai-knowledge/scripts/run-bounded.cjs'), 'utf8');\nif (!runBounded.includes('.aikc') || !runBounded.includes('runs') || !runBounded.includes('max-chars') || !runBounded.includes('fullLogPath')) {\n  console.error('Run-bounded script is missing full-log storage or bounded-output behavior.');\n  process.exit(1);\n}\nconst repoMap = fs.readFileSync(path.join(root, 'ai-knowledge/scripts/repo-map.cjs'), 'utf8');\nif (!repoMap.includes('.aikcignore') || !repoMap.includes('symbols') || !repoMap.includes('imports') || !repoMap.includes('recommendedFiles')) {\n  console.error('Repo map script is missing ignore, symbol, import, or recommendation behavior.');\n  process.exit(1);\n}\nconst tokenBudget = fs.readFileSync(path.join(root, 'ai-knowledge/scripts/token-budget-check.cjs'), 'utf8');\nif (!tokenBudget.includes('max-summary-tokens') || !tokenBudget.includes('recommended-context-budget') || !tokenBudget.includes('run-bounded')) {\n  console.error('Token budget check script is missing regression budget checks.');\n  process.exit(1);\n}\nconst observeWorkflow = fs.readFileSync(path.join(root, 'ai-knowledge/scripts/observe-workflow.cjs'), 'utf8');\nif (!observeWorkflow.includes('workflow-observations.jsonl') || !observeWorkflow.includes('context-pack.cjs') || !observeWorkflow.includes('token-budget-check.cjs')) {\n  console.error('Observe workflow script is missing observation log or metric collection behavior.');\n  process.exit(1);\n}\n\nconst reviewPolicy = fs.readFileSync(path.join(root, 'ai-knowledge/core/code-review-policy.md'), 'utf8');\nif (!reviewPolicy.includes('Required Review Steps') || !reviewPolicy.includes('Final Response Requirement')) {\n  console.error('Core code review policy is missing required sections.');\n  process.exit(1);\n}\n\nconst boundedLoopPolicy = fs.readFileSync(path.join(root, 'ai-knowledge/core/bounded-loop-policy.md'), 'utf8');\nif (!boundedLoopPolicy.includes('Loop Contract') || !boundedLoopPolicy.includes('stop condition') || !boundedLoopPolicy.includes('human escalation')) {\n  console.error('Core bounded loop policy is missing required sections.');\n  process.exit(1);\n}\n\nconst humanReadablePolicy = fs.readFileSync(path.join(root, 'ai-knowledge/core/human-readable-knowledge-policy.md'), 'utf8');\nif (!humanReadablePolicy.includes('AI-facing knowledge') || !humanReadablePolicy.includes('human-readable companions')) {\n  console.error('Core human-readable knowledge policy is missing required sections.');\n  process.exit(1);\n}\n\nconsole.log('knowledge ok');";
}

function humanDocsCheckScript(): string {
  return "#!/usr/bin/env node\n\nconst fs = require('node:fs');\nconst path = require('node:path');\n\nconst root = path.resolve(__dirname, '..', '..');\n\nfunction read(relPath) {\n  return fs.readFileSync(path.join(root, relPath), 'utf8');\n}\n\nfunction exists(relPath) {\n  return fs.existsSync(path.join(root, relPath));\n}\n\nfunction skillPaths() {\n  const index = read('ai-knowledge/skills/SKILL_INDEX.md');\n  const matches = [...index.matchAll(/`?(ai-knowledge\\/skills\\/([^/]+)\\/SKILL\\.md)`?/g)];\n  return matches.map(match => ({ skillId: match[2], skillPath: match[1] }));\n}\n\nconst required = [\n  'ai-knowledge/core/human-readable-knowledge-policy.md',\n  'ai-knowledge/human/README.md',\n  'ai-knowledge/human/core-workflow.md',\n];\n\nconst missing = required.filter(relPath => !exists(relPath));\nfor (const { skillId } of skillPaths()) {\n  const companion = `ai-knowledge/human/skills/${skillId}.md`;\n  if (!exists(companion)) missing.push(companion);\n}\n\nif (missing.length > 0) {\n  console.error(`Missing human-readable knowledge companions:\\n${missing.map(item => `- ${item}`).join('\\n')}`);\n  process.exit(1);\n}\n\nconsole.log(`human docs ok (${skillPaths().length} skill companions)`);";
}

function doctorScript(): string {
  return "#!/usr/bin/env node\n\nconst fs = require('node:fs');\nconst os = require('node:os');\nconst path = require('node:path');\nconst { spawnSync } = require('node:child_process');\n\nconst root = path.resolve(__dirname, '..', '..');\nconst asJson = process.argv.includes('--json');\n\nfunction run(command, args) {\n  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });\n  return { status: result.status ?? 1, output: `${result.stdout || ''}${result.stderr || ''}`.trim() };\n}\n\nfunction exists(rel) { return fs.existsSync(path.join(root, rel)); }\nfunction check(id, ok, evidence, severity = 'error') { return { id, status: ok ? 'pass' : severity, evidence }; }\n\nfunction serverState() {\n  const pidPath = path.join(path.resolve(process.env.AIKC_HOME || path.join(os.homedir(), '.ai-knowledge-center')), 'server.pid.json');\n  if (!fs.existsSync(pidPath)) return 'no pid file';\n  try {\n    const parsed = JSON.parse(fs.readFileSync(pidPath, 'utf8').replace(/^\\uFEFF/, ''));\n    if (typeof parsed.pid !== 'number') return 'invalid pid file';\n    try { process.kill(parsed.pid, 0); return `running pid=${parsed.pid}`; } catch { return `stale pid=${parsed.pid}`; }\n  } catch { return 'invalid pid file'; }\n}\n\nconst required = ['AGENTS.md', 'ai-workflow.yaml', 'ai-knowledge/LOAD.md', 'ai-knowledge/core/LOAD.md', 'ai-knowledge/scripts/knowledge-check.cjs'];\nconst missing = required.filter(rel => !exists(rel));\nconst knowledge = exists('ai-knowledge/scripts/knowledge-check.cjs') ? run('node', ['ai-knowledge/scripts/knowledge-check.cjs']) : { status: 1, output: 'missing' };\nconst human = exists('ai-knowledge/scripts/human-docs-check.cjs') ? run('node', ['ai-knowledge/scripts/human-docs-check.cjs']) : { status: 0, output: 'not configured' };\nconst checks = [\n  check('required-files', missing.length === 0, missing.length ? missing.join(', ') : 'all present'),\n  check('knowledge-check', knowledge.status === 0, knowledge.output),\n  check('human-docs-check', human.status === 0, human.output, 'warn'),\n  check('web-server', !serverState().startsWith('stale') && !serverState().startsWith('invalid'), serverState(), 'warn'),\n];\nconst status = checks.some(item => item.status === 'error') ? 'fail' : checks.some(item => item.status === 'warn') ? 'warn' : 'pass';\nconst summary = { status, root, checks };\nif (asJson) console.log(JSON.stringify(summary, null, 2));\nelse {\n  console.log(`AIKC doctor: ${status}`);\n  for (const item of checks) console.log(`[${item.status}] ${item.id}: ${item.evidence}`);\n}\nif (status === 'fail') process.exit(1);";
}

function contextPackScript(): string {
  return [
    '#!/usr/bin/env node',
    '',
    "const fs = require('node:fs');",
    "const crypto = require('node:crypto');",
    "const path = require('node:path');",
    '',
    "const root = path.resolve(__dirname, '..', '..');",
    'const args = process.argv.slice(2);',
    "const taskIndex = args.indexOf('--task');",
    "const task = taskIndex >= 0 ? args[taskIndex + 1] || '' : args.join(' ');",
    "const asSummary = args.includes('--summary');",
    "function exists(rel) { return fs.existsSync(path.join(root, rel)); }",
    "function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }",
    'function estimateTokens(text) { return Math.ceil(text.length / 4); }',
    'function fileInfo(rel, reason) {',
    '  const absolute = path.join(root, rel);',
    "  const text = fs.readFileSync(absolute, 'utf8');",
    '  const stat = fs.statSync(absolute);',
    "  return { path: rel, reason, estimatedTokens: estimateTokens(text), hash: crypto.createHash('sha256').update(text).digest('hex').slice(0, 16), mtimeMs: Math.round(stat.mtimeMs) };",
    '}',
    'function skills() {',
    "  if (!exists('ai-knowledge/skills/SKILL_INDEX.md')) return [];",
    "  return [...read('ai-knowledge/skills/SKILL_INDEX.md').matchAll(/`?(ai-knowledge\\/skills\\/([^/]+)\\/SKILL\\.md)`?/g)].map(match => ({ skillId: match[2], path: match[1] }));",
    '}',
    'const sparse = /token|cache|context|mcp|semantic|skill|knowledge|workflow|loop|eval|doctor|人类|知识|上下文|工作流|门禁|技能/i.test(task);',
    "const base = ['AGENTS.md', 'ai-workflow.yaml', 'ai-knowledge/LOAD.md', 'ai-knowledge/core/LOAD.md', 'ai-knowledge/ai/LOAD.md', 'ai-knowledge/skills/SKILL_INDEX.md'];",
    "const stablePrefixFiles = base.filter(exists).map(file => fileInfo(file, 'stable workflow prefix'));",
    "const taskFiles = [...(sparse ? ['ai-knowledge/core/token-efficiency.md', 'ai-knowledge/core/open-source-token-tools.md', 'ai-knowledge/core/bounded-loop-policy.md', 'ai-knowledge/core/human-readable-knowledge-policy.md'] : []), ...skills().map(skill => skill.path)].filter((value, index, list) => list.indexOf(value) === index && exists(value)).map(file => fileInfo(file, sparse ? 'task trigger or matched skill' : 'matched skill'));",
    'const recommendedFiles = [...stablePrefixFiles, ...taskFiles].map(item => item.path).filter((value, index, list) => list.indexOf(value) === index);',
    'const budget = { maxStableTokens: 7000, maxTaskTokens: 12000, totalEstimatedTokens: [...stablePrefixFiles, ...taskFiles].reduce((sum, item) => sum + item.estimatedTokens, 0), warningAtTokens: 20000 };',
    "const stablePrefixHash = crypto.createHash('sha256').update(stablePrefixFiles.map(file => `${file.path}:${file.hash}`).join('|')).digest('hex').slice(0, 16);",
    "const avoidByDefault = ['ai-knowledge/human/**', 'ai-knowledge/references/**', 'ai-knowledge/**/*.aikc-upgrade.md', '.aikc/**', 'dist/**', 'node_modules/**', 'coverage/**', '**/*.log', '**/logs/**'];",
    "const toolOutputPolicy = { defaultMaxChars: 12000, longOutputAction: 'write to a file or summarize; do not paste full output into chat', preferredCommands: ['node ai-knowledge/scripts/log-summary.cjs --file <log> --lines 100 --json', 'structured JSON summaries before raw logs'] };",
    "const logReadPolicy = { defaultRecentLines: 100, maxRecentLinesWithoutReason: 300, drilldown: 'read raw logs only around the summarized error timestamp, pattern, or line number' };",
    "const pack = { task, sparseTriggers: sparse, budget, stablePrefixHash, stablePrefixFiles, taskFiles, deferredFiles: [], recommendedFiles, matchedSkills: skills(), avoidByDefault, toolOutputPolicy, logReadPolicy, cacheGuidance: ['Keep stablePrefixFiles before task-specific logs, diffs, and runtime state.', 'Reuse hash and mtimeMs to skip unchanged low-frequency context.', 'Do not add generated timestamps or raw logs to stable prompt prefixes.'] };",
    "if (asSummary) console.log(JSON.stringify({ task: pack.task, sparseTriggers: pack.sparseTriggers, budget: pack.budget, stablePrefixHash: pack.stablePrefixHash, recommendedFiles: pack.recommendedFiles, deferredCount: 0, matchedSkills: pack.matchedSkills, avoidByDefault: pack.avoidByDefault, toolOutputPolicy: pack.toolOutputPolicy }, null, 2));",
    'else console.log(JSON.stringify(pack, null, 2));',
  ].join('\n');
}

function logSummaryScript(): string {
  return [
    '#!/usr/bin/env node',
    '',
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    "const root = path.resolve(__dirname, '..', '..');",
    'const args = process.argv.slice(2);',
    "const asJson = args.includes('--json');",
    "function value(name, fallback = '') { const index = args.indexOf(name); if (index >= 0) return args[index + 1] || fallback; const inline = args.find(arg => arg.startsWith(`${name}=`)); return inline ? inline.slice(name.length + 1) : fallback; }",
    "const fileArg = value('--file');",
    "if (!fileArg || args.includes('--help') || args.includes('-h')) { console.log('Usage: node ai-knowledge/scripts/log-summary.cjs --file <path> [--lines 100] [--pattern <regex>] [--json]'); process.exit(fileArg ? 0 : 1); }",
    "const requestedLines = Number(value('--lines', '100'));",
    'const lineLimit = Number.isFinite(requestedLines) && requestedLines > 0 ? Math.min(Math.floor(requestedLines), 1000) : 100;',
    "const patternText = value('--pattern');",
    "const pattern = patternText ? new RegExp(patternText, 'i') : /\\b(error|fail(?:ed|ure)?|exception|panic|fatal|timeout|denied|eaddrinuse|enoent|ts\\d{4}|traceback)\\b/i;",
    'const absolute = path.resolve(root, fileArg);',
    "if (!absolute.startsWith(root + path.sep) && absolute !== root) { console.error(`Refusing to read outside repository: ${fileArg}`); process.exit(1); }",
    "if (!fs.existsSync(absolute)) { console.error(`Log file not found: ${fileArg}`); process.exit(1); }",
    'const stat = fs.statSync(absolute);',
    'const maxBytes = 2 * 1024 * 1024;',
    'const start = Math.max(0, stat.size - maxBytes);',
    'const buffer = Buffer.alloc(stat.size - start);',
    "const fd = fs.openSync(absolute, 'r');",
    'try { fs.readSync(fd, buffer, 0, buffer.length, start); } finally { fs.closeSync(fd); }',
    "const lines = buffer.toString('utf8').replace(/^\\uFEFF/, '').split(/\\r?\\n/);",
    'const recentLines = lines.slice(-lineLimit);',
    'const matches = [];',
    "lines.forEach((line, index) => { if (pattern.test(line)) matches.push({ line: start === 0 ? index + 1 : null, text: line.slice(0, 500) }); });",
    "const summary = { file: path.relative(root, absolute).replaceAll(path.sep, '/'), bytes: stat.size, scannedBytes: buffer.length, truncatedFromStart: start > 0, recentLineCount: recentLines.length, pattern: patternText || pattern.source, matchCountInScannedSlice: matches.length, newestMatches: matches.slice(-20), recentLines };",
    'if (asJson) console.log(JSON.stringify(summary, null, 2));',
    "else { console.log(`Log summary: ${summary.file}`); console.log(`Bytes: ${summary.bytes}; scanned: ${summary.scannedBytes}; recent lines: ${summary.recentLineCount}; matches: ${summary.matchCountInScannedSlice}`); for (const match of summary.newestMatches) console.log(`- ${match.text}`); console.log('Recent lines:'); for (const line of recentLines) console.log(line); }",
  ].join('\n');
}

function runBoundedScript(): string {
  return [
    '#!/usr/bin/env node',
    '',
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    "const { spawnSync } = require('node:child_process');",
    "const root = path.resolve(__dirname, '..', '..');",
    'const args = process.argv.slice(2);',
    "function value(name, fallback = '') { const index = args.indexOf(name); if (index >= 0) return args[index + 1] || fallback; const inline = args.find(arg => arg.startsWith(`${name}=`)); return inline ? inline.slice(name.length + 1) : fallback; }",
    "if (args.includes('--help') || args.includes('-h')) { console.log('Usage: node ai-knowledge/scripts/run-bounded.cjs --json -- <command> [args...]'); process.exit(0); }",
    "const sep = args.indexOf('--');",
    'const commandParts = sep >= 0 ? args.slice(sep + 1) : [];',
    "if (!commandParts.length) { console.error('Missing command after --'); process.exit(1); }",
    "const asJson = args.includes('--json');",
    "const useShell = args.includes('--shell');",
    "const maxChars = Math.max(1, Number(value('--max-chars', '12000')) || 12000);",
    "const maxLines = Math.max(1, Number(value('--lines', '120')) || 120);",
    'const startedAt = new Date();',
    "const result = spawnSync(commandParts[0], commandParts.slice(1), { cwd: root, encoding: 'utf8', shell: useShell, maxBuffer: 64 * 1024 * 1024 });",
    'const endedAt = new Date();',
    "const output = `${result.stdout || ''}${result.stderr || ''}`;",
    "const runsDir = path.join(root, '.aikc', 'runs');",
    'fs.mkdirSync(runsDir, { recursive: true });',
    "const safeName = commandParts.join('_').replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 80) || 'command';",
    "const logPath = path.join(runsDir, `${startedAt.toISOString().replace(/[:.]/g, '-')}-${safeName}.log`);",
    "fs.writeFileSync(logPath, output, 'utf8');",
    'const recentLines = output.split(/\\r?\\n/).slice(-maxLines).join("\\n");',
    'const recentOutput = recentLines.length <= maxChars ? recentLines : recentLines.slice(recentLines.length - maxChars);',
    "const newestMatches = output.split(/\\r?\\n/).filter(line => /\\b(error|fail(?:ed|ure)?|exception|panic|fatal|timeout|denied|eaddrinuse|enoent|ts\\d{4}|traceback)\\b/i.test(line)).slice(-20).map(line => line.slice(0, 500));",
    "const summary = { command: commandParts.join(' '), status: result.status ?? 1, signal: result.signal || null, startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), durationMs: endedAt.getTime() - startedAt.getTime(), outputBytes: Buffer.byteLength(output), fullLogPath: path.relative(root, logPath).replaceAll(path.sep, '/'), truncated: output.length > maxChars, newestMatches, recentOutput };",
    'if (asJson) console.log(JSON.stringify(summary, null, 2));',
    "else { console.log(`Command: ${summary.command}`); console.log(`Status: ${summary.status}; durationMs: ${summary.durationMs}; outputBytes: ${summary.outputBytes}`); console.log(`Full log: ${summary.fullLogPath}`); if (newestMatches.length) { console.log('Newest error-like lines:'); for (const line of newestMatches) console.log(`- ${line}`); } console.log('Recent output:'); console.log(recentOutput); }",
    'process.exit(summary.status);',
  ].join('\n');
}

function repoMapScript(): string {
  return [
    '#!/usr/bin/env node',
    '',
    "const fs = require('node:fs');",
    "const crypto = require('node:crypto');",
    "const path = require('node:path');",
    "const root = path.resolve(__dirname, '..', '..');",
    'const args = process.argv.slice(2);',
    "const asJson = args.includes('--json');",
    "const write = args.includes('--write');",
    "function value(name, fallback = '') { const index = args.indexOf(name); if (index >= 0) return args[index + 1] || fallback; const inline = args.find(arg => arg.startsWith(`${name}=`)); return inline ? inline.slice(name.length + 1) : fallback; }",
    "function ignorePatterns() { const file = path.join(root, '.aikcignore'); const base = ['node_modules/**', 'dist/**', '.git/**', '.aikc/runs/**', '.aikc/index/**', '*.log', '*.aikc-upgrade.md']; if (!fs.existsSync(file)) return base; return [...base, ...fs.readFileSync(file, 'utf8').split(/\\r?\\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'))]; }",
    "function glob(rel, pattern) { const marker = '\\u0000'; const source = pattern.replaceAll('\\\\', '/').replace(/[.+^${}()|[\\]\\\\]/g, '\\\\$&').replaceAll('**', marker).replaceAll('*', '[^/]*').replaceAll(marker, '.*'); return new RegExp(`^${source}$`).test(rel.replaceAll('\\\\', '/')); }",
    'const ignores = ignorePatterns();',
    "function ignored(rel) { return ignores.some(pattern => glob(rel, pattern) || glob(`${rel}/`, pattern)); }",
    "const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.json', '.md', '.yaml', '.yml']);",
    "function walk(dir, files = []) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const absolute = path.join(dir, entry.name); const rel = path.relative(root, absolute).replaceAll(path.sep, '/'); if (ignored(rel)) continue; if (entry.isDirectory()) walk(absolute, files); else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) files.push(rel); } return files; }",
    "function symbols(text, ext) { if (ext === '.md') return [...text.matchAll(/^#{1,3}\\s+(.+)$/gm)].map(match => match[1].trim()).slice(0, 20); return [...text.matchAll(/\\bexport\\s+(?:async\\s+)?(?:function|class|const|let|var|type|interface)\\s+([A-Za-z0-9_$]+)/g), ...text.matchAll(/\\bfunction\\s+([A-Za-z0-9_$]+)\\s*\\(/g)].map(match => match[1]).filter(Boolean).slice(0, 30); }",
    "function imports(text) { return [...new Set([...text.matchAll(/\\bimport\\s+(?:[^'\\\"]+?\\s+from\\s+)?['\\\"]([^'\\\"]+)['\\\"]/g), ...text.matchAll(/\\brequire\\(['\\\"]([^'\\\"]+)['\\\"]\\)/g)].map(match => match[1]).filter(Boolean))].slice(0, 30); }",
    "const query = value('--query');",
    "const terms = query.toLowerCase().split(/[^a-z0-9\\u4e00-\\u9fff._-]+/).filter(term => term.length >= 2);",
    "const files = walk(root).map(rel => { const absolute = path.join(root, rel); const text = fs.readFileSync(absolute, 'utf8'); const ext = path.extname(rel).toLowerCase(); const fileSymbols = symbols(text, ext); const fileImports = imports(text); const haystack = `${rel} ${fileSymbols.join(' ')} ${fileImports.join(' ')}`.toLowerCase(); const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0); const stat = fs.statSync(absolute); return { path: rel, ext, bytes: Buffer.byteLength(text), estimatedTokens: Math.ceil(text.length / 4), hash: crypto.createHash('sha256').update(text).digest('hex').slice(0, 16), mtimeMs: Math.round(stat.mtimeMs), symbols: fileSymbols, imports: fileImports, score }; }).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));",
    "const map = { generatedAt: new Date().toISOString(), root, query, fileCount: files.length, totalEstimatedTokens: files.reduce((sum, file) => sum + file.estimatedTokens, 0), files, recommendedFiles: files.filter(file => file.score > 0).slice(0, 12).map(file => file.path) };",
    "if (write) { const dir = path.join(root, '.aikc', 'index'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'repo-map.json'), `${JSON.stringify(map, null, 2)}\\n`, 'utf8'); }",
    "if (asJson) console.log(JSON.stringify(map, null, 2)); else { console.log(`Repo map: ${map.fileCount} files, ~${map.totalEstimatedTokens} tokens if read fully.`); if (map.recommendedFiles.length) { console.log('Recommended files:'); for (const file of map.recommendedFiles) console.log(`- ${file}`); } if (write) console.log('Wrote .aikc/index/repo-map.json'); }",
  ].join('\n');
}

function tokenBudgetCheckScript(): string {
  return [
    '#!/usr/bin/env node',
    '',
    "const { spawnSync } = require('node:child_process');",
    "const path = require('node:path');",
    "const root = path.resolve(__dirname, '..', '..');",
    'const args = process.argv.slice(2);',
    "const asJson = args.includes('--json');",
    "function value(name, fallback = '') { const index = args.indexOf(name); if (index >= 0) return args[index + 1] || fallback; const inline = args.find(arg => arg.startsWith(`${name}=`)); return inline ? inline.slice(name.length + 1) : fallback; }",
    "function run(parts) { const result = spawnSync(parts[0], parts.slice(1), { cwd: root, encoding: 'utf8', shell: false }); return { status: result.status ?? 1, output: `${result.stdout || ''}${result.stderr || ''}` }; }",
    "function check(id, ok, evidence) { return { id, status: ok ? 'pass' : 'error', evidence }; }",
    "const maxSummaryTokens = Number(value('--max-summary-tokens', '4000'));",
    "const maxRecommendedTokens = Number(value('--max-recommended-tokens', '20000'));",
    "const maxRunOutputChars = Number(value('--max-run-output-chars', '12000'));",
    "const context = run(['node', 'ai-knowledge/scripts/context-pack.cjs', '--summary', '--task', 'token budget regression']);",
    "let contextJson = null; try { contextJson = JSON.parse(context.output); } catch {}",
    "const repoMap = run(['node', 'ai-knowledge/scripts/repo-map.cjs', '--json', '--query', 'token workflow']);",
    "let repoMapJson = null; try { repoMapJson = JSON.parse(repoMap.output); } catch {}",
    "const bounded = run(['node', 'ai-knowledge/scripts/run-bounded.cjs', '--json', '--max-chars', String(maxRunOutputChars), '--', 'node', '-e', \"console.log('bounded output smoke')\"]);",
    "let boundedJson = null; try { boundedJson = JSON.parse(bounded.output); } catch {}",
    "const checks = [check('context-pack-json', context.status === 0 && contextJson !== null, contextJson ? 'valid JSON' : context.output.slice(0, 500)), check('context-summary-budget', contextJson && Math.ceil(JSON.stringify(contextJson).length / 4) <= maxSummaryTokens, contextJson ? `~${Math.ceil(JSON.stringify(contextJson).length / 4)} tokens` : 'no context JSON'), check('recommended-context-budget', contextJson?.budget && contextJson.budget.totalEstimatedTokens <= maxRecommendedTokens, contextJson?.budget ? `~${contextJson.budget.totalEstimatedTokens} tokens` : 'missing budget'), check('repo-map-json', repoMap.status === 0 && repoMapJson !== null, repoMapJson ? `${repoMapJson.fileCount} files indexed` : repoMap.output.slice(0, 500)), check('run-bounded-json', bounded.status === 0 && boundedJson !== null, boundedJson ? boundedJson.fullLogPath : bounded.output.slice(0, 500)), check('run-bounded-output-cap', boundedJson && boundedJson.recentOutput.length <= maxRunOutputChars, boundedJson ? `${boundedJson.recentOutput.length} chars` : 'no run-bounded JSON')];",
    "const summary = { status: checks.some(item => item.status === 'error') ? 'fail' : 'pass', limits: { maxSummaryTokens, maxRecommendedTokens, maxRunOutputChars }, checks };",
    "if (asJson) console.log(JSON.stringify(summary, null, 2)); else { console.log(`Token budget check: ${summary.status}`); for (const item of checks) console.log(`[${item.status}] ${item.id}: ${item.evidence}`); }",
    "if (summary.status === 'fail') process.exit(1);",
  ].join('\n');
}

function observeWorkflowScript(): string {
  return [
    '#!/usr/bin/env node',
    '',
    "const fs = require('node:fs');",
    "const os = require('node:os');",
    "const path = require('node:path');",
    "const { spawnSync } = require('node:child_process');",
    "const root = path.resolve(__dirname, '..', '..');",
    'const args = process.argv.slice(2);',
    "function value(name, fallback = '') { const index = args.indexOf(name); if (index >= 0) return args[index + 1] || fallback; const inline = args.find(arg => arg.startsWith(`${name}=`)); return inline ? inline.slice(name.length + 1) : fallback; }",
    "if (args.includes('--help') || args.includes('-h')) { console.log('Usage: node ai-knowledge/scripts/observe-workflow.cjs --phase start|end --task <task> [--json]'); process.exit(0); }",
    "const phase = value('--phase', 'snapshot');",
    "const task = value('--task', '');",
    "const asJson = args.includes('--json');",
    "function run(parts) { const result = spawnSync(parts[0], parts.slice(1), { cwd: root, encoding: 'utf8', shell: false, maxBuffer: 16 * 1024 * 1024 }); return { status: result.status ?? 1, output: `${result.stdout || ''}${result.stderr || ''}`.trim() }; }",
    "function json(parts) { const result = run(parts); if (result.status !== 0) return { ok: false, status: result.status, error: result.output.slice(0, 1000) }; try { return { ok: true, value: JSON.parse(result.output) }; } catch { return { ok: false, status: result.status, error: result.output.slice(0, 1000) }; } }",
    "function readJson(rel) { const file = path.join(root, rel); if (!fs.existsSync(file)) return null; try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\\uFEFF/, '')); } catch { return null; } }",
    "function version() { const pkg = readJson('package.json'); return typeof pkg?.version === 'string' ? pkg.version : null; }",
    "function workflowId() { const file = path.join(root, 'ai-workflow.yaml'); const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; return text.match(/^id:\\s*(.+)$/m)?.[1]?.trim() || path.basename(root); }",
    "function candidates() { const out = []; const stack = [root]; while (stack.length) { const current = stack.pop(); for (const entry of fs.readdirSync(current, { withFileTypes: true })) { if (['.git', 'node_modules', 'dist'].includes(entry.name)) continue; const absolute = path.join(current, entry.name); if (entry.isDirectory()) stack.push(absolute); else if (entry.isFile() && entry.name.endsWith('.aikc-upgrade.md')) out.push(path.relative(root, absolute).replaceAll(path.sep, '/')); } } return out; }",
    "function recentRuns() { const dir = path.join(root, '.aikc', 'runs'); if (!fs.existsSync(dir)) return []; return fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.log')).map(entry => { const absolute = path.join(dir, entry.name); const stat = fs.statSync(absolute); return { path: path.relative(root, absolute).replaceAll(path.sep, '/'), bytes: stat.size, mtimeMs: Math.round(stat.mtimeMs) }; }).sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 10); }",
    "const context = json(['node', 'ai-knowledge/scripts/context-pack.cjs', '--summary', '--task', task || 'workflow observation']);",
    "const tokenBudget = json(['node', 'ai-knowledge/scripts/token-budget-check.cjs', '--json']);",
    "const doctor = json(['node', 'ai-knowledge/scripts/doctor.cjs', '--json']);",
    "const taskState = json(['node', 'ai-knowledge/scripts/task-state.cjs', 'status', '--json']);",
    "const repoMap = readJson('.aikc/index/repo-map.json');",
    "const observation = { schemaVersion: 1, observedAt: new Date().toISOString(), phase, task, project: { id: workflowId(), root, packageVersion: version() }, contextPack: context.ok ? { budget: context.value.budget, stablePrefixHash: context.value.stablePrefixHash, recommendedFileCount: Array.isArray(context.value.recommendedFiles) ? context.value.recommendedFiles.length : 0, deferredCount: context.value.deferredCount ?? 0, warningCount: Array.isArray(context.value.warnings) ? context.value.warnings.length : 0 } : { error: context.error, status: context.status }, tokenBudget: tokenBudget.ok ? { status: tokenBudget.value.status, limits: tokenBudget.value.limits } : { error: tokenBudget.error, status: tokenBudget.status }, doctor: doctor.ok ? { status: doctor.value.status, checks: Array.isArray(doctor.value.checks) ? doctor.value.checks.map(item => ({ id: item.id, status: item.status })) : [] } : { error: doctor.error, status: doctor.status }, taskState: taskState.ok ? { status: taskState.value.status, phase: taskState.value.phase, checkpointCount: Array.isArray(taskState.value.checkpoints) ? taskState.value.checkpoints.length : 0, pendingGateCount: Array.isArray(taskState.value.pendingGates) ? taskState.value.pendingGates.length : 0 } : { error: taskState.error, status: taskState.status }, repoMap: repoMap ? { generatedAt: repoMap.generatedAt, fileCount: repoMap.fileCount, totalEstimatedTokens: repoMap.totalEstimatedTokens, recommendedFileCount: Array.isArray(repoMap.recommendedFiles) ? repoMap.recommendedFiles.length : 0 } : null, runBounded: { recentRuns: recentRuns() }, upgradeCandidates: candidates() };",
    "function append(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.appendFileSync(file, `${JSON.stringify(value)}\\n`, 'utf8'); }",
    "const projectLog = path.join(root, '.aikc', 'observability', 'workflow-observations.jsonl');",
    "const userLog = path.join(path.resolve(process.env.AIKC_HOME || path.join(os.homedir(), '.ai-knowledge-center')), 'observations', 'workflow-observations.jsonl');",
    "append(projectLog, observation); append(userLog, observation);",
    "if (asJson) console.log(JSON.stringify({ status: 'ok', projectLog: path.relative(root, projectLog).replaceAll(path.sep, '/'), userLog, observation }, null, 2)); else { console.log(`Workflow observation written: ${path.relative(root, projectLog).replaceAll(path.sep, '/')}`); console.log(`User observation log: ${userLog}`); }",
  ].join('\n');
}

function taskStateScript(): string {
  return "#!/usr/bin/env node\n\nconst fs = require('node:fs');\nconst path = require('node:path');\nconst root = path.resolve(__dirname, '..', '..');\nconst stateDir = path.join(root, '.aikc', 'task-state');\nconst statePath = path.join(stateDir, 'current.json');\nfunction now() { return new Date().toISOString(); }\nfunction value(args, name, fallback = '') { const i = args.indexOf(name); if (i >= 0) return args[i + 1] || fallback; const inline = args.find(arg => arg.startsWith(`${name}=`)); return inline ? inline.slice(name.length + 1) : fallback; }\nfunction read() { if (!fs.existsSync(statePath)) return null; return JSON.parse(fs.readFileSync(statePath, 'utf8').replace(/^\\uFEFF/, '')); }\nfunction write(state) { fs.mkdirSync(stateDir, { recursive: true }); fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\\n`, 'utf8'); }\nfunction print(state, json) { if (json) console.log(JSON.stringify(state, null, 2)); else console.log(`AIKC task state: ${state?.status || 'none'}\\nTask: ${state?.task || '(not set)'}\\nPhase: ${state?.phase || '(not set)'}\\nNext: ${state?.next || '(not set)'}`); }\nconst args = process.argv.slice(2); const cmd = args[0] || 'status'; const json = args.includes('--json');\nif (cmd === 'start') { const task = value(args, '--task', args.slice(1).join(' ') || '(task not provided)'); const state = { status: 'active', task, phase: 'start', summary: 'Workflow started.', next: 'Plan, execute, checkpoint, validate, closeout.', pendingGates: ['code-review', 'knowledge-check'], checkpoints: [{ at: now(), phase: 'start', summary: 'Task state initialized.', next: 'Continue task.' }], createdAt: now(), updatedAt: now() }; write(state); print(state, json); process.exit(0); }\nif (cmd === 'checkpoint') { const state = read() || { status: 'active', task: '(unknown task)', checkpoints: [], createdAt: now() }; state.status = 'active'; state.phase = value(args, '--phase', 'checkpoint'); state.summary = value(args, '--summary', 'Checkpoint recorded.'); state.next = value(args, '--next', state.next || 'Continue task.'); state.updatedAt = now(); state.checkpoints = Array.isArray(state.checkpoints) ? state.checkpoints : []; state.checkpoints.push({ at: state.updatedAt, phase: state.phase, summary: state.summary, next: state.next }); state.checkpoints = state.checkpoints.slice(-20); write(state); print(state, json); process.exit(0); }\nif (cmd === 'resume') { const state = read(); if (!state || state.status === 'closed') { print({ status: state?.status || 'none', next: 'Start a new task through ai-knowledge/LOAD.md.' }, json); process.exit(1); } state.resumeInstructions = ['Use this state instead of chat history.', 'Continue from next.', 'Write a checkpoint after the next meaningful action.', 'Run closeout and applicable gates before final response.']; print(state, json); process.exit(0); }\nif (cmd === 'close') { const state = read() || { task: '(unknown task)', checkpoints: [], createdAt: now() }; state.status = 'closed'; state.phase = 'closeout'; state.summary = value(args, '--summary', 'Task closed.'); state.next = 'No active task.'; state.pendingGates = []; state.updatedAt = now(); state.closedAt = state.updatedAt; write(state); print(state, json); process.exit(0); }\nif (cmd === 'status') { print(read() || { status: 'none', path: statePath }, json); process.exit(0); }\nconsole.error('Usage: task-state.cjs start|checkpoint|status|resume|close [--json]'); process.exit(1);";
}

function workflowSmokeEvalJson(): string {
  return JSON.stringify(
    {
      name: 'AIKC workflow smoke',
      cases: [
        { id: 'doctor', command: 'node ai-knowledge/scripts/doctor.cjs --json', expect: '"status"' },
        { id: 'context-pack', command: 'node ai-knowledge/scripts/context-pack.cjs --task "update AI workflow skill"', expect: 'recommendedFiles' },
        { id: 'context-pack-summary', command: 'node ai-knowledge/scripts/context-pack.cjs --summary --task "token heavy log review"', expect: 'toolOutputPolicy' },
        { id: 'repo-map', command: 'node ai-knowledge/scripts/repo-map.cjs --json --query "workflow token"', expect: 'recommendedFiles' },
        { id: 'run-bounded', command: 'node ai-knowledge/scripts/run-bounded.cjs --json -- node -e "console.log(\'bounded_smoke\')"', expect: 'fullLogPath' },
        { id: 'token-budget-check', command: 'node ai-knowledge/scripts/token-budget-check.cjs', expect: 'Token budget check: pass' },
        { id: 'observe-workflow', command: 'node ai-knowledge/scripts/observe-workflow.cjs --phase smoke --task "workflow observation smoke" --json', expect: 'workflow-observations.jsonl' },
        { id: 'knowledge', command: 'node ai-knowledge/scripts/knowledge-check.cjs', expect: 'knowledge ok' },
      ],
    },
    null,
    2
  );
}

function evalWorkflowScript(): string {
  return "#!/usr/bin/env node\n\nconst fs = require('node:fs');\nconst path = require('node:path');\nconst { spawnSync } = require('node:child_process');\nconst root = path.resolve(__dirname, '..', '..');\nconst spec = JSON.parse(fs.readFileSync(path.join(root, 'ai-knowledge/evals/workflow-smoke.json'), 'utf8'));\nfunction split(command) { return command.match(/(?:[^\\s\\\"]+|\\\"[^\\\"]*\\\")+/g)?.map(part => part.replace(/^\\\"|\\\"$/g, '')) || []; }\nconst results = [];\nfor (const testCase of spec.cases || []) {\n  const [command, ...args] = split(testCase.command);\n  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });\n  const output = `${result.stdout || ''}${result.stderr || ''}`;\n  const passed = result.status === 0 && output.includes(testCase.expect);\n  results.push({ id: testCase.id, status: passed ? 'pass' : 'fail', command: testCase.command, evidence: passed ? testCase.expect : output.trim().slice(0, 500) });\n}\nconst failed = results.filter(item => item.status === 'fail');\nconsole.log(JSON.stringify({ name: spec.name, status: failed.length ? 'fail' : 'pass', results }, null, 2));\nif (failed.length) process.exit(1);";
}

function humanReadmeMd(): string {
  return [
    '# AI Knowledge Human Guide',
    '',
    'This directory is the human-readable layer for the AI Knowledge Center workflow.',
    '',
    'Agents should read compact AI-facing files first: `ai-knowledge/LOAD.md`, `ai-knowledge/core/LOAD.md`, `ai-knowledge/ai/LOAD.md`, `ai-knowledge/skills/SKILL_INDEX.md`, and matched `ai-knowledge/skills/**/SKILL.md`.',
    '',
    'Human-readable files in this directory explain why the workflow exists, how to maintain it, and how to review changes. They are for onboarding, audits, documentation work, and knowledge migrations, not the default Agent context path.',
    '',
    'Update a human-readable companion only when the matching AI-facing knowledge, skill, or workflow meaning changes.',
  ].join('\n');
}

function humanCoreWorkflowMd(): string {
  return [
    '# AIKC Core Workflow',
    '',
    'AIKC separates compact Agent instructions from human-readable maintenance notes.',
    '',
    'The compact Agent path is `ai-knowledge/LOAD.md` -> `ai-knowledge/core/LOAD.md` -> `ai-knowledge/ai/LOAD.md` -> `ai-knowledge/skills/SKILL_INDEX.md` -> matched skills -> `ai-knowledge/core/LOAD-END.md`.',
    '',
    'Humans should use this file to understand the workflow contract without forcing every Agent run to load long explanations.',
    '',
    '## Core Ideas',
    '',
    '- `ai-knowledge/core/**` is AIKC-maintained workflow.',
    '- `ai-knowledge/skills/**` is project-owned reusable AI knowledge.',
    '- `ai-knowledge/human/**` is human-readable companion documentation.',
    '- `ai-knowledge/scripts/**` contains AI workflow automation and human-debuggable commands.',
    '- Non-read-only tasks must pass code review and applicable gates before completion.',
    '- Agent loops must be bounded with input, output, validation, budget, stop condition, and human escalation.',
  ].join('\n');
}

function ensureAikcCliScript(): string {
  return `#!/usr/bin/env node

const { spawnSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_NAME = 'ai-knowledge-center';
const CLI_NAME = 'aikc';
const REGISTRY = 'https://registry.npmjs.org';
const repoRoot = path.resolve(__dirname, '..', '..');

function stateRoot() {
  return path.resolve(process.env.AIKC_HOME || path.join(os.homedir(), '.ai-knowledge-center'));
}

function pidFilePath() {
  return path.join(stateRoot(), 'server.pid.json');
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });
}

function textOf(result) {
  return \`\${result.stdout || ''}\${result.stderr || ''}\`.trim();
}

function npmArgs(args) {
  return [...args, '--registry', REGISTRY];
}

function getLatestVersion() {
  const result = run('npm', npmArgs(['view', PACKAGE_NAME, 'version', '--json']));
  if (result.status !== 0) {
    throw new Error(\`Unable to query latest \${PACKAGE_NAME} version: \${textOf(result)}\`);
  }
  return JSON.parse(result.stdout.trim());
}

function getInstalledVersion() {
  const result = run('npm', npmArgs(['list', '-g', PACKAGE_NAME, '--depth=0', '--json']));
  if (!result.stdout.trim()) return null;
  try {
    const parsed = JSON.parse(result.stdout);
    return parsed.dependencies?.[PACKAGE_NAME]?.version ?? null;
  } catch {
    return null;
  }
}

function commandExists() {
  const command = process.platform === 'win32' ? 'where' : 'command';
  const args = process.platform === 'win32' ? [CLI_NAME] : ['-v', CLI_NAME];
  return run(command, args).status === 0;
}

function installLatest(reason, latest) {
  console.log(\`[aikc] \${reason}; installing \${PACKAGE_NAME}@\${latest} from \${REGISTRY}\`);
  const result = run('npm', npmArgs(['install', '-g', \`\${PACKAGE_NAME}@\${latest}\`]), { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(manualRetryMessage(latest));
  }
}

function manualRetryMessage(latest) {
  return [
    'Failed to install ' + PACKAGE_NAME + '@' + latest + '.',
    'Manual retry:',
    '  aikc stop',
    '  npm install -g ' + PACKAGE_NAME + '@' + latest,
    '  aikc',
  ].join('\\n');
}

function readServerState() {
  const pidPath = pidFilePath();
  if (!fs.existsSync(pidPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(pidPath, 'utf8').replace(/^\\uFEFF/, ''));
    if (typeof parsed.pid !== 'number') return null;
    return {
      pid: parsed.pid,
      host: typeof parsed.host === 'string' ? parsed.host : undefined,
      port: typeof parsed.port === 'number' ? parsed.port : undefined,
      args: Array.isArray(parsed.args) ? parsed.args.filter(arg => typeof arg === 'string') : [],
    };
  } catch {
    return null;
  }
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function waitForExit(pid, timeoutMs = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!isProcessRunning(pid)) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  return !isProcessRunning(pid);
}

function stopServerIfRunning(state) {
  if (!state || !isProcessRunning(state.pid)) return false;
  process.kill(state.pid);
  waitForExit(state.pid);
  fs.rmSync(pidFilePath(), { force: true });
  return true;
}

function startServerFromState(state) {
  if (!state) return;
  const restartArgs = state.args.length > 0 ? state.args.filter(arg => arg !== '--foreground') : [];
  if (restartArgs.length === 0) {
    if (state.host) restartArgs.push('--host', state.host);
    if (typeof state.port === 'number') restartArgs.push('--port', String(state.port));
  }
  const child = spawn(CLI_NAME, restartArgs, {
    cwd: repoRoot,
    detached: true,
    shell: process.platform === 'win32',
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

function installLatestWithServerHandling(reason, latest, runningServer, restartAfterUpdate) {
  const wasRunning = runningServer && isProcessRunning(runningServer.pid);
  if (wasRunning) {
    console.log('[aikc] Stopping running AI Knowledge Center server before global CLI update.');
    stopServerIfRunning(runningServer);
  }
  try {
    installLatest(reason, latest);
  } catch (error) {
    if (wasRunning && restartAfterUpdate) startServerFromState(runningServer);
    throw error;
  }
  if (wasRunning && restartAfterUpdate) {
    console.log('[aikc] Restarting AI Knowledge Center server after CLI update.');
    startServerFromState(runningServer);
  }
}

function ensureCli(options = {}) {
  const latest = getLatestVersion();
  const installed = getInstalledVersion();
  const hasCommand = commandExists();
  const runningServer = readServerState();
  const restartAfterUpdate = options.restartAfterUpdate !== false;

  if (!installed || !hasCommand) {
    installLatestWithServerHandling(\`CLI \${CLI_NAME} is missing\`, latest, runningServer, restartAfterUpdate);
    return latest;
  }

  if (installed !== latest) {
    installLatestWithServerHandling(\`CLI \${CLI_NAME} is \${installed}, latest is \${latest}\`, latest, runningServer, restartAfterUpdate);
    return latest;
  }

  console.log(\`[aikc] \${CLI_NAME} \${installed} is installed and up to date.\`);
  return installed;
}

function startAikc(extraArgs) {
  const child = spawn(CLI_NAME, ['--projects', repoRoot, ...extraArgs], {
    cwd: repoRoot,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  child.on('exit', code => {
    process.exit(code ?? 0);
  });
}

function upgradeProject(extraArgs) {
  const skipAi = extraArgs.includes('--no-ai');
  const filtered = extraArgs.filter(arg => arg !== '--no-ai');
  if (!skipAi && !filtered.includes('--ai')) filtered.push('--ai');
  const child = spawnSync(CLI_NAME, ['upgrade', '--project', repoRoot, '--write', ...filtered], {
    cwd: repoRoot,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  if (child.status !== 0) {
    throw new Error(\`Failed to run \${CLI_NAME} upgrade for \${repoRoot}\`);
  }
}

try {
  const args = process.argv.slice(2);
  ensureCli({ restartAfterUpdate: !args.includes('--start') });
  const upgradeIndex = args.indexOf('--upgrade');
  if (upgradeIndex >= 0) {
    const rawExtraArgs = args.slice(upgradeIndex + 1);
    const extraArgs = rawExtraArgs[0] === '--' ? rawExtraArgs.slice(1) : rawExtraArgs;
    upgradeProject(extraArgs);
  }
  const startIndex = args.indexOf('--start');
  if (startIndex >= 0) {
    const rawExtraArgs = args.slice(startIndex + 1);
    const extraArgs = rawExtraArgs[0] === '--' ? rawExtraArgs.slice(1) : rawExtraArgs;
    startAikc(extraArgs);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
`;
}

function workflowYaml(projectRoot: string): string {
  const basename = path.basename(projectRoot);
  const id = normalizeProjectId(basename);
  return stringify({
    schemaVersion: 1,
    id,
    name: basename,
    description: 'Project-provided AI workflow manifest.',
    knowledge: {
      load: 'ai-knowledge/LOAD.md',
      core: 'ai-knowledge/core',
      skills: 'ai-knowledge/skills',
      aiLoad: 'ai-knowledge/ai/LOAD.md',
      skillIndex: 'ai-knowledge/skills/SKILL_INDEX.md',
      closeoutPrompt: 'ai-knowledge/core/LOAD-END.md',
      agentsFile: 'AGENTS.md',
    },
    commands: [
      { id: 'aikc-ensure', label: 'Ensure AIKC CLI', command: 'node ai-knowledge/scripts/ensure-aikc-cli.cjs' },
      { id: 'aikc-start', label: 'Start AI Knowledge Center dashboard', command: 'node ai-knowledge/scripts/ensure-aikc-cli.cjs --start' },
      { id: 'aikc-upgrade', label: 'Upgrade AI workflow templates', command: 'node ai-knowledge/scripts/ensure-aikc-cli.cjs --upgrade' },
      { id: 'aikc-mcp', label: 'Run AIKC MCP server', command: 'aikc mcp --project .' },
      { id: 'ai-start', label: 'AI workflow start', command: 'node ai-knowledge/scripts/ai-workflow-start.cjs' },
      { id: 'ai-closeout', label: 'AI closeout', command: 'node ai-knowledge/scripts/ai-closeout.cjs' },
      { id: 'human-docs-check', label: 'Human-readable knowledge companion check', command: 'node ai-knowledge/scripts/human-docs-check.cjs' },
      { id: 'doctor', label: 'AIKC workflow doctor', command: 'node ai-knowledge/scripts/doctor.cjs' },
      { id: 'context-pack', label: 'AI context pack', command: 'node ai-knowledge/scripts/context-pack.cjs' },
      { id: 'log-summary', label: 'Summarize bounded log output', command: 'node ai-knowledge/scripts/log-summary.cjs' },
      { id: 'run-bounded', label: 'Run command with bounded output', command: 'node ai-knowledge/scripts/run-bounded.cjs' },
      { id: 'repo-map', label: 'Build AI repo map', command: 'node ai-knowledge/scripts/repo-map.cjs --write' },
      { id: 'token-budget-check', label: 'Token budget regression check', command: 'node ai-knowledge/scripts/token-budget-check.cjs' },
      { id: 'observe-workflow', label: 'Record workflow observation', command: 'node ai-knowledge/scripts/observe-workflow.cjs' },
      { id: 'task-state', label: 'AI task state checkpoint', command: 'node ai-knowledge/scripts/task-state.cjs status' },
      { id: 'eval-workflow', label: 'Workflow smoke eval', command: 'node ai-knowledge/scripts/eval-workflow.cjs' },
    ],
    gates: [
      { id: 'code-review', label: 'Code review', command: 'node ai-knowledge/scripts/code-review.cjs', category: 'review' },
      { id: 'knowledge-check', label: 'Knowledge check', command: 'node ai-knowledge/scripts/knowledge-check.cjs', category: 'knowledge' },
      { id: 'human-docs-check', label: 'Human-readable knowledge companion check', command: 'node ai-knowledge/scripts/human-docs-check.cjs', category: 'knowledge' },
      { id: 'eval-workflow', label: 'Workflow smoke eval', command: 'node ai-knowledge/scripts/eval-workflow.cjs', category: 'test' },
      { id: 'token-budget-check', label: 'Token budget regression check', command: 'node ai-knowledge/scripts/token-budget-check.cjs', category: 'test' },
    ],
    loops: {
      task: {
        input: 'user task plus project manifest',
        output: 'final response with changed files, validation, review, knowledge decision, and remaining risk',
        validation: ['code-review', 'knowledge-check', 'human-docs-check'],
        budget: { maxRetries: 2, maxRuntimeMs: 1_800_000 },
        stop: 'applicable gates pass and closeout decision is complete',
        escalate: 'same blocker repeats, destructive permission is needed, or task scope changes',
        description: 'Standard bounded task loop for non-read-only AI work.',
      },
      upgrade: {
        input: 'target project root and latest AIKC package',
        output: 'upgraded AI workflow files, candidate merges, and registered project',
        validation: ['knowledge-check', 'human-docs-check', 'token-budget-check'],
        budget: { maxRetries: 2, maxRuntimeMs: 900_000 },
        stop: 'templates are current or candidates are created for semantic merge',
        escalate: 'conflicting human docs or destructive overwrite would be required',
        description: 'Safe AI workflow initialization and upgrade loop.',
      },
    },
    mcp: {
      servers: [
        {
          id: 'aikc',
          label: 'AI Knowledge Center MCP',
          command: 'aikc mcp --project .',
          description: 'Repo-scoped AIKC MCP tools for manifest, doctor, context-pack, knowledge search, skills, and allowlisted gates.',
        },
      ],
    },
    integrations: {
      docs: {
        provider: 'context7',
        mode: 'optional',
        label: 'Context7 docs',
        description: 'Optional current package documentation lookup for implementation tasks.',
      },
      repoDocs: {
        provider: 'custom',
        mode: 'optional',
        label: 'Repository docs MCP',
        description: 'Optional task-scoped open-source repository documentation lookup for external package research; prefer read-only and do not broaden local filesystem scope.',
      },
      semanticCodeSearch: {
        provider: 'custom',
        mode: 'optional',
        label: 'Semantic code-search MCP',
        description: 'Optional repository-scoped semantic code retrieval when AIKC repo-map recommendations are too broad for large codebases.',
      },
      browserQa: {
        provider: 'playwright',
        mode: 'optional',
        label: 'Playwright QA',
        description: 'Optional browser smoke testing for dashboard or web UI changes.',
      },
      vcs: {
        provider: 'github-mcp',
        mode: 'optional',
        label: 'GitHub MCP',
        description: 'Optional GitHub issue, pull request, release, and workflow integration.',
      },
    },
    telemetry: { enabled: true, serviceName: id, exporter: 'console' },
    dagger: { enabled: false, modulePath: '.' },
    dashboard: { watch: ['ai-knowledge/core', 'ai-knowledge/skills', 'ai-knowledge/references', 'AGENTS.md'], links: [] },
  });
}

function templates(projectRoot: string): Array<{ path: string; content: string }> {
  const projectName = path.basename(projectRoot);
  return [
    { path: 'ai-knowledge/LOAD.md', content: loadMd(projectName) },
    { path: '.aikcignore', content: aikcIgnoreMd() },
    { path: 'ai-knowledge/core/LOAD.md', content: coreLoadMd() },
    { path: 'ai-knowledge/core/LOAD-END.md', content: loadEndMd() },
    { path: 'ai-knowledge/core/human-friendly-task-summary.md', content: humanFriendlySummaryMd() },
    { path: 'ai-knowledge/core/task-closeout-verification.md', content: verificationMd() },
    { path: 'ai-knowledge/core/task-closeout-risk-report.md', content: riskReportMd() },
    { path: 'ai-knowledge/core/code-review-policy.md', content: codeReviewPolicyMd() },
    { path: 'ai-knowledge/core/knowledge-capture-policy.md', content: knowledgeCapturePolicyMd() },
    { path: 'ai-knowledge/core/script-automation-policy.md', content: scriptAutomationPolicyMd() },
    { path: 'ai-knowledge/core/bounded-loop-policy.md', content: boundedLoopPolicyMd() },
    { path: 'ai-knowledge/core/human-readable-knowledge-policy.md', content: humanReadableKnowledgePolicyMd() },
    { path: 'ai-knowledge/core/token-efficiency.md', content: tokenEfficiencyMd() },
    { path: 'ai-knowledge/core/open-source-token-tools.md', content: openSourceTokenToolsMd() },
    { path: 'ai-knowledge/core/project-capabilities.md', content: projectCapabilitiesMd() },
    { path: 'ai-knowledge/core/open-source-usage.md', content: openSourceUsageMd() },
    { path: 'ai-knowledge/ai/LOAD.md', content: aiLoadMd() },
    { path: 'ai-knowledge/skills/SKILL_INDEX.md', content: skillIndexMd() },
    { path: 'ai-knowledge/human/README.md', content: humanReadmeMd() },
    { path: 'ai-knowledge/human/core-workflow.md', content: humanCoreWorkflowMd() },
    { path: 'ai-knowledge/prompt/task-closeout.md', content: taskCloseoutMd() },
    { path: 'ai-knowledge/scripts/README.md', content: knowledgeScriptsReadmeMd() },
    { path: 'ai-knowledge/scripts/ensure-aikc-cli.cjs', content: ensureAikcCliScript() },
    { path: 'ai-knowledge/scripts/ai-workflow-start.cjs', content: aiWorkflowStartScript() },
    { path: 'ai-knowledge/scripts/ai-closeout.cjs', content: aiCloseoutScript() },
    { path: 'ai-knowledge/scripts/code-review.cjs', content: codeReviewScript() },
    { path: 'ai-knowledge/scripts/context-pack.cjs', content: contextPackScript() },
    { path: 'ai-knowledge/scripts/log-summary.cjs', content: logSummaryScript() },
    { path: 'ai-knowledge/scripts/run-bounded.cjs', content: runBoundedScript() },
    { path: 'ai-knowledge/scripts/repo-map.cjs', content: repoMapScript() },
    { path: 'ai-knowledge/scripts/token-budget-check.cjs', content: tokenBudgetCheckScript() },
    { path: 'ai-knowledge/scripts/observe-workflow.cjs', content: observeWorkflowScript() },
    { path: 'ai-knowledge/scripts/doctor.cjs', content: doctorScript() },
    { path: 'ai-knowledge/scripts/task-state.cjs', content: taskStateScript() },
    { path: 'ai-knowledge/scripts/eval-workflow.cjs', content: evalWorkflowScript() },
    { path: 'ai-knowledge/scripts/human-docs-check.cjs', content: humanDocsCheckScript() },
    { path: 'ai-knowledge/scripts/knowledge-check.cjs', content: knowledgeCheckScript() },
    { path: 'ai-knowledge/evals/workflow-smoke.json', content: workflowSmokeEvalJson() },
    { path: 'AGENTS.md', content: agentsMd(projectName) },
    { path: 'ai-workflow.yaml', content: workflowYaml(projectRoot) },
  ];
}

async function writeCandidate(projectRoot: string, relPath: string, content: string): Promise<string> {
  const candidate = `${relPath}.aikc-upgrade.md`;
  const target = path.join(projectRoot, candidate);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
  return candidate;
}

async function upgradeTemplateFile(options: UpgradeOptions, relPath: string, content: string): Promise<UpgradeReportItem> {
  const target = path.join(options.projectRoot, relPath);
  const existing = await readTextIfExists(target);
  if (existing === null) {
    if (options.write) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, 'utf8');
    }
    return { path: relPath, action: 'create', note: options.write ? 'created' : 'would create' };
  }

  if (normalizeNewlines(existing) === normalizeNewlines(content)) {
    return { path: relPath, action: 'unchanged', note: 'already matches current template' };
  }

  if (relPath === 'ai-workflow.yaml' && !options.force) {
    const merged = mergeWorkflowYaml(existing, content);
    if (merged !== null && normalizeNewlines(merged) === normalizeNewlines(existing)) {
      return { path: relPath, action: 'unchanged', note: 'manifest already has required AIKC commands, gates, loops, and dashboard paths' };
    }
    if (merged !== null) {
      if (options.write) {
        await fs.writeFile(target, merged, 'utf8');
        return { path: relPath, action: 'update', note: 'safely merged missing AIKC commands, gates, loops, and dashboard watch paths' };
      }
      return { path: relPath, action: 'update', note: 'would safely merge missing AIKC commands, gates, loops, and dashboard watch paths' };
    }
  }

  if (options.force) {
    if (options.write) {
      const backup = `${relPath}.aikc-backup-${String(Date.now())}`;
      await fs.mkdir(path.dirname(path.join(options.projectRoot, backup)), { recursive: true });
      await fs.copyFile(target, path.join(options.projectRoot, backup));
      await fs.writeFile(target, content, 'utf8');
      return { path: relPath, action: 'update', note: `overwritten; backup: ${backup}` };
    }
    return { path: relPath, action: 'update', note: 'would overwrite because --force was set' };
  }

  if (options.write) {
    const candidate = await writeCandidate(options.projectRoot, relPath, content);
    return { path: relPath, action: 'propose', note: `local file differs; wrote candidate ${candidate}` };
  }
  return { path: relPath, action: 'conflict', note: 'local file differs; use --write to create a candidate or --force to overwrite' };
}

function upgradePackageJson(options: UpgradeOptions): UpgradeReportItem {
  void options;
  return {
    path: 'package.json',
    action: 'skip',
    note: 'left untouched; AIKC workflow scripts live under ai-knowledge/scripts and ai-workflow.yaml uses direct commands',
  };
}

function needsAiHandoff(items: UpgradeReportItem[], options: UpgradeOptions): boolean {
  return options.ai || items.some(item => item.action === 'conflict' || item.action === 'propose');
}

function aiUpgradePrompt(options: UpgradeOptions, items: UpgradeReportItem[]): string {
  const relevant = items.filter(item => ['conflict', 'propose', 'create', 'update', 'skip'].includes(item.action));
  const lines = relevant.map(item => `| ${item.action} | ${item.path} | ${item.note.replace(/\|/g, '\\|')} |`).join('\n');
  return `# AIKC AI Upgrade Handoff

Project: \`${options.projectRoot}\`
Template version: \`${TEMPLATE_VERSION}\`

You are upgrading this project's AI workflow knowledge base. This project may already contain local templates, rules, skills, prompts, reply formats, and older AI workflows. Do semantic merge work. Do not blindly replace existing project knowledge.

## Upgrade Policy

1. Treat existing project files as source of truth for project-specific constraints.
2. Treat \`ai-knowledge/core/**\` candidates as AIKC-maintained workflow upgrades.
3. Treat \`ai-knowledge/skills/**\` and project-owned references as project knowledge; preserve project-specific content.
4. Treat \`*.aikc-upgrade.md\` files as candidate upstream templates, not final answers.
5. Merge useful upstream improvements into the original files only after reading both sides.
6. Preserve local conventions, package manager choices, MCP settings, integrations, build gates, response templates, skill routing, knowledge-capture decisions, and existing AI workflow contracts.
7. If a candidate conflicts with a stronger project rule, keep the project rule and document the decision.
8. Do not delete candidate files unless the user explicitly asks or the merged result clearly supersedes them.
9. Old projects should be upgraded additively: keep local knowledge, add missing doctor/context/eval scripts, human-readable companions, bounded loop metadata, AIKC MCP metadata, and optional integration declarations.

## Files To Review

| action | path | note |
| --- | --- | --- |
${lines || '| unchanged | all templates | no upgrade work was detected |'}

## Recommended Agent Steps

1. Read \`ai-knowledge/LOAD.md\`, \`ai-knowledge/core/LOAD.md\`, \`ai-knowledge/ai/LOAD.md\`, \`AGENTS.md\`, and \`ai-workflow.yaml\` when present.
2. For every \`propose\` item, compare the original file with its \`*.aikc-upgrade.md\` candidate.
3. Upgrade the original file by semantic merge. Keep local project details and add only the reusable improvements.
4. For missing files created by the CLI, check whether they need local customization.
5. Verify \`ai-knowledge/core/knowledge-capture-policy.md\` exists and closeout requires a knowledge-capture decision.
6. Keep AIKC internal workflow scripts under \`ai-knowledge/scripts\` with human usage notes in \`ai-knowledge/scripts/README.md\`; do not add those internal commands to the host \`package.json\`.
7. Ensure \`ai-workflow.yaml\` keeps repo-scoped MCP defaults: the AIKC MCP server should run as \`aikc mcp --project .\`; filesystem MCP must stay repository-scoped unless the user explicitly approves a broader scope.
8. Preserve optional \`integrations\` declarations for docs, repository-docs lookup, semantic code search, browser QA, and GitHub automation. Do not enable network, browser, GitHub, semantic indexing, or broader filesystem access unless the task explicitly needs it.
9. Run \`node ai-knowledge/scripts/ensure-aikc-cli.cjs --upgrade\` when present; if npm global update fails, retry after \`aikc stop\`, and if it still fails report the failure plus manual retry commands.
10. Run \`node ai-knowledge/scripts/doctor.cjs --json\`, \`node ai-knowledge/scripts/eval-workflow.cjs\`, \`node ai-knowledge/scripts/code-review.cjs\`, \`node ai-knowledge/scripts/knowledge-check.cjs\`, and the project's applicable checks when those scripts exist.
11. Finish with the project's reply template and closeout rules, including changed files, global CLI update result, code review result, validation, remaining risk, knowledge-capture decision, and reusable automation/token-efficiency decision when applicable.

## Important Boundary

The npm CLI is only the distributor and scanner. The AI Agent is responsible for adapting templates to this repository.
`;
}

async function writeAiHandoff(options: UpgradeOptions, items: UpgradeReportItem[]): Promise<UpgradeReportItem | null> {
  if (!options.write || !needsAiHandoff(items, options)) return null;
  const relPath = '.aikc/upgrade/AI_UPGRADE_PROMPT.md';
  const target = path.join(options.projectRoot, relPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, aiUpgradePrompt(options, items), 'utf8');
  return {
    path: relPath,
    action: 'handoff',
    note: 'wrote AI semantic-merge prompt for this project',
  };
}

function registryPathKey(projectPath: string): string {
  const resolved = path.resolve(projectPath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

async function registerProject(options: UpgradeOptions): Promise<UpgradeReportItem | null> {
  if (!options.write) return null;

  const registryPath = userRegistryPath();
  const relPath = path.relative(options.projectRoot, registryPath);
  const projectEntry = { path: options.projectRoot };
  let projects: Array<Record<string, unknown>> = [];
  const existing = await readTextIfExists(registryPath);

  if (existing !== null) {
    try {
      const parsed = JSON.parse(existing.replace(/^\uFEFF/, '')) as { projects?: unknown };
      if (Array.isArray(parsed.projects)) {
        projects = parsed.projects.filter(item => item && typeof item === 'object') as Array<Record<string, unknown>>;
      }
    } catch {
      return {
        path: relPath,
        action: 'skip',
        note: 'invalid JSON in user projects registry; preserved existing file',
      };
    }
  }

  const targetKey = registryPathKey(options.projectRoot);
  const existingIndex = projects.findIndex(item => typeof item['path'] === 'string' && registryPathKey(item['path']) === targetKey);
  if (existingIndex >= 0) {
    return {
      path: relPath,
      action: 'unchanged',
      note: 'project already registered in user AIKC registry',
    };
  }

  projects.push(projectEntry);
  await fs.mkdir(path.dirname(registryPath), { recursive: true });
  await fs.writeFile(registryPath, `${JSON.stringify({ projects }, null, 2)}\n`, 'utf8');
  return {
    path: relPath,
    action: 'register',
    note: 'added project to user AIKC registry',
  };
}

function printReport(items: UpgradeReportItem[], options: UpgradeOptions): void {
  console.log(`AIKC project upgrade ${options.write ? 'write' : 'dry-run'}: ${options.projectRoot}`);
  console.log('');
  for (const item of items) {
    console.log(`- ${item.action.padEnd(9)} ${item.path} - ${item.note}`);
  }
  if (!options.write) {
    console.log('');
    console.log('No files were changed. Re-run with --write to create missing files, candidate upgrades, and an AI handoff prompt.');
  } else if (items.some(item => item.action === 'handoff')) {
    console.log('');
    console.log('Next: ask your AI Agent to read .aikc/upgrade/AI_UPGRADE_PROMPT.md and merge candidates semantically.');
  }
}

export async function runProjectUpgrade(args: string[]): Promise<void> {
  if (hasFlag(args, '--help') || hasFlag(args, '-h')) {
    console.log(`AI Knowledge Center project upgrade

Usage:
  aikc upgrade --project <path> [--write] [--ai] [--force]

Options:
  --project <path>   Target project root. Default: current directory
  --write            Create missing files and *.aikc-upgrade.md candidates
  --ai               Write .aikc/upgrade/AI_UPGRADE_PROMPT.md even when no conflict is detected
  --force            Overwrite conflicting template files after writing *.aikc-backup-*; use rarely
  --dry-run          Explicit dry-run mode. This is the default
`);
    return;
  }

  const projectRoot = path.resolve(readOption(args, '--project') ?? process.cwd());
  const write = hasFlag(args, '--write') && !hasFlag(args, '--dry-run');
  const force = hasFlag(args, '--force');
  const ai = hasFlag(args, '--ai');
  const options: UpgradeOptions = { projectRoot, write, force, ai };

  if (!(await pathExists(projectRoot))) {
    throw new Error(`Project path does not exist: ${projectRoot}`);
  }

  const results: UpgradeReportItem[] = [];
  for (const template of templates(projectRoot)) {
    results.push(await upgradeTemplateFile(options, template.path, template.content));
  }
  results.push(upgradePackageJson(options));
  const handoff = await writeAiHandoff(options, results);
  if (handoff) results.push(handoff);
  const registration = await registerProject(options);
  if (registration) results.push(registration);
  printReport(results, options);
}

