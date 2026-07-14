# AI Knowledge Center Load

This is the stable project entrypoint.

User invocation:

```text
按 ai-knowledge/LOAD.md 执行, 任务：<one sentence task>
```

Agent requirements:

1. Read this file, `ai-knowledge/core/LOAD.md`, and `ai-knowledge/ai/LOAD.md`.
2. Run `node ai-knowledge/scripts/ensure-aikc-cli.cjs --upgrade`.
3. Run `node ai-knowledge/scripts/ai-workflow-start.cjs --task "<task>"`.
4. Run `node ai-knowledge/scripts/task-state.cjs status --json` before planning, after interruptions, and before final closeout.
5. Read `ai-knowledge/skills/SKILL_INDEX.md` and load matching project skills only.
6. Write task checkpoints with `node ai-knowledge/scripts/task-state.cjs checkpoint --phase "<phase>" --summary "<summary>" --next "<next>"` after planning, after meaningful edits, before validation, and when blocked.
7. Before finishing non-read-only work, read `ai-knowledge/core/LOAD-END.md`, then run `node ai-knowledge/scripts/ai-closeout.cjs` and every applicable gate in `ai-workflow.yaml`.

The user must not be asked to manually run npm, yarn, pnpm, aikc, or knowledge scripts. The Agent runs workflow scripts itself.
Do not rely on chat history alone for task memory. `.aikc/task-state/current.json` is the compact durable task state and must be refreshed during long tasks.

Knowledge-token optimization should run only on sparse triggers:

- the task explicitly mentions token, context, knowledge base, skill routing, or entrypoint files;
- `ai-knowledge/.token-check-state.json` does not exist;
- `AGENTS.md`, `ai-workflow.yaml`, `ai-knowledge/LOAD.md`, `ai-knowledge/core/**`, `ai-knowledge/ai/LOAD.md`, or `ai-knowledge/skills/SKILL_INDEX.md` changed.

Priority order:

1. Current user request.
2. Root `AGENTS.md`.
3. `ai-knowledge/core/**` core workflow.
4. `ai-workflow.yaml` gates, MCP, telemetry, and dashboard configuration.
5. Matching `ai-knowledge/skills/**/SKILL.md`.
6. `ai-knowledge/ai/LOAD.md` compatibility router.

Knowledge capture:

- `ai-knowledge/core/**` is AIKC-maintained workflow. Do not store project-specific lessons there.
- Do not capture one-off chat history, temporary guesses, unverified conclusions, secrets, tokens, or subscription URLs.
- Reusable project constraints, failure modes, validation flows, release notes, and operations workflows belong in `ai-knowledge/skills` or project-owned references.
