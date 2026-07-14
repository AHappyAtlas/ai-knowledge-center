# Token Efficiency Policy

<!-- aikc-template-version: 2026-06-22 -->

Use this policy to reduce repeated context, command discovery, and verbose output in AIKC-managed projects.

## Minimal Context Loading

- Load compact entrypoints first: `ai-knowledge/LOAD.md`, `ai-knowledge/core/LOAD.md`, `ai-knowledge/ai/LOAD.md`, and `ai-knowledge/skills/SKILL_INDEX.md`.
- Load only matched `SKILL.md` files. Do not recursively read all skills or references.
- Do not load `ai-knowledge/human/**` by default. Human-readable companions are for explanation, review, onboarding, and companion-update tasks.
- Keep long explanations, examples, and checklists in references; read them only when a skill or task explicitly needs them.
- At task start, state the expected context scope when the task is broad or knowledge-heavy.

## Stable Cache Prefix

- Keep stable workflow instructions before task-specific content in prompts and generated context packs.
- Put volatile details such as task text, timestamps, logs, diffs, command output, and runtime state after stable entrypoints and matched skills.
- Avoid inserting generated timestamps, random ordering, or full raw logs into stable context. These reduce prompt-cache hits.
- Use file hashes or mtimes to detect whether low-frequency context really changed before re-reading it.
- Keep `.aikcignore` current and apply it consistently in context planning, repo maps, diagnostics, and MCP file previews.

## Summaries Before Raw Logs

- Prefer scripts or tools that summarize long logs, CI output, health checks, and runtime status before the Agent reads them.
- Summaries should include stable fields such as status, failed step, error code, relevant file, timestamp, and next likely action.
- Keep raw logs available for drilldown, but do not paste or load them by default.
- Default log reads to the newest 100 lines. Reading more than 300 lines or any full watch/dev log needs a concrete reason such as an error timestamp, pattern, or failing step.
- Use `node ai-knowledge/scripts/log-summary.cjs --file "<log>" --lines 100 --json` before asking an Agent to inspect long local logs or captured command output.
- Use `node ai-knowledge/scripts/run-bounded.cjs --json -- <command>` for commands that may emit long build, test, watch, or diagnostic output.

## Structured Tool Output

- Prefer JSON or small tables for reusable status and diagnostic scripts.
- Useful fields include `status`, `changedFiles`, `failedChecks`, `warnings`, `nextAction`, and `evidence`.
- Stable structured output is cheaper than natural-language command transcripts and easier for agents to compare across runs.

## Low-Frequency Caches

- Cache expensive or low-drift checks with file hashes or mtimes.
- Good cache candidates: skill index scan, template version check, manifest health, environment detection, installed CLI version, and known project gates.
- Invalidate caches when core entrypoints, `AGENTS.md`, `ai-workflow.yaml`, `SKILL_INDEX.md`, or related scripts change.

## Operations Directory

Projects may add an `ai-knowledge/operations/INDEX.md` when repeated actions become numerous.

Recommended grouping:

- local Windows operations;
- local macOS operations;
- local Linux operations;
- remote Windows operations;
- remote Linux operations;
- container or CI operations;
- npm/package release operations;
- deployment and rollback operations.

Each operation entry should point to the script, skill, MCP/server tool, or reference that owns it.

## Doctor Command

Prefer a project doctor command when setup or health checks become repeated.

Recommended behavior:

- verify core workflow files and template versions;
- verify AI knowledge scripts and host project scripts separately;
- detect unresolved `*.aikc-upgrade.md` candidates;
- verify skill index links;
- summarize gates and last known failures;
- output JSON or a compact table.

A doctor command lets agents read one concise health summary instead of rediscovering project state from many files.

## Repo Map

Prefer `node ai-knowledge/scripts/repo-map.cjs --write --query "<task>"` before broad code exploration. A repo map should store a compact `.aikc/index/repo-map.json` with file hashes, imports, exported symbols, and task-ranked recommendations. Agents should use the repo map for file selection before falling back to broad `rg` or recursive reads.

## Workflow Observations

Use `node ai-knowledge/scripts/observe-workflow.cjs --phase start|end --task "<task>" --json` to record compact cross-session metrics. Observations belong in JSONL files under `.aikc/observability/` and the user-level AIKC observations directory. Store budgets, gate status, checkpoint counts, bounded-run sizes, repo-map metadata, and upgrade-candidate counts; do not store chat transcripts, secrets, full logs, or raw command output.

## Context Pack Command

Prefer `node ai-knowledge/scripts/context-pack.cjs --task "<task>"` when a task is broad, knowledge-heavy, or explicitly mentions token/context cost. The context pack should return a compact JSON reading plan and should keep `ai-knowledge/human/**`, references, generated output, and dependency folders out of default context.

Use `--summary` at task start or after interruptions when the Agent only needs the recommended file list, budget, and output policy.
Use `--enforce --max-total-tokens <n>` when a workflow should fail rather than silently exceed the budget.

Context packs should group files into:

| Group | Meaning |
| --- | --- |
| `stablePrefixFiles` | Low-drift files to read first and keep ordered for prompt-cache hits. |
| `taskFiles` | Matched skills, policies, or references needed for this task. |
| `avoidByDefault` | Human docs, generated output, dependencies, large logs, and broad references. |

For each concrete file, include a small token estimate and a content hash or mtime when cheap to compute. This lets agents compare context across runs without loading unchanged files.

Context packs should also include:

| Field | Meaning |
| --- | --- |
| `budget` | Token ceilings for stable and task-specific context. |
| `deferredFiles` | Useful files intentionally not loaded until the task directly needs them. |
| `toolOutputPolicy` | Default maximum command-output size and what to do with long output. |
| `logReadPolicy` | Default recent-line window and raw-log drilldown rule. |

## Fixed Closeout Shape

Final replies should stay compact:

- conclusion;
- changed files;
- validation;
- knowledge capture decision;
- reusable automation decision when applicable;
- remaining risk.

Avoid long process narration unless the user asks for it or it is needed to explain a failure.

## Do Not Optimize Blindly

Do not add scripts, caches, or tools for one-off operations. Do not hide important risk behind a short summary. Token savings should preserve correctness, evidence, and rollback clarity.

## Bound The Loop

Token-efficient loops are bounded loops. Before repeating an Agent action, retry, review cycle, upgrade cycle, or maintenance check, confirm the loop has an input, output, validation, budget, stop condition, and human escalation point as described in `ai-knowledge/core/bounded-loop-policy.md`.
