# AIKC Project Workflow Skill

This is the human-readable companion for:

```text
ai-knowledge/skills/aikc-project-workflow/SKILL.md
```

## Purpose

Use this skill when maintaining AIKC itself: CLI behavior, dashboard metadata, project upgrade templates, manifest loading, gates, telemetry, AI workflow scripts, or core knowledge templates.

The AI-facing `SKILL.md` should stay compact so Agents can route quickly. This human file explains the maintenance intent behind that compact skill.

## Important Rules

- Edit source under `src/` and rebuild generated `dist/` output.
- Keep root `ai-knowledge/**` examples aligned with `src/cli/project-upgrader.ts` and `src/server/project-initializer.ts`.
- Keep dashboard setup prompts aligned with CLI upgrade behavior.
- Preserve the boundary between AIKC-maintained `ai-knowledge/core/**` and project-owned `ai-knowledge/skills/**`.
- AI-facing knowledge should stay compact; human-readable explanations belong under `ai-knowledge/human/**`.
- Repeated operations should become scripts, skills, MCP/server tools, or references when that reduces future command discovery and token use.
- Agent loops must be bounded and must not become unlimited autonomous runs.
- When publishing the npm package, load `NPM_TOKEN` from `.env.local` into the command environment if normal npm auth is unavailable. Never print the token, and check `NPM_TOKEN_EXPIRES_AT` before relying on it.

## Update Triggers

Update this companion when the corresponding skill changes meaning, adds a new maintenance surface, or changes validation expectations.

Do not update it for formatting-only edits, release version bumps, or temporary task details.

## Validation

Run:

```bash
node ai-knowledge/scripts/human-docs-check.cjs
node ai-knowledge/scripts/knowledge-check.cjs
npm run typecheck
npm whoami
```
