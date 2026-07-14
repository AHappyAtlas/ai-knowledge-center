# Script Automation Policy

<!-- aikc-template-version: 2026-06-23 -->

Repeated Agent operations should become maintained AI knowledge scripts when doing so reduces repeated discovery, long prompts, fragile shell snippets, or token-heavy troubleshooting.

## When To Script

Create or update a script when an operation is expected to repeat and has stable inputs, validation, or failure handling. Common candidates:

- project health checks, doctor commands, and environment verification;
- upgrade, migration, release, and package-publish preparation;
- log summarization, config normalization, and generated-file validation;
- cross-platform local/remote operation wrappers;
- MCP setup checks and dashboard gate runners.

Do not script one-off judgment calls, secrets, unverified guesses, or operations that require fresh human approval each time.

## Script Standards

Use open-source CLI practice:

- support `--help` for non-trivial scripts;
- support `--dry-run` before destructive or broad changes;
- prefer explicit named flags over positional arguments when ambiguity is likely;
- print concise, structured summaries by default, with verbose output behind a flag;
- be idempotent where possible;
- use safe defaults and fail closed;
- separate local host OS behavior from remote target OS behavior;
- document required environment variables without printing secret values.

## Agent Responsibilities

When the Agent notices a repeated operation:

1. Decide whether the operation should become a script, skill, MCP/server tool, or reference.
2. Discover required parameters from existing project config, environment, manifests, and files before asking the user.
3. Add or update the script under `ai-knowledge/scripts` when it is AI workflow automation.
4. Add human-facing usage notes to `ai-knowledge/scripts/README.md`.
5. Register runnable commands or gates in `ai-workflow.yaml` using exact `command` entries, not host-project package scripts.
6. Add validation to `ai-knowledge/scripts/knowledge-check.cjs` when the script becomes part of the core workflow contract.
7. During upgrades, preserve project-specific scripts and semantically merge AIKC-maintained scripts.

Host project `package.json` must not be used as the registry for AIKC internal workflow scripts.

## Automation Candidate Table

During closeout, report every repeated operation or script-worthy opportunity in a compact table, even when the decision is "no script".

| Operation | Evidence | Decision | Location | Reason |
| --- | --- | --- | --- | --- |
| Brief operation name | Repeated command, long diagnostic, fragile shell snippet, or recurring project workflow | script/skill/MCP/reference/cache/doctor/no | `ai-knowledge/...` or N/A | Why this packaging is or is not worth it |

Use this table when the task involved:

- the same shell command pattern more than once;
- a long command that future agents would have to rediscover;
- manual log filtering, status summarization, config normalization, or generated-file validation;
- a recurring setup, upgrade, release, deployment, rollback, or health-check workflow;
- repeated context loading that could be replaced by a script, summary, cache, doctor command, or operations index entry.
