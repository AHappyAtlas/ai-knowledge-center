# AIKC Core Load - Stage 0

<!-- aikc-template-version: 2026-06-22 -->

This file is AIKC-maintained core workflow. Project-specific knowledge belongs in `ai-knowledge/skills` or project references, not here.

## Task Start

When the user says `按 ai-knowledge/LOAD.md 执行, 任务：...`:

1. Extract the text after `任务：` as the task.
2. Run `node ai-knowledge/scripts/ensure-aikc-cli.cjs --upgrade`.
3. Run `node ai-knowledge/scripts/ai-workflow-start.cjs --task "<task>"`.
4. Run `node ai-knowledge/scripts/task-state.cjs status --json` before planning, after interruptions, and before final closeout.
5. Read `ai-knowledge/core/knowledge-capture-policy.md` and make a task-start knowledge-capture precheck.
6. Read `ai-knowledge/skills/SKILL_INDEX.md`, then load only the matching project skills.
7. Write task checkpoints with `node ai-knowledge/scripts/task-state.cjs checkpoint --phase "<phase>" --summary "<summary>" --next "<next>"` after planning, after meaningful edits, before validation, and when blocked.

Do not ask the user to manually run npm, yarn, pnpm, aikc, or knowledge scripts.
Do not rely on chat history alone for task memory. `.aikc/task-state/current.json` is the compact durable task state. If the conversation resumes after an interruption or context loss, run `node ai-knowledge/scripts/task-state.cjs resume --json` before continuing.

## Required First Reply

```text
已读取项目约束，将按本项目 AI 工作流执行。
本次任务：<task>
已加载入口：AGENTS.md, ai-knowledge/LOAD.md, ai-knowledge/core/LOAD.md, ai-knowledge/ai/LOAD.md
将自动执行：aikc:ensure, ai:start, 匹配 skill, 适用 gate, core closeout
知识沉淀预判：<可能沉淀到 skill/reference，或说明暂不沉淀的原因>
需要用户提供：暂无
```

## Ownership Boundary

- `ai-knowledge/core/**` is upstream AIKC workflow and should be upgraded from AIKC templates.
- `ai-knowledge/skills/**` is project-owned reusable knowledge.
- `ai-knowledge/references/**` is project-owned support material unless a file explicitly says it is a compatibility wrapper for core.
- `AGENTS.md` and `ai-workflow.yaml` may contain project-local rules and should be semantically merged during upgrades.

## Skill Generation Rule

Create a new project skill only when reusable knowledge has a distinct trigger and workflow that does not fit an existing skill.

New project skill path:

```text
ai-knowledge/skills/<skill-id>/SKILL.md
```

When creating a skill, also update `ai-knowledge/skills/SKILL_INDEX.md`.

Do not create a skill mechanically for every task. Creation, update, or skip must be explained in the final response.

## Reusable Automation Rule

When a task repeats an operation that future agents are likely to run again, prefer packaging it instead of re-explaining it in prompts.

Choose the lightest durable form:

- Project script: repeatable repository operation, validation gate, deployment helper, or local file transformation.
- Project skill: reusable decision workflow, troubleshooting path, or domain procedure that still needs agent judgment.
- MCP/server tool: structured operation that benefits from typed inputs, external state, permissions, or repeated tool calls.
- Reference document: checklist or long explanation that supports a skill but is not directly executable.

Separate execution environments before packaging:

- Local host OS: Windows, macOS, or Linux where the Agent is currently running.
- Remote target OS: Windows, macOS, or Linux reached through SSH, remoting, container exec, CI, or another transport.
- Cross-platform path and shell behavior must be explicit. Prefer a small dispatcher script when local and remote OS differ.

Good automation reduces token cost when it replaces repeated command discovery, long shell snippets, or fragile manual steps. Do not add automation for one-off work, secrets, unverified guesses, or operations that need a fresh human decision each time.

## Token Efficiency Rule

Use `ai-knowledge/core/token-efficiency.md` when tasks involve token/context cost, repeated diagnostics, long logs, project health checks, operations catalogs, doctor commands, or workflow-size concerns.
Use `ai-knowledge/core/open-source-token-tools.md` when evaluating open-source skills or MCP servers for prompt-cache hits, semantic code retrieval, current docs lookup, or reusable token-saving workflow integrations.

Default stance:

- load the smallest useful context;
- prefer summaries and structured output before raw logs;
- cache low-frequency checks with explicit invalidation;
- use operations indexes and doctor commands when repeated actions become numerous;
- keep closeout compact and evidence-based.

## Script Automation Rule

Use `ai-knowledge/core/script-automation-policy.md` when the Agent repeats an operation or sees a repeated workflow emerging. AI workflow scripts belong in `ai-knowledge/scripts`, must be documented for human maintainers, and must be wired through exact `command` entries in `ai-workflow.yaml` instead of host-project `package.json` scripts.

## Bounded Loop Rule

Use `ai-knowledge/core/bounded-loop-policy.md` when a task creates or changes an Agent loop, recurring workflow, self-update path, review cycle, retry cycle, maintenance check, or autonomous automation. AIKC loops must be bounded: each loop needs an input, output, validation, budget, stop condition, and human escalation point.

## Human-Readable Knowledge Rule

Use `ai-knowledge/core/human-readable-knowledge-policy.md` when changing AI-facing knowledge, skills, human-readable companions, documentation, onboarding, or knowledge migrations. Agents should read compact AI-facing files by default and read `ai-knowledge/human/**` only for human documentation, explanation, review, or companion-update tasks.

## Capability Reference

Use `ai-knowledge/core/project-capabilities.md` when tasks touch AIKC project discovery, manifests, dashboard behavior, gates, commands, MCP, telemetry, Dagger, API automation, upgrade semantics, auto-initialization, or package release.

## Open Source Usage Rule

Use `ai-knowledge/core/open-source-usage.md` before hand-rolling functionality that mature packages already solve, especially CLI parsing, file discovery, search/indexing, schema/API contracts, logs, config/cache paths, watchers, retries, process execution, or MCP/server tooling.
