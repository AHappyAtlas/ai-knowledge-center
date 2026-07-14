import fs from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import { workflowManifestSchema, type RegistryEntry } from '../shared/manifest.js';

export type ProjectInitializationResult = {
  autoInit: boolean;
  initializedNow: boolean;
  missingBefore: boolean;
  createdFiles: string[];
};

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function normalizeProjectId(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
}

async function writeFileIfMissing(projectRoot: string, relPath: string, content: string): Promise<string | null> {
  const target = path.join(projectRoot, relPath);
  if (await pathExists(target)) return null;

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
  return relPath.replace(/\\/g, '/');
}

function loadMd(name: string): string {
  return `# ${name} AI Workflow

This project was initialized by AI Knowledge Center.

## Agent Entry

User entrypoint: \`按 ai-knowledge/LOAD.md 执行, 任务：<one sentence task>\`

1. Read \`AGENTS.md\`, this file, \`ai-knowledge/core/LOAD.md\`, and \`ai-knowledge/ai/LOAD.md\` before starting project-specific work.
2. Check \`ai-knowledge/skills/SKILL_INDEX.md\` for available project skills.
3. Read \`ai-knowledge/core/knowledge-capture-policy.md\` and make a knowledge-capture precheck.
4. Run gates declared in \`ai-workflow.yaml\` before declaring completion.
5. Complete \`ai-knowledge/core/LOAD-END.md\` before final response.

## Project Notes

- Add project rules here.
- Keep durable project knowledge in \`ai-knowledge/skills\` or project references so it follows Git branches and reviews.
- Keep AIKC-maintained workflow in \`ai-knowledge/core\`; do not put project-specific lessons there.
`;
}

const coreLoadMd = `# AIKC Core Load - Stage 0

This file is AIKC-maintained core workflow. Project-specific knowledge belongs in \`ai-knowledge/skills\` or project references, not here.

Run \`node ai-knowledge/scripts/ai-workflow-start.cjs --task "<task>"\`, then read \`ai-knowledge/skills/SKILL_INDEX.md\`.

Before editing, read \`ai-knowledge/core/knowledge-capture-policy.md\` and decide whether this task may produce reusable project knowledge.

First reply should include the loaded entrypoints, applicable constraints, and a knowledge-capture precheck.

If a task repeats an operation future agents will run again, prefer packaging it as a project script, project skill, MCP/server tool, or reference. Identify local host OS and remote target OS before packaging.
Use \`ai-knowledge/core/script-automation-policy.md\` when repeated Agent operations should become maintained scripts. AI workflow scripts live under \`ai-knowledge/scripts\` and must not be added to host project \`package.json\`.
For token efficiency, prefer minimal context loading, summaries before raw logs, structured output, caches for low-frequency checks, operations indexes, doctor commands, and compact closeout.
Use \`ai-knowledge/core/bounded-loop-policy.md\` when creating or changing Agent loops, recurring workflows, self-update paths, review cycles, retry cycles, maintenance checks, or autonomous automation.
Use \`ai-knowledge/core/human-readable-knowledge-policy.md\` when changing AI-facing knowledge, skills, human-readable companions, documentation, onboarding, or knowledge migrations.
Use \`ai-knowledge/core/project-capabilities.md\` for AIKC manifest, dashboard, gates, commands, MCP, telemetry, Dagger, API, upgrade, discovery, and release behavior.
Use \`ai-knowledge/core/open-source-usage.md\` before hand-rolling functionality that mature packages already solve.
`;

const aiLoadMd = `# Agent Load - Stage 0 Compatibility

Read \`ai-knowledge/core/LOAD.md\`. This file is kept for older agents and scripts.
`;

const loadEndMd = `# AIKC Core Load - Stage 1 Closeout

Before finishing non-read-only work:

1. Review the request and diff.
2. Read \`ai-knowledge/core/code-review-policy.md\`, perform code review, and run \`node ai-knowledge/scripts/code-review.cjs\`.
3. Run applicable gates; knowledge-only changes at least run \`node ai-knowledge/scripts/knowledge-check.cjs\`.
4. Read \`ai-knowledge/core/knowledge-capture-policy.md\`.
5. Update project skills or project references when reusable verified project knowledge was produced.
6. If a repeated operation appeared, read \`ai-knowledge/core/script-automation-policy.md\` and decide whether to package it as an \`ai-knowledge/scripts\` script, skill, MCP/server tool, or reference.
7. If a loop appeared or changed, read \`ai-knowledge/core/bounded-loop-policy.md\` and confirm input, output, validation, budget, stop condition, and human escalation.
8. If AI-facing knowledge or skills changed, read \`ai-knowledge/core/human-readable-knowledge-policy.md\` and update the human-readable companion only when the meaning changed.
9. Final response must include code review and knowledge capture decisions.

## Reply Message Rules

- Progress replies should be short and say what is being checked, changed, or validated.
- Final replies for non-read-only work must include changed files, validation commands and results, remaining risk, knowledge-capture decision, and reusable automation/token-efficiency decision when applicable.
- Use tables for final replies when any area contains multiple sub-items. Prefer rows over nested bullets for changed files, validation commands, knowledge decisions, automation candidates, cache decisions, and risks.
- Final replies must not paste secrets, account data, subscription URLs, raw tokens, or long logs.
- If validation or publishing failed, the final reply must say the exact command that failed and the remaining risk.
- If no files changed, say validation is N/A or list the read-only checks that were run.

If knowledge should have been captured but was not, the task is not complete.
If code review or an applicable gate fails, the task is not complete.
If a repeated operation was observed but no automation packaging decision was reported, the task is not complete.
`;

const humanFriendlySummaryMd = `# Human-Friendly Task Summary

Replies are part of the workflow contract. Keep them short, concrete, and honest.

## Progress Replies

- Say what is being inspected, changed, or validated.
- Mention blockers as soon as they are known.
- Do not paste secrets, account data, subscription URLs, raw tokens, or long logs.

## Final Replies

Required for non-read-only tasks:

| Area | Item | Status | Details |
| --- | --- | --- | --- |
| Changed | \`path\` | changed | What changed and why. |
| Code review | \`node ai-knowledge/scripts/code-review.cjs\` | passed/failed/N/A | Review decision and notable finding. |
| Validation | \`command\` | passed/failed/not run | Reason, failure summary, or skipped-check explanation. |
| Knowledge capture | \`ai-knowledge/...\` or N/A | yes/no | Reusable lesson captured, or why not. |
| Automation/efficiency | script/skill/MCP/reference/cache/doctor/N/A | yes/no | Repeated operation, token saving, or why no packaging was warranted. |
| Risk | item | none/low/medium/high | What remains for the user to know or confirm. |

Use one table per concern when there are many sub-items. Keep cells compact and reference long logs or transcripts instead of pasting them.

## Multi-Item Tables

Use tables for changed files, validation commands, knowledge decisions, automation candidates, cache decisions, and risks when there are multiple rows to report.

Build, validation, or publish failures cannot be reported as complete; include the failed command and residual risk.
`;

const codeReviewPolicyMd = `# Code Review Policy

Code review is a required completion gate for every non-read-only task. A task is not done until the code review decision and all applicable gates pass.

## Required Review Steps

1. Re-read the user request and compare it with the actual changed files.
2. Inspect the diff or changed files for behavior regressions, missing validation, unsafe filesystem/network changes, secrets, and unrelated edits.
3. Confirm unresolved upgrade candidates such as \`*.aikc-upgrade.md\` are either semantically merged or intentionally left with a clear reason.
4. Run \`node ai-knowledge/scripts/code-review.cjs\`.
5. Run all applicable gates from \`ai-workflow.yaml\`.
6. If any review issue or gate fails, fix it and rerun review plus gates before final response.

## Final Response Requirement

- Code review: passed/failed/skipped, command run, and review decision.
- Gates: commands run and results.
- Remaining risk: no known risk or specific residual risk.
`;

const taskCloseoutVerificationMd = `# Task Closeout Verification

Report V1-V4 before finishing non-read-only tasks.

| ID | Item | Applies When | Passing Signal |
| --- | --- | --- | --- |
| V1 | Knowledge check | Any AI knowledge or workflow change | \`node ai-knowledge/scripts/knowledge-check.cjs\` exits 0 |
| V2 | Typecheck/build | Source code or config changed | The project typecheck/build gate exits 0 |
| V3 | Artifact/build output | Generated assets, bundles, docs, or release artifacts changed | Artifacts are regenerated and no stale/missing output remains |
| V4 | Runtime/performance/load | Server, background task, polling, broadcast, or hot path changed | No unexplained errors or load regressions in the relevant check |
| V5 | Code review | Any non-read-only task | \`node ai-knowledge/scripts/code-review.cjs\` exits 0 and the Agent reports a review decision |
`;

const taskCloseoutRiskReportMd = `# Task Closeout Risk Report

Report R1-R13 before finishing non-read-only tasks.

| ID | Dimension | Check |
| --- | --- | --- |
| R1 | Build/typecheck | Did the selected V1-V5 gates run, or is the reason for skipping explicit? |
| R2 | Frontend/UI | Did UI/API-client changes build, avoid overlap, and preserve existing workflow ergonomics? |
| R3 | Backend/runtime | Did service, polling, broadcast, cache, or hot-path changes avoid unnecessary load? |
| R4 | Shared state/critical path | Did changes avoid corrupting accounts, sessions, queues, cluster state, and ownership boundaries? |
| R5 | Operational regression | Are important user workflows and deployment scenarios considered when relevant? |
| R6 | Secrets/network | Did output and docs avoid secrets, broad host binding, risky proxy/TUN changes, and exposed paths? |
| R7 | Knowledge loop | Did reusable, verified project lessons get added to skills or references when warranted, and did the final response explain why? |
| R8 | Diff scope | Are unrelated uncommitted changes preserved and ignored unless directly required? |
| R9 | Reusable automation | Did repeated operations get evaluated for packaging as scripts, skills, MCP/server tools, or references with local/remote OS boundaries? |
| R10 | Token efficiency | Did long logs, repeated diagnostics, health checks, or workflow-size problems get evaluated for summaries, structured output, caches, operations indexes, or doctor commands? |
| R11 | Code review | Did review inspect correctness, tests, security, operations, docs, maintainability, and unresolved findings before completion? |
| R12 | Bounded loops | Did any new or changed loop define input, output, validation, budget, stop condition, and human escalation? |
`;

const skillIndexMd = `# Skill Index

Add one row per project-specific skill.

| id | when to use | path |
| --- | --- | --- |
| project-start | Read before project work | ai-knowledge/LOAD.md |
`;

const aikcIgnoreMd = `# AIKC context denylist. Keep high-churn and generated files out of default AI context.
.git/**
.aikc/runs/**
.aikc/index/**
.aikc/observability/**
ai-knowledge/human/**
ai-knowledge/references/**
ai-knowledge/.token-check-state.json
node_modules/**
dist/**
build/**
coverage/**
.cache/**
.vite/**
.next/**
.turbo/**
*.log
*.tmp
*.aikc-upgrade.md
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
`;

const closeoutMd = `# Task Closeout

Before declaring done:

1. Re-read the task request.
2. Run the gates declared in \`ai-workflow.yaml\`.
3. Read \`ai-knowledge/core/LOAD-END.md\`.
4. Report what changed, what was verified, any remaining risk, and the knowledge-capture decision.
`;

const knowledgeCapturePolicyMd = `# Knowledge Capture Policy

Capture reusable, verified project knowledge:

- project constraints;
- repeated failure modes and proven fixes;
- validation commands or environment caveats;
- deployment, runtime, cluster, proxy, login, or operational workflows;
- stable UI/backend contracts or state-machine rules;
- repeated local or remote operations that should become scripts, skills, MCP/server tools, or references to reduce future token and command-discovery cost.

Do not capture one-off chat transcripts, unverified guesses, secrets, tokens, account/session data, or ephemeral runtime values.
Do not capture project-specific lessons in \`ai-knowledge/core\`; core is AIKC-maintained workflow.
Keep AI-facing skills compact. Add or update \`ai-knowledge/human/skills/<skill-id>.md\` only when the matching skill meaning changes or a missing companion is being backfilled.
Before packaging automation, identify local host OS, remote target OS when applicable, transport, stable inputs and outputs, validation command, and failure signal.

Every non-read-only final response must include:

\`\`\`text
知识沉淀：是/否
位置：ai-knowledge/... 或 N/A
原因：为什么沉淀或为什么不沉淀
\`\`\`
`;

const scriptAutomationPolicyMd = `# Script Automation Policy

Repeated Agent operations should become maintained AI knowledge scripts when doing so reduces repeated discovery, long prompts, fragile shell snippets, or token-heavy troubleshooting.

## When To Script

Create or update a script when an operation is expected to repeat and has stable inputs, validation, or failure handling.

## Script Standards

- support \`--help\` for non-trivial scripts;
- support \`--dry-run\` before destructive or broad changes;
- prefer explicit named flags over ambiguous positional arguments;
- print concise summaries by default;
- be idempotent where possible;
- use safe defaults and fail closed;
- separate local host OS behavior from remote target OS behavior;
- document required environment variables without printing secret values.

## Agent Responsibilities

Add or update AI workflow scripts under \`ai-knowledge/scripts\`, document human usage in \`ai-knowledge/scripts/README.md\`, register commands or gates in \`ai-workflow.yaml\` with exact \`command\` entries, and add validation to \`ai-knowledge/scripts/knowledge-check.cjs\` when a script becomes part of the workflow contract.

Host project \`package.json\` must not be used as the registry for AIKC internal workflow scripts.

## Automation Candidate Table

During closeout, report every repeated operation or script-worthy opportunity in a compact table, even when the decision is "no script".

| Operation | Evidence | Decision | Location | Reason |
| --- | --- | --- | --- | --- |
| Brief operation name | Repeated command, long diagnostic, fragile shell snippet, or recurring project workflow | script/skill/MCP/reference/cache/doctor/no | \`ai-knowledge/...\` or N/A | Why this packaging is or is not worth it |
`;

const boundedLoopPolicyMd = `# Bounded Loop Policy

Use bounded loops for AI workflow automation. AIKC should prefer explicit, verifiable loops over open-ended autonomous agents.

## Loop Contract

Every loop must define input, output, validation, budget, stop condition, and human escalation.

If any of these fields cannot be stated, keep the workflow as a human-guided task instead of an automated loop.

## Preferred Loops

- Task loop: load knowledge, act, verify, review, capture reusable knowledge, then respond.
- Upgrade loop: update AIKC, preserve project knowledge, merge candidates, validate manifests, and restart running Web when needed.
- Review loop: inspect changed behavior, run gates, fix findings, and repeat until code review and applicable gates pass.
- Knowledge loop: decide whether a lesson is reusable, put project-specific knowledge in skills or references, and keep AIKC-maintained workflow in core.
- Automation loop: when repeated operations appear, package them as scripts, skills, MCP/server tools, or references with local and remote OS boundaries.
- Maintenance loop: check package version, core template drift, project registration, Web process health, and manifest validity.

## Anti-Patterns

- Do not run indefinite autonomous loops without a budget and stop condition.
- Do not let a loop overwrite human docs, local config, project knowledge, or uncommitted work blindly.
- Do not hide failed validation behind a summarized success message.
- Do not keep retrying commands after the same blocker repeats; escalate with evidence.
- Do not use loop automation for secrets, destructive operations, broad network exposure, or decisions that require fresh human judgment.
`;

const humanReadableKnowledgePolicyMd = `# Human-Readable Knowledge Policy

AIKC knowledge should have two layers:

- AI-facing knowledge: compact, trigger-oriented, and optimized for minimal token loading.
- Human-readable knowledge: explanatory, reviewable, and suitable for maintainers who need context without reading every AI prompt.

Keep human-readable companions under \`ai-knowledge/human/**\`.
Use \`ai-knowledge/human/README.md\` as the human entrypoint.
For each project skill at \`ai-knowledge/skills/<skill-id>/SKILL.md\`, add a companion at \`ai-knowledge/human/skills/<skill-id>.md\`.

Update human-readable companions only when the corresponding AI-facing knowledge, skill, or workflow meaning changes.
Agents should load compact AI-facing files first and avoid reading \`ai-knowledge/human/**\` unless the user asks for explanation, docs, onboarding, review, or a companion update.
`;

const tokenEfficiencyMd = `# Token Efficiency Policy

Use this policy to reduce repeated context, command discovery, and verbose output in AIKC-managed projects.

- Load compact entrypoints first and only read matched skills.
- Do not load \`ai-knowledge/human/**\` by default. Human-readable companions are for explanation, review, onboarding, and companion-update tasks.
- Keep long explanations in references and read them only when needed.
- Keep \`.aikcignore\` current and apply it consistently in context planning, repo maps, diagnostics, and MCP file previews.
- Prefer summarized logs and structured JSON/table outputs before raw logs.
- Default log reads to the newest 100 lines; use \`node ai-knowledge/scripts/log-summary.cjs --file "<log>" --lines 100 --json\` before loading raw watch/dev/build logs.
- Use \`node ai-knowledge/scripts/run-bounded.cjs --json -- <command>\` for commands that may emit long build, test, watch, or diagnostic output.
- Keep stable workflow instructions before volatile task text, diffs, logs, and runtime state so prompt-cache hits are more likely.
- Use file hashes or mtimes to detect unchanged low-frequency context before re-reading it.
- Cache low-frequency checks with explicit invalidation.
- Use \`ai-knowledge/core/open-source-token-tools.md\` when evaluating open-source skills or MCP servers for prompt-cache hits, semantic code retrieval, current docs lookup, or reusable token-saving workflow integrations.
- Add \`ai-knowledge/operations/INDEX.md\` when repeated actions become numerous.
- Prefer a project doctor command when setup or health checks are repeated.
- Keep final replies compact: conclusion, changed files, validation, knowledge capture, reusable automation decision, and remaining risk.
- Context packs should separate \`stablePrefixFiles\`, \`taskFiles\`, \`deferredFiles\`, \`avoidByDefault\`, \`toolOutputPolicy\`, and \`logReadPolicy\`, with token estimates and hashes when cheap. Use \`--enforce --max-total-tokens <n>\` for hard budget gates.
- Use \`node ai-knowledge/scripts/repo-map.cjs --write --query "<task>"\` before broad code exploration.

Do not optimize blindly; token savings must preserve correctness, evidence, and rollback clarity.

## Workflow Observations

Use \`node ai-knowledge/scripts/observe-workflow.cjs --phase start|end --task "<task>" --json\` to record compact cross-session metrics. Observations belong in JSONL files under \`.aikc/observability/\` and the user-level AIKC observations directory. Store budgets, gate status, checkpoint counts, bounded-run sizes, repo-map metadata, and upgrade-candidate counts; do not store chat transcripts, secrets, full logs, or raw command output.

## Bound The Loop

Token-efficient loops are bounded loops. Before repeating an Agent action, retry, review cycle, upgrade cycle, or maintenance check, confirm the loop has an input, output, validation, budget, stop condition, and human escalation point as described in \`ai-knowledge/core/bounded-loop-policy.md\`.
`;

const scriptsReadmeMd = `# AI Knowledge Scripts

These scripts are internal AI Knowledge Center workflow tools. They live inside \`ai-knowledge/scripts\` so project-level files such as \`package.json\` stay focused on the host project build, test, and runtime commands.

Human maintainers may run them from the project root:

\`\`\`bash
node ai-knowledge/scripts/ai-workflow-start.cjs --task "<task>"
node ai-knowledge/scripts/code-review.cjs
node ai-knowledge/scripts/knowledge-check.cjs
node ai-knowledge/scripts/human-docs-check.cjs
node ai-knowledge/scripts/doctor.cjs
node ai-knowledge/scripts/context-pack.cjs --task "<task>"
node ai-knowledge/scripts/context-pack.cjs --summary --task "<task>"
node ai-knowledge/scripts/log-summary.cjs --file "<log-or-output-file>" --lines 100 --json
node ai-knowledge/scripts/run-bounded.cjs --json -- <command> [args...]
node ai-knowledge/scripts/repo-map.cjs --write --query "<task>"
node ai-knowledge/scripts/token-budget-check.cjs
node ai-knowledge/scripts/observe-workflow.cjs --phase start --task "<task>" --json
node ai-knowledge/scripts/eval-workflow.cjs
node ai-knowledge/scripts/ai-closeout.cjs
\`\`\`

Do not add these commands to a host project \`package.json\`. If the dashboard or another tool needs to run one, declare the exact command in \`ai-workflow.yaml\`.

Follow \`ai-knowledge/core/script-automation-policy.md\` when adding or updating scripts.

\`doctor.cjs\` provides compact workflow diagnostics. Use \`--json\` for AI consumption.
\`context-pack.cjs\` provides a compact reading plan for token-aware Agent runs. Use \`--summary\` for task-start budgets, recommended files, and long-output policy.
\`log-summary.cjs\` reads only the newest bounded slice of a repository log or captured command-output file and reports recent lines plus error-like matches.
\`run-bounded.cjs\` executes a command, writes complete output to \`.aikc/runs/*.log\`, and prints only a bounded summary.
\`repo-map.cjs\` builds a compact file, symbol, and import map for token-efficient file selection.
\`token-budget-check.cjs\` is a regression gate for context-pack size, repo-map availability, and bounded command output.
\`observe-workflow.cjs\` writes compact per-session metrics to project and user-level JSONL logs without storing chat transcripts, secrets, full logs, or raw command output.
\`eval-workflow.cjs\` runs smoke eval cases from \`ai-knowledge/evals\`.
`;

const humanReadmeMd = `# AI Knowledge Human Guide

This directory is the human-readable layer for the AI Knowledge Center workflow.

Agents should read compact AI-facing files first: \`ai-knowledge/LOAD.md\`, \`ai-knowledge/core/LOAD.md\`, \`ai-knowledge/ai/LOAD.md\`, \`ai-knowledge/skills/SKILL_INDEX.md\`, and matched skills.

Human-readable files explain why the workflow exists, how to maintain it, and how to review changes. They are for onboarding, audits, documentation work, and knowledge migrations, not the default Agent context path.

Update a human-readable companion only when the matching AI-facing knowledge, skill, or workflow meaning changes.
`;

const humanCoreWorkflowMd = `# AIKC Core Workflow

AIKC separates compact Agent instructions from human-readable maintenance notes.

The compact Agent path is \`ai-knowledge/LOAD.md\` -> \`ai-knowledge/core/LOAD.md\` -> \`ai-knowledge/ai/LOAD.md\` -> \`ai-knowledge/skills/SKILL_INDEX.md\` -> matched skills -> \`ai-knowledge/core/LOAD-END.md\`.

Humans should use this file to understand the workflow contract without forcing every Agent run to load long explanations.
`;

const aiWorkflowStartScript = `#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const required = [
  'AGENTS.md',
  'ai-workflow.yaml',
  '.aikcignore',
  'ai-knowledge/LOAD.md',
  'ai-knowledge/core/LOAD.md',
  'ai-knowledge/core/knowledge-capture-policy.md',
  'ai-knowledge/core/LOAD-END.md',
  'ai-knowledge/ai/LOAD.md',
  'ai-knowledge/skills/SKILL_INDEX.md',
];

for (const rel of required) fs.accessSync(path.join(root, rel));
console.log('AI workflow ready.');
`;

const codeReviewScript = `#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const required = [
  'ai-knowledge/core/code-review-policy.md',
  'ai-knowledge/core/LOAD-END.md',
  'ai-workflow.yaml',
];

for (const rel of required) fs.accessSync(path.join(root, rel));

const loadEnd = fs.readFileSync(path.join(root, 'ai-knowledge/core/LOAD-END.md'), 'utf8');
if (!loadEnd.includes('ai-knowledge/scripts/code-review.cjs')) {
  console.error('Core closeout does not require internal code review.');
  process.exit(1);
}

console.log('code review gate ok');
`;

const knowledgeCheckScript = `#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const required = [
  'AGENTS.md',
  'ai-workflow.yaml',
  'ai-knowledge/LOAD.md',
  'ai-knowledge/core/LOAD.md',
  'ai-knowledge/core/LOAD-END.md',
  'ai-knowledge/core/human-friendly-task-summary.md',
  'ai-knowledge/core/task-closeout-verification.md',
  'ai-knowledge/core/task-closeout-risk-report.md',
  'ai-knowledge/core/code-review-policy.md',
  'ai-knowledge/core/knowledge-capture-policy.md',
  'ai-knowledge/core/script-automation-policy.md',
  'ai-knowledge/core/bounded-loop-policy.md',
  'ai-knowledge/core/human-readable-knowledge-policy.md',
  'ai-knowledge/core/token-efficiency.md',
  'ai-knowledge/core/project-capabilities.md',
  'ai-knowledge/core/open-source-usage.md',
  'ai-knowledge/ai/LOAD.md',
  'ai-knowledge/skills/SKILL_INDEX.md',
  'ai-knowledge/human/README.md',
  'ai-knowledge/human/core-workflow.md',
  'ai-knowledge/scripts/README.md',
  'ai-knowledge/scripts/code-review.cjs',
  'ai-knowledge/scripts/context-pack.cjs',
  'ai-knowledge/scripts/log-summary.cjs',
  'ai-knowledge/scripts/run-bounded.cjs',
  'ai-knowledge/scripts/repo-map.cjs',
  'ai-knowledge/scripts/token-budget-check.cjs',
  'ai-knowledge/scripts/observe-workflow.cjs',
  'ai-knowledge/scripts/human-docs-check.cjs',
  'ai-knowledge/scripts/knowledge-check.cjs',
];

const missing = required.filter(rel => !fs.existsSync(path.join(root, rel)));
if (missing.length) {
  console.error(\`Missing AI knowledge files:\\n\${missing.map(rel => \`- \${rel}\`).join('\\n')}\`);
  process.exit(1);
}

const replySummary = fs.readFileSync(path.join(root, 'ai-knowledge/core/human-friendly-task-summary.md'), 'utf8');
if (!replySummary.includes('Multi-Item Tables')) {
  console.error('Human-friendly task summary is missing table guidance.');
  process.exit(1);
}
const scriptPolicy = fs.readFileSync(path.join(root, 'ai-knowledge/core/script-automation-policy.md'), 'utf8');
if (!scriptPolicy.includes('Automation Candidate Table')) {
  console.error('Script automation policy is missing automation candidate table guidance.');
  process.exit(1);
}
const contextPack = fs.readFileSync(path.join(root, 'ai-knowledge/scripts/context-pack.cjs'), 'utf8');
if (!contextPack.includes('stablePrefixFiles') || !contextPack.includes('toolOutputPolicy')) {
  console.error('Context pack script is missing token-aware output policy.');
  process.exit(1);
}
const runBounded = fs.readFileSync(path.join(root, 'ai-knowledge/scripts/run-bounded.cjs'), 'utf8');
if (!runBounded.includes('fullLogPath') || !runBounded.includes('max-chars')) {
  console.error('Run-bounded script is missing bounded-output behavior.');
  process.exit(1);
}
const repoMap = fs.readFileSync(path.join(root, 'ai-knowledge/scripts/repo-map.cjs'), 'utf8');
if (!repoMap.includes('.aikcignore') || !repoMap.includes('recommendedFiles')) {
  console.error('Repo-map script is missing ignore or recommendation behavior.');
  process.exit(1);
}
const observeWorkflow = fs.readFileSync(path.join(root, 'ai-knowledge/scripts/observe-workflow.cjs'), 'utf8');
if (!observeWorkflow.includes('workflow-observations.jsonl') || !observeWorkflow.includes('context-pack.cjs') || !observeWorkflow.includes('token-budget-check.cjs')) {
  console.error('Observe workflow script is missing observation log or metric collection behavior.');
  process.exit(1);
}

console.log('knowledge ok');
`;

const humanDocsCheckScript = `#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

const required = [
  'ai-knowledge/core/human-readable-knowledge-policy.md',
  'ai-knowledge/human/README.md',
  'ai-knowledge/human/core-workflow.md',
];

const missing = required.filter(relPath => !exists(relPath));
if (missing.length) {
  console.error(\`Missing human-readable knowledge companions:\\n\${missing.map(rel => \`- \${rel}\`).join('\\n')}\`);
  process.exit(1);
}

console.log('human docs ok');
`;

const doctorScript = `#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const asJson = process.argv.includes('--json');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
  return { status: result.status ?? 1, output: \`\${result.stdout || ''}\${result.stderr || ''}\`.trim() };
}
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function check(id, ok, evidence, severity = 'error') { return { id, status: ok ? 'pass' : severity, evidence }; }
const required = ['AGENTS.md', 'ai-workflow.yaml', 'ai-knowledge/LOAD.md', 'ai-knowledge/core/LOAD.md'];
const missing = required.filter(rel => !exists(rel));
const knowledge = exists('ai-knowledge/scripts/knowledge-check.cjs') ? run('node', ['ai-knowledge/scripts/knowledge-check.cjs']) : { status: 1, output: 'missing' };
const human = exists('ai-knowledge/scripts/human-docs-check.cjs') ? run('node', ['ai-knowledge/scripts/human-docs-check.cjs']) : { status: 0, output: 'not configured' };
const tokenBudget = exists('ai-knowledge/scripts/token-budget-check.cjs') ? run('node', ['ai-knowledge/scripts/token-budget-check.cjs']) : { status: 1, output: 'missing' };
const checks = [
  check('required-files', missing.length === 0, missing.length ? missing.join(', ') : 'all present'),
  check('knowledge-check', knowledge.status === 0, knowledge.output),
  check('human-docs-check', human.status === 0, human.output, 'warn'),
  check('token-budget-check', tokenBudget.status === 0, tokenBudget.output),
];
const status = checks.some(item => item.status === 'error') ? 'fail' : checks.some(item => item.status === 'warn') ? 'warn' : 'pass';
const summary = { status, root, checks };
if (asJson) console.log(JSON.stringify(summary, null, 2));
else {
  console.log(\`AIKC doctor: \${status}\`);
  for (const item of checks) console.log(\`[\${item.status}] \${item.id}: \${item.evidence}\`);
}
if (status === 'fail') process.exit(1);
`;

const contextPackScript = `#!/usr/bin/env node

const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const taskIndex = args.indexOf('--task');
const task = taskIndex >= 0 ? args[taskIndex + 1] || '' : args.join(' ');
const asSummary = args.includes('--summary');
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function fileInfo(rel, reason) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  const stat = fs.statSync(path.join(root, rel));
  return { path: rel, reason, estimatedTokens: Math.ceil(text.length / 4), hash: crypto.createHash('sha256').update(text).digest('hex').slice(0, 16), mtimeMs: Math.round(stat.mtimeMs) };
}
const sparse = /token|cache|context|mcp|semantic|skill|knowledge|workflow|loop|eval|doctor|人类|知识|上下文|工作流|门禁|技能/i.test(task);
const stablePrefixFiles = ['AGENTS.md', 'ai-workflow.yaml', 'ai-knowledge/LOAD.md', 'ai-knowledge/core/LOAD.md', 'ai-knowledge/ai/LOAD.md', 'ai-knowledge/skills/SKILL_INDEX.md'].filter(exists).map(file => fileInfo(file, 'stable workflow prefix'));
const taskFiles = (sparse ? ['ai-knowledge/core/token-efficiency.md', 'ai-knowledge/core/open-source-token-tools.md', 'ai-knowledge/core/bounded-loop-policy.md', 'ai-knowledge/core/human-readable-knowledge-policy.md'] : []).filter(exists).map(file => fileInfo(file, 'task trigger'));
const recommendedFiles = [...stablePrefixFiles, ...taskFiles].map(item => item.path);
const budget = { maxStableTokens: 7000, maxTaskTokens: 12000, totalEstimatedTokens: [...stablePrefixFiles, ...taskFiles].reduce((sum, item) => sum + item.estimatedTokens, 0), warningAtTokens: 20000 };
const avoidByDefault = ['ai-knowledge/human/**', 'ai-knowledge/references/**', 'ai-knowledge/**/*.aikc-upgrade.md', '.aikc/**', 'dist/**', 'node_modules/**', 'coverage/**', '**/*.log', '**/logs/**'];
const toolOutputPolicy = { defaultMaxChars: 12000, longOutputAction: 'write to a file or summarize; do not paste full output into chat', preferredCommands: ['node ai-knowledge/scripts/log-summary.cjs --file <log> --lines 100 --json', 'structured JSON summaries before raw logs'] };
const logReadPolicy = { defaultRecentLines: 100, maxRecentLinesWithoutReason: 300, drilldown: 'read raw logs only around the summarized error timestamp, pattern, or line number' };
const pack = { task, sparseTriggers: sparse, budget, stablePrefixFiles, taskFiles, deferredFiles: [], recommendedFiles, avoidByDefault, toolOutputPolicy, logReadPolicy, cacheGuidance: ['Keep stablePrefixFiles before task-specific logs, diffs, and runtime state.', 'Reuse hash and mtimeMs to skip unchanged low-frequency context.'] };
if (asSummary) console.log(JSON.stringify({ task: pack.task, sparseTriggers: pack.sparseTriggers, budget: pack.budget, recommendedFiles: pack.recommendedFiles, deferredCount: 0, avoidByDefault: pack.avoidByDefault, toolOutputPolicy: pack.toolOutputPolicy }, null, 2));
else console.log(JSON.stringify(pack, null, 2));
`;

const logSummaryScript = `#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const asJson = args.includes('--json');
function value(name, fallback = '') { const index = args.indexOf(name); if (index >= 0) return args[index + 1] || fallback; const inline = args.find(arg => arg.startsWith(\`\${name}=\`)); return inline ? inline.slice(name.length + 1) : fallback; }
const fileArg = value('--file');
if (!fileArg || args.includes('--help') || args.includes('-h')) { console.log('Usage: node ai-knowledge/scripts/log-summary.cjs --file <path> [--lines 100] [--pattern <regex>] [--json]'); process.exit(fileArg ? 0 : 1); }
const requestedLines = Number(value('--lines', '100'));
const lineLimit = Number.isFinite(requestedLines) && requestedLines > 0 ? Math.min(Math.floor(requestedLines), 1000) : 100;
const patternText = value('--pattern');
const pattern = patternText ? new RegExp(patternText, 'i') : /\\b(error|fail(?:ed|ure)?|exception|panic|fatal|timeout|denied|eaddrinuse|enoent|ts\\d{4}|traceback)\\b/i;
const absolute = path.resolve(root, fileArg);
if (!absolute.startsWith(root + path.sep) && absolute !== root) { console.error(\`Refusing to read outside repository: \${fileArg}\`); process.exit(1); }
if (!fs.existsSync(absolute)) { console.error(\`Log file not found: \${fileArg}\`); process.exit(1); }
const stat = fs.statSync(absolute);
const maxBytes = 2 * 1024 * 1024;
const start = Math.max(0, stat.size - maxBytes);
const buffer = Buffer.alloc(stat.size - start);
const fd = fs.openSync(absolute, 'r');
try { fs.readSync(fd, buffer, 0, buffer.length, start); } finally { fs.closeSync(fd); }
const lines = buffer.toString('utf8').replace(/^\\uFEFF/, '').split(/\\r?\\n/);
const recentLines = lines.slice(-lineLimit);
const matches = [];
lines.forEach((line, index) => { if (pattern.test(line)) matches.push({ line: start === 0 ? index + 1 : null, text: line.slice(0, 500) }); });
const summary = { file: path.relative(root, absolute).replaceAll(path.sep, '/'), bytes: stat.size, scannedBytes: buffer.length, truncatedFromStart: start > 0, recentLineCount: recentLines.length, pattern: patternText || pattern.source, matchCountInScannedSlice: matches.length, newestMatches: matches.slice(-20), recentLines };
if (asJson) console.log(JSON.stringify(summary, null, 2));
else { console.log(\`Log summary: \${summary.file}\`); console.log(\`Bytes: \${summary.bytes}; scanned: \${summary.scannedBytes}; recent lines: \${summary.recentLineCount}; matches: \${summary.matchCountInScannedSlice}\`); for (const match of summary.newestMatches) console.log(\`- \${match.text}\`); console.log('Recent lines:'); for (const line of recentLines) console.log(line); }
`;

const runBoundedScript = `#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
function value(name, fallback = '') { const index = args.indexOf(name); if (index >= 0) return args[index + 1] || fallback; const inline = args.find(arg => arg.startsWith(name + '=')); return inline ? inline.slice(name.length + 1) : fallback; }
if (args.includes('--help') || args.includes('-h')) { console.log('Usage: node ai-knowledge/scripts/run-bounded.cjs --json -- <command> [args...]'); process.exit(0); }
const sep = args.indexOf('--');
const commandParts = sep >= 0 ? args.slice(sep + 1) : [];
if (!commandParts.length) { console.error('Missing command after --'); process.exit(1); }
const asJson = args.includes('--json');
const useShell = args.includes('--shell');
const maxChars = Math.max(1, Number(value('--max-chars', '12000')) || 12000);
const maxLines = Math.max(1, Number(value('--lines', '120')) || 120);
const startedAt = new Date();
const result = spawnSync(commandParts[0], commandParts.slice(1), { cwd: root, encoding: 'utf8', shell: useShell, maxBuffer: 64 * 1024 * 1024 });
const endedAt = new Date();
const output = String(result.stdout || '') + String(result.stderr || '');
const runsDir = path.join(root, '.aikc', 'runs');
fs.mkdirSync(runsDir, { recursive: true });
const safeName = commandParts.join('_').replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 80) || 'command';
const logPath = path.join(runsDir, startedAt.toISOString().replace(/[:.]/g, '-') + '-' + safeName + '.log');
fs.writeFileSync(logPath, output, 'utf8');
const recentLines = output.split(/\\r?\\n/).slice(-maxLines).join('\\n');
const recentOutput = recentLines.length <= maxChars ? recentLines : recentLines.slice(recentLines.length - maxChars);
const newestMatches = output.split(/\\r?\\n/).filter(line => /\\b(error|fail(?:ed|ure)?|exception|panic|fatal|timeout|denied|eaddrinuse|enoent|ts\\d{4}|traceback)\\b/i.test(line)).slice(-20).map(line => line.slice(0, 500));
const summary = { command: commandParts.join(' '), status: result.status ?? 1, signal: result.signal || null, startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), durationMs: endedAt.getTime() - startedAt.getTime(), outputBytes: Buffer.byteLength(output), fullLogPath: path.relative(root, logPath).replaceAll(path.sep, '/'), truncated: output.length > maxChars, newestMatches, recentOutput };
if (asJson) console.log(JSON.stringify(summary, null, 2));
else { console.log('Command: ' + summary.command); console.log('Status: ' + summary.status + '; durationMs: ' + summary.durationMs + '; outputBytes: ' + summary.outputBytes); console.log('Full log: ' + summary.fullLogPath); if (newestMatches.length) { console.log('Newest error-like lines:'); for (const line of newestMatches) console.log('- ' + line); } console.log('Recent output:'); console.log(recentOutput); }
process.exit(summary.status);
`;

const repoMapScript = `#!/usr/bin/env node

const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const write = args.includes('--write');
function value(name, fallback = '') { const index = args.indexOf(name); if (index >= 0) return args[index + 1] || fallback; const inline = args.find(arg => arg.startsWith(name + '=')); return inline ? inline.slice(name.length + 1) : fallback; }
function ignorePatterns() { const file = path.join(root, '.aikcignore'); const base = ['node_modules/**', 'dist/**', '.git/**', '.aikc/runs/**', '.aikc/index/**', '*.log', '*.aikc-upgrade.md']; if (!fs.existsSync(file)) return base; return base.concat(fs.readFileSync(file, 'utf8').split(/\\r?\\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'))); }
function glob(rel, pattern) { const marker = '\\u0000'; const source = pattern.replaceAll('\\\\', '/').replace(/[.+^$()|[\\]\\\\]/g, '\\\\$&').replaceAll('**', marker).replaceAll('*', '[^/]*').replaceAll(marker, '.*'); return new RegExp('^' + source + '$').test(rel.replaceAll('\\\\', '/')); }
const ignores = ignorePatterns();
function ignored(rel) { return ignores.some(pattern => glob(rel, pattern) || glob(rel + '/', pattern)); }
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.json', '.md', '.yaml', '.yml']);
function walk(dir, files = []) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const absolute = path.join(dir, entry.name); const rel = path.relative(root, absolute).replaceAll(path.sep, '/'); if (ignored(rel)) continue; if (entry.isDirectory()) walk(absolute, files); else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) files.push(rel); } return files; }
function symbols(text, ext) { if (ext === '.md') return Array.from(text.matchAll(/^#{1,3}\\s+(.+)$/gm)).map(match => match[1].trim()).slice(0, 20); return Array.from(text.matchAll(/\\bexport\\s+(?:async\\s+)?(?:function|class|const|let|var|type|interface)\\s+([A-Za-z0-9_$]+)/g)).map(match => match[1]).filter(Boolean).slice(0, 30); }
function imports(text) { return Array.from(new Set(Array.from(text.matchAll(/\\bimport\\s+(?:[^'\\"]+?\\s+from\\s+)?['\\"]([^'\\"]+)['\\"]/g)).map(match => match[1]).filter(Boolean))).slice(0, 30); }
const query = value('--query');
const terms = query.toLowerCase().split(/[^a-z0-9\\u4e00-\\u9fff._-]+/).filter(term => term.length >= 2);
const files = walk(root).map(rel => { const absolute = path.join(root, rel); const text = fs.readFileSync(absolute, 'utf8'); const ext = path.extname(rel).toLowerCase(); const fileSymbols = symbols(text, ext); const fileImports = imports(text); const haystack = (rel + ' ' + fileSymbols.join(' ') + ' ' + fileImports.join(' ')).toLowerCase(); const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0); const stat = fs.statSync(absolute); return { path: rel, ext, bytes: Buffer.byteLength(text), estimatedTokens: Math.ceil(text.length / 4), hash: crypto.createHash('sha256').update(text).digest('hex').slice(0, 16), mtimeMs: Math.round(stat.mtimeMs), symbols: fileSymbols, imports: fileImports, score }; }).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
const map = { generatedAt: new Date().toISOString(), root, query, fileCount: files.length, totalEstimatedTokens: files.reduce((sum, file) => sum + file.estimatedTokens, 0), files, recommendedFiles: files.filter(file => file.score > 0).slice(0, 12).map(file => file.path) };
if (write) { const dir = path.join(root, '.aikc', 'index'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'repo-map.json'), JSON.stringify(map, null, 2) + '\\n', 'utf8'); }
if (asJson) console.log(JSON.stringify(map, null, 2)); else { console.log('Repo map: ' + map.fileCount + ' files, ~' + map.totalEstimatedTokens + ' tokens if read fully.'); if (map.recommendedFiles.length) { console.log('Recommended files:'); for (const file of map.recommendedFiles) console.log('- ' + file); } if (write) console.log('Wrote .aikc/index/repo-map.json'); }
`;

const tokenBudgetCheckScript = `#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const asJson = args.includes('--json');
function value(name, fallback = '') { const index = args.indexOf(name); if (index >= 0) return args[index + 1] || fallback; const inline = args.find(arg => arg.startsWith(name + '=')); return inline ? inline.slice(name.length + 1) : fallback; }
function run(parts) { const result = spawnSync(parts[0], parts.slice(1), { cwd: root, encoding: 'utf8', shell: false }); return { status: result.status ?? 1, output: String(result.stdout || '') + String(result.stderr || '') }; }
function check(id, ok, evidence) { return { id, status: ok ? 'pass' : 'error', evidence }; }
const maxSummaryTokens = Number(value('--max-summary-tokens', '4000'));
const maxRecommendedTokens = Number(value('--max-recommended-tokens', '20000'));
const maxRunOutputChars = Number(value('--max-run-output-chars', '12000'));
const context = run(['node', 'ai-knowledge/scripts/context-pack.cjs', '--summary', '--task', 'token budget regression']);
let contextJson = null; try { contextJson = JSON.parse(context.output); } catch {}
const repoMap = run(['node', 'ai-knowledge/scripts/repo-map.cjs', '--json', '--query', 'token workflow']);
let repoMapJson = null; try { repoMapJson = JSON.parse(repoMap.output); } catch {}
const bounded = run(['node', 'ai-knowledge/scripts/run-bounded.cjs', '--json', '--max-chars', String(maxRunOutputChars), '--', 'node', '-e', "console.log('bounded output smoke')"]);
let boundedJson = null; try { boundedJson = JSON.parse(bounded.output); } catch {}
const checks = [check('context-pack-json', context.status === 0 && contextJson !== null, contextJson ? 'valid JSON' : context.output.slice(0, 500)), check('context-summary-budget', contextJson && Math.ceil(JSON.stringify(contextJson).length / 4) <= maxSummaryTokens, contextJson ? '~' + Math.ceil(JSON.stringify(contextJson).length / 4) + ' tokens' : 'no context JSON'), check('recommended-context-budget', contextJson && contextJson.budget && contextJson.budget.totalEstimatedTokens <= maxRecommendedTokens, contextJson && contextJson.budget ? '~' + contextJson.budget.totalEstimatedTokens + ' tokens' : 'missing budget'), check('repo-map-json', repoMap.status === 0 && repoMapJson !== null, repoMapJson ? repoMapJson.fileCount + ' files indexed' : repoMap.output.slice(0, 500)), check('run-bounded-json', bounded.status === 0 && boundedJson !== null, boundedJson ? boundedJson.fullLogPath : bounded.output.slice(0, 500)), check('run-bounded-output-cap', boundedJson && boundedJson.recentOutput.length <= maxRunOutputChars, boundedJson ? boundedJson.recentOutput.length + ' chars' : 'no run-bounded JSON')];
const summary = { status: checks.some(item => item.status === 'error') ? 'fail' : 'pass', limits: { maxSummaryTokens, maxRecommendedTokens, maxRunOutputChars }, checks };
if (asJson) console.log(JSON.stringify(summary, null, 2)); else { console.log('Token budget check: ' + summary.status); for (const item of checks) console.log('[' + item.status + '] ' + item.id + ': ' + item.evidence); }
if (summary.status === 'fail') process.exit(1);
`;

const observeWorkflowScript = `#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);

function value(name, fallback = '') {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] || fallback;
  const inline = args.find(arg => arg.startsWith(name + '='));
  return inline ? inline.slice(name.length + 1) : fallback;
}

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node ai-knowledge/scripts/observe-workflow.cjs --phase start|end --task <task> [--json]');
  process.exit(0);
}

const phase = value('--phase', 'snapshot');
const task = value('--task', '');
const asJson = args.includes('--json');

function run(parts) {
  const result = spawnSync(parts[0], parts.slice(1), {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 16 * 1024 * 1024,
  });
  return { status: result.status ?? 1, output: String(result.stdout || '') + String(result.stderr || '').trim() };
}

function json(parts) {
  const result = run(parts);
  if (result.status !== 0) return { ok: false, status: result.status, error: result.output.slice(0, 1000) };
  try {
    return { ok: true, value: JSON.parse(result.output) };
  } catch {
    return { ok: false, status: result.status, error: result.output.slice(0, 1000) };
  }
}

function readJson(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\\uFEFF/, ''));
  } catch {
    return null;
  }
}

function packageVersion() {
  const pkg = readJson('package.json');
  return typeof pkg?.version === 'string' ? pkg.version : null;
}

function workflowId() {
  const file = path.join(root, 'ai-workflow.yaml');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const match = text.match(/^id:\\s*(.+)$/m);
  return match ? match[1].trim() : path.basename(root);
}

function upgradeCandidates() {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && entry.name.endsWith('.aikc-upgrade.md')) out.push(path.relative(root, absolute).replaceAll(path.sep, '/'));
    }
  }
  return out;
}

function recentRuns() {
  const dir = path.join(root, '.aikc', 'runs');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.log'))
    .map(entry => {
      const absolute = path.join(dir, entry.name);
      const stat = fs.statSync(absolute);
      return { path: path.relative(root, absolute).replaceAll(path.sep, '/'), bytes: stat.size, mtimeMs: Math.round(stat.mtimeMs) };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, 10);
}

const context = json(['node', 'ai-knowledge/scripts/context-pack.cjs', '--summary', '--task', task || 'workflow observation']);
const tokenBudget = json(['node', 'ai-knowledge/scripts/token-budget-check.cjs', '--json']);
const doctor = json(['node', 'ai-knowledge/scripts/doctor.cjs', '--json']);
const taskState = json(['node', 'ai-knowledge/scripts/task-state.cjs', 'status', '--json']);
const repoMap = readJson('.aikc/index/repo-map.json');
const observation = {
  schemaVersion: 1,
  observedAt: new Date().toISOString(),
  phase,
  task,
  project: { id: workflowId(), root, packageVersion: packageVersion() },
  contextPack: context.ok ? {
    budget: context.value.budget,
    stablePrefixHash: context.value.stablePrefixHash,
    recommendedFileCount: Array.isArray(context.value.recommendedFiles) ? context.value.recommendedFiles.length : 0,
    deferredCount: context.value.deferredCount ?? 0,
    warningCount: Array.isArray(context.value.warnings) ? context.value.warnings.length : 0,
  } : { error: context.error, status: context.status },
  tokenBudget: tokenBudget.ok ? { status: tokenBudget.value.status, limits: tokenBudget.value.limits } : { error: tokenBudget.error, status: tokenBudget.status },
  doctor: doctor.ok ? {
    status: doctor.value.status,
    checks: Array.isArray(doctor.value.checks) ? doctor.value.checks.map(item => ({ id: item.id, status: item.status })) : [],
  } : { error: doctor.error, status: doctor.status },
  taskState: taskState.ok ? {
    status: taskState.value.status,
    phase: taskState.value.phase,
    checkpointCount: Array.isArray(taskState.value.checkpoints) ? taskState.value.checkpoints.length : 0,
    pendingGateCount: Array.isArray(taskState.value.pendingGates) ? taskState.value.pendingGates.length : 0,
  } : { error: taskState.error, status: taskState.status },
  repoMap: repoMap ? {
    generatedAt: repoMap.generatedAt,
    fileCount: repoMap.fileCount,
    totalEstimatedTokens: repoMap.totalEstimatedTokens,
    recommendedFileCount: Array.isArray(repoMap.recommendedFiles) ? repoMap.recommendedFiles.length : 0,
  } : null,
  runBounded: { recentRuns: recentRuns() },
  upgradeCandidates: upgradeCandidates(),
};

function append(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(value) + '\\n', 'utf8');
}

const projectLog = path.join(root, '.aikc', 'observability', 'workflow-observations.jsonl');
const userLog = path.join(path.resolve(process.env.AIKC_HOME || path.join(os.homedir(), '.ai-knowledge-center')), 'observations', 'workflow-observations.jsonl');
append(projectLog, observation);
append(userLog, observation);

if (asJson) console.log(JSON.stringify({ status: 'ok', projectLog: path.relative(root, projectLog).replaceAll(path.sep, '/'), userLog, observation }, null, 2));
else {
  console.log('Workflow observation written: ' + path.relative(root, projectLog).replaceAll(path.sep, '/'));
  console.log('User observation log: ' + userLog);
}
`;

const workflowSmokeEvalJson = `{
  "name": "AIKC workflow smoke",
  "cases": [
    { "id": "doctor", "command": "node ai-knowledge/scripts/doctor.cjs --json", "expect": "\\"status\\"" },
    { "id": "context-pack", "command": "node ai-knowledge/scripts/context-pack.cjs --task \\"update AI workflow skill\\"", "expect": "recommendedFiles" },
    { "id": "context-pack-summary", "command": "node ai-knowledge/scripts/context-pack.cjs --summary --task \\"token heavy log review\\"", "expect": "toolOutputPolicy" },
    { "id": "repo-map", "command": "node ai-knowledge/scripts/repo-map.cjs --json --query \\"workflow token\\"", "expect": "recommendedFiles" },
    { "id": "run-bounded", "command": "node ai-knowledge/scripts/run-bounded.cjs --json -- node -e \\"console.log('bounded_smoke')\\"", "expect": "fullLogPath" },
    { "id": "token-budget-check", "command": "node ai-knowledge/scripts/token-budget-check.cjs", "expect": "Token budget check: pass" },
    { "id": "observe-workflow", "command": "node ai-knowledge/scripts/observe-workflow.cjs --phase smoke --task \\"workflow observation smoke\\" --json", "expect": "workflow-observations.jsonl" },
    { "id": "knowledge", "command": "node ai-knowledge/scripts/knowledge-check.cjs", "expect": "knowledge ok" }
  ]
}
`;

const evalWorkflowScript = `#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'ai-knowledge/evals/workflow-smoke.json'), 'utf8'));
function split(command) { return command.match(/(?:[^\\s"]+|"[^"]*")+/g)?.map(part => part.replace(/^"|"$/g, '')) || []; }
const results = [];
for (const testCase of spec.cases || []) {
  const [command, ...args] = split(testCase.command);
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
  const output = \`\${result.stdout || ''}\${result.stderr || ''}\`;
  const passed = result.status === 0 && output.includes(testCase.expect);
  results.push({ id: testCase.id, status: passed ? 'pass' : 'fail', command: testCase.command, evidence: passed ? testCase.expect : output.trim().slice(0, 500) });
}
const failed = results.filter(item => item.status === 'fail');
console.log(JSON.stringify({ name: spec.name, status: failed.length ? 'fail' : 'pass', results }, null, 2));
if (failed.length) process.exit(1);
`;

const aiCloseoutScript = `#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
for (const script of ['code-review.cjs', 'knowledge-check.cjs']) {
  const result = spawnSync('node', [\`ai-knowledge/scripts/\${script}\`], {
    cwd: root,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Code review and knowledge gate passed.');
`;

const projectCapabilitiesMd = `# AIKC Project Capabilities

Use this file when a task touches AIKC project setup, dashboard metadata, workflow manifests, gates, MCP, telemetry, Dagger, project discovery, upgrade behavior, or package lifecycle.

- AIKC is distributed as the global npm CLI \`aikc\` / \`ai-knowledge-center\`.
- Production serves the dashboard UI and \`/api/*\` from one Fastify process and one local port, default \`127.0.0.1:4318\`.
- \`aikc\` starts the server in the background by default and keeps request logging quiet; use \`--foreground --log-level info\` for debugging and \`aikc stop\` to stop the background server.
- When \`node ai-knowledge/scripts/ensure-aikc-cli.cjs --upgrade\` updates the global CLI and a background \`aikc\` Web process is already running, it should stop and restart that process automatically so the dashboard uses the new package.
- \`ensure-aikc-cli.cjs --upgrade\` refreshes templates with \`aikc upgrade --project . --write --ai\` by default. Pass \`--no-ai\` after \`--upgrade\` only when the AI handoff prompt should be skipped.
- If npm global update fails, the Agent must report the failure and provide manual retry commands: \`aikc stop\`, \`npm install -g ai-knowledge-center@latest\`, and \`aikc\`.
- Projects can come from explicit \`--projects\`, environment variables, config files, persisted user registry entries, or workspace auto-discovery.
- \`aikc upgrade --project <path> --write\` registers the project in \`~/.ai-knowledge-center/config/projects.json\` without replacing existing entries.
- \`ai-workflow.yaml\` is the project manifest for knowledge entrypoints, gates, commands, dashboard links, MCP metadata, optional integrations, telemetry settings, and Dagger metadata.
- \`aikc mcp --project <path>\` exposes repo-scoped AIKC MCP tools for manifests, doctor, context-pack, knowledge search, skills, and allowlisted manifest commands.
- Use \`integrations\` to advertise optional helpers such as Context7 docs, repository-docs lookup, semantic code search, Playwright QA, and GitHub MCP without silently granting network, browser, GitHub, semantic indexing, or broader filesystem access.
- Gate categories should accept common workflow categories such as \`knowledge\`, \`typecheck\`, \`lint\`, \`test\`, \`security\`, \`build\`, and \`custom\`; unknown project-specific categories should degrade to \`custom\` instead of breaking dashboard loading.
- The standard gate set should include an internal code review command such as \`node ai-knowledge/scripts/code-review.cjs\`; non-read-only work is incomplete until code review and all applicable gates pass.
- Durable Agent loops should be declared through manifest commands, gates, watched paths, or dashboard metadata. Each loop must follow \`ai-knowledge/core/bounded-loop-policy.md\`: define input, output, validation, budget, stop condition, and human escalation.
- The dashboard is document-first; the repository checkout remains the source of truth.
- \`aikc upgrade --project <path> --write --ai\` is the standard safe setup and upgrade path.
- The upgrade path should preserve existing AI workflows and only add or merge missing AIKC wiring.
- Differing local files should become \`*.aikc-upgrade.md\` candidates and an AI handoff prompt, not blind overwrites.
- Package changes should rebuild \`dist\`, keep README/dashboard/templates aligned, run validation, and never publish with a token that fails \`npm whoami\`.
`;

const openSourceUsageMd = `# Open Source Usage Policy

Use mature open-source packages when they reduce custom code, repeated agent reasoning, cross-platform bugs, or token-heavy diagnostics.

Prefer libraries for CLI parsing, file discovery, search/indexing, schema/API contracts, logs, config/cache paths, watchers, process execution, and MCP/server tooling.
Useful optional token-saving integrations include Context7 for current package docs, task-scoped repository-docs MCPs for external open-source repositories, and repository-scoped semantic code-search MCPs when AIKC repo-map recommendations are too broad.

Before adding a dependency, check maintenance, TypeScript support, license, package size, transitive risk, cross-platform behavior, security posture, and whether it replaces enough custom code to justify itself.

Keep wrappers thin, preserve existing behavior with validation, and avoid network-facing or filesystem-scope changes as package-adoption side effects.
`;

const openSourceTokenToolsMd = `# Open Source Token And Cache Tools

Use this AIKC-maintained reference when evaluating open-source skills or MCP servers for better prompt-cache hit rates, lower context load, or cheaper repeated code/docs lookup.

## Default AIKC Path

- Prefer AIKC built-ins first: \`context-pack.cjs\`, \`repo-map.cjs\`, \`log-summary.cjs\`, \`run-bounded.cjs\`, \`token-budget-check.cjs\`, repo-scoped filesystem MCP, and \`aikc mcp --project .\`.
- Context7 is the approved optional docs lookup integration when package API knowledge may be stale.
- Semantic code-search MCPs are optional, not default. Use one only when \`repo-map.cjs --query "<task>"\` is not selective enough, the repository is large enough to justify an index, and the server can stay repository-scoped.
- Do not add generic memory/cache MCPs by default unless they have clear invalidation and storage boundaries.

## Decision Shortcut

- Docs drift: use Context7.
- External open-source repo docs: consider a task-scoped repository-docs MCP.
- Large local code search: use AIKC \`repo-map\` first; consider semantic MCP only if the map is too broad.
- Long logs or noisy commands: use AIKC bounded/summarizing scripts.
- Repeated project operation: package as an AIKC script or skill before adding another MCP.
`;

function agentsMd(name: string): string {
  return `# ${name} Agent Guide

## Start Here

- Read \`ai-knowledge/LOAD.md\` and \`ai-knowledge/core/LOAD.md\` before project-specific work.
- Check \`ai-workflow.yaml\` for allowed gates and commands.
- Use this file for durable rules that coding agents should follow across tools.
- Read \`ai-knowledge/core/knowledge-capture-policy.md\` at task start and closeout.
- Keep \`ai-knowledge/core/**\` for AIKC-maintained workflow; project-specific reusable knowledge belongs in \`ai-knowledge/skills/**\` or project references.

## Verification

- Run the gates listed in AI Knowledge Center before declaring completion.
- Include command results, remaining risk, and knowledge-capture decision in closeout notes.
`;
}

function manifestYaml(entry: RegistryEntry, projectRoot: string): string {
  const basename = path.basename(projectRoot);
  const id = entry.id ?? normalizeProjectId(basename);
  const name = entry.name ?? basename;
  const manifest = workflowManifestSchema.parse({
    id,
    name,
    description: entry.description ?? 'Auto-initialized AI workflow project.',
    knowledge: {
      load: 'ai-knowledge/LOAD.md',
      core: 'ai-knowledge/core',
      aiLoad: 'ai-knowledge/ai/LOAD.md',
      skills: 'ai-knowledge/skills',
      skillIndex: 'ai-knowledge/skills/SKILL_INDEX.md',
      closeoutPrompt: 'ai-knowledge/core/LOAD-END.md',
      agentsFile: 'AGENTS.md',
    },
    gates: [
      {
        id: 'code-review',
        label: 'Code Review',
        command: 'node ai-knowledge/scripts/code-review.cjs',
        category: 'review',
      },
      {
        id: 'knowledge-check',
        label: 'Knowledge Check',
        command: 'node ai-knowledge/scripts/knowledge-check.cjs',
        category: 'knowledge',
      },
      {
        id: 'human-docs-check',
        label: 'Human-Readable Knowledge Companion Check',
        command: 'node ai-knowledge/scripts/human-docs-check.cjs',
        category: 'knowledge',
      },
      {
        id: 'eval-workflow',
        label: 'Workflow Smoke Eval',
        command: 'node ai-knowledge/scripts/eval-workflow.cjs',
        category: 'test',
      },
      {
        id: 'token-budget-check',
        label: 'Token Budget Regression Check',
        command: 'node ai-knowledge/scripts/token-budget-check.cjs',
        category: 'test',
      },
    ],
    commands: [
      {
        id: 'ai-start',
        label: 'AI Start',
        command: 'node ai-knowledge/scripts/ai-workflow-start.cjs',
      },
      {
        id: 'aikc-mcp',
        label: 'AIKC MCP Server',
        command: 'aikc mcp --project .',
      },
      {
        id: 'ai-closeout',
        label: 'AI Closeout',
        command: 'node ai-knowledge/scripts/ai-closeout.cjs',
      },
      {
        id: 'human-docs-check',
        label: 'Human-Readable Knowledge Companion Check',
        command: 'node ai-knowledge/scripts/human-docs-check.cjs',
      },
      {
        id: 'doctor',
        label: 'AIKC Workflow Doctor',
        command: 'node ai-knowledge/scripts/doctor.cjs',
      },
      {
        id: 'context-pack',
        label: 'AI Context Pack',
        command: 'node ai-knowledge/scripts/context-pack.cjs',
      },
      {
        id: 'log-summary',
        label: 'Summarize Bounded Log Output',
        command: 'node ai-knowledge/scripts/log-summary.cjs',
      },
      {
        id: 'run-bounded',
        label: 'Run Command With Bounded Output',
        command: 'node ai-knowledge/scripts/run-bounded.cjs',
      },
      {
        id: 'repo-map',
        label: 'Build AI Repo Map',
        command: 'node ai-knowledge/scripts/repo-map.cjs --write',
      },
      {
        id: 'token-budget-check',
        label: 'Token Budget Regression Check',
        command: 'node ai-knowledge/scripts/token-budget-check.cjs',
      },
      {
        id: 'observe-workflow',
        label: 'Record Workflow Observation',
        command: 'node ai-knowledge/scripts/observe-workflow.cjs',
      },
      {
        id: 'eval-workflow',
        label: 'Workflow Smoke Eval',
        command: 'node ai-knowledge/scripts/eval-workflow.cjs',
      },
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
    dashboard: {
      watch: ['ai-knowledge/core', 'ai-knowledge/skills', 'ai-knowledge/references'],
      links: [],
    },
    mcp: {
      servers: [
        {
          id: 'aikc',
          label: 'AI Knowledge Center MCP',
          type: 'stdio',
          command: 'aikc',
          args: ['mcp', '--project', '.'],
          scope: 'repository',
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
    telemetry: {
      enabled: true,
      serviceName: id,
      exporter: 'console',
    },
    dagger: {
      enabled: false,
      modulePath: '.',
    },
  });
  return stringify(manifest);
}

export async function ensureProjectInitialized(projectRoot: string, entry: RegistryEntry): Promise<ProjectInitializationResult> {
  const missingBefore = !(await pathExists(projectRoot));
  if (!entry.autoInit || !missingBefore) {
    return {
      autoInit: entry.autoInit,
      initializedNow: false,
      missingBefore,
      createdFiles: [],
    };
  }

  const createdFiles: string[] = [];
  await fs.mkdir(projectRoot, { recursive: true });

  const basename = path.basename(projectRoot);
  const name = entry.name ?? basename;

  const writes = [
    writeFileIfMissing(projectRoot, 'ai-knowledge/LOAD.md', loadMd(name)),
    writeFileIfMissing(projectRoot, 'ai-knowledge/core/LOAD.md', coreLoadMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/core/LOAD-END.md', loadEndMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/core/human-friendly-task-summary.md', humanFriendlySummaryMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/core/task-closeout-verification.md', taskCloseoutVerificationMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/core/task-closeout-risk-report.md', taskCloseoutRiskReportMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/core/code-review-policy.md', codeReviewPolicyMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/core/knowledge-capture-policy.md', knowledgeCapturePolicyMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/core/script-automation-policy.md', scriptAutomationPolicyMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/core/bounded-loop-policy.md', boundedLoopPolicyMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/core/human-readable-knowledge-policy.md', humanReadableKnowledgePolicyMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/core/token-efficiency.md', tokenEfficiencyMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/core/open-source-token-tools.md', openSourceTokenToolsMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/core/project-capabilities.md', projectCapabilitiesMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/core/open-source-usage.md', openSourceUsageMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/ai/LOAD.md', aiLoadMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/skills/SKILL_INDEX.md', skillIndexMd),
    writeFileIfMissing(projectRoot, '.aikcignore', aikcIgnoreMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/human/README.md', humanReadmeMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/human/core-workflow.md', humanCoreWorkflowMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/prompt/task-closeout.md', closeoutMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/scripts/README.md', scriptsReadmeMd),
    writeFileIfMissing(projectRoot, 'ai-knowledge/scripts/ai-workflow-start.cjs', aiWorkflowStartScript),
    writeFileIfMissing(projectRoot, 'ai-knowledge/scripts/ai-closeout.cjs', aiCloseoutScript),
    writeFileIfMissing(projectRoot, 'ai-knowledge/scripts/code-review.cjs', codeReviewScript),
    writeFileIfMissing(projectRoot, 'ai-knowledge/scripts/context-pack.cjs', contextPackScript),
    writeFileIfMissing(projectRoot, 'ai-knowledge/scripts/log-summary.cjs', logSummaryScript),
    writeFileIfMissing(projectRoot, 'ai-knowledge/scripts/run-bounded.cjs', runBoundedScript),
    writeFileIfMissing(projectRoot, 'ai-knowledge/scripts/repo-map.cjs', repoMapScript),
    writeFileIfMissing(projectRoot, 'ai-knowledge/scripts/token-budget-check.cjs', tokenBudgetCheckScript),
    writeFileIfMissing(projectRoot, 'ai-knowledge/scripts/observe-workflow.cjs', observeWorkflowScript),
    writeFileIfMissing(projectRoot, 'ai-knowledge/scripts/doctor.cjs', doctorScript),
    writeFileIfMissing(projectRoot, 'ai-knowledge/scripts/eval-workflow.cjs', evalWorkflowScript),
    writeFileIfMissing(projectRoot, 'ai-knowledge/scripts/human-docs-check.cjs', humanDocsCheckScript),
    writeFileIfMissing(projectRoot, 'ai-knowledge/scripts/knowledge-check.cjs', knowledgeCheckScript),
    writeFileIfMissing(projectRoot, 'ai-knowledge/evals/workflow-smoke.json', workflowSmokeEvalJson),
    writeFileIfMissing(projectRoot, 'AGENTS.md', agentsMd(name)),
    writeFileIfMissing(projectRoot, 'ai-workflow.yaml', manifestYaml(entry, projectRoot)),
  ];

  for (const created of await Promise.all(writes)) {
    if (created !== null) createdFiles.push(created);
  }

  return {
    autoInit: true,
    initializedNow: createdFiles.length > 0,
    missingBefore,
    createdFiles,
  };
}
