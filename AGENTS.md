# AI Knowledge Center Agent Guide

## Start Rule

- When the user says `按 ai-knowledge/LOAD.md 执行, 任务：...`, read `ai-knowledge/LOAD.md` first, then `ai-knowledge/core/LOAD.md`, then `ai-knowledge/ai/LOAD.md`.
- Optimize knowledge-token cost only on sparse triggers: explicit token/context/routing tasks, first run with no local token-check state, or changes to `AGENTS.md`, `ai-workflow.yaml`, `ai-knowledge/LOAD.md`, `ai-knowledge/core/**`, `ai-knowledge/ai/LOAD.md`, or `ai-knowledge/skills/SKILL_INDEX.md`.
- The Agent must run the declared workflow scripts itself. Do not ask the user to manually run npm, yarn, pnpm, or aikc commands.
- Treat `ai-workflow.yaml` as the project manifest for knowledge entrypoints, gates, MCP, telemetry, and dashboard metadata.
- Treat `ai-knowledge/core/**` as AIKC-maintained core workflow. Project-specific reusable knowledge belongs in `ai-knowledge/skills/**` or project-owned references.

## Project Shape

- This is a TypeScript/Vite/Fastify npm package that publishes the global CLI `aikc` from `dist/cli/aikc.js`.
- Source lives under `src/`; generated output lives under `dist/`.
- The production CLI serves API and UI from one Fastify process. Development uses `tsx src/server/index.ts` plus Vite.
- Do not edit generated `dist/` output unless the task explicitly asks for release artifacts; prefer source changes and run `npm run build`.

## Risk Boundaries

- Never overwrite existing human docs, project config, or uncommitted work. This checkout may not have a `.git` directory, so inspect files directly before changing them.
- Do not introduce network-facing host changes casually. Binding to `0.0.0.0`, changing ports, or exposing filesystem paths requires explicit task need.
- The filesystem MCP must remain repository-scoped by default.
- Telemetry changes must preserve the documented ability to disable export with `AIKC_TELEMETRY_EXPORTER=none`.
- Do not persist one-off chat transcripts into the knowledge base. Only reusable constraints, workflows, failure modes, and validation knowledge belong here.
- Do not store project-specific lessons in `ai-knowledge/core/**`; core files are upgraded from AIKC templates.

## Validation

- For code or config changes, run the gates declared in `ai-workflow.yaml` that match the change scope.
- Minimum closeout for non-read-only work: `node ai-knowledge/scripts/knowledge-check.cjs`, then any touched-surface gates such as `npm run typecheck`, `npm run lint`, and `npm run build`.
- If a gate cannot run, report the command, failure reason, and residual risk.

## Closeout

- Before final response, read and follow `ai-knowledge/core/LOAD-END.md` and `ai-knowledge/prompt/任务收尾-Review并沉淀.md`.
- Review the diff manually, verify changed entrypoints still exist, and decide whether a reusable lesson should be added to `ai-knowledge/skills`.
- Final response must list changed files, validation run, and remaining risk.


<!-- codex-review-language:zh-CN -->
## Code Review Rules

- 使用简体中文撰写所有 PR 审查结果，包括问题标题、行内评论、解释和审查总结。
- 保留代码、命令、文件路径、标识符、API 名称及必要的原文引用，不翻译这些技术内容。
<!-- /codex-review-language:zh-CN -->
