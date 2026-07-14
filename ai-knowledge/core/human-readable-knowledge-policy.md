# Human-Readable Knowledge Policy

<!-- aikc-template-version: 2026-06-22 -->

AIKC knowledge should have two layers:

- AI-facing knowledge: compact, trigger-oriented, and optimized for minimal token loading.
- Human-readable knowledge: explanatory, reviewable, and suitable for maintainers who need context without reading every AI prompt.

## Storage Layout

- Keep AI-facing entrypoints in `ai-knowledge/LOAD.md`, `ai-knowledge/ai/LOAD.md`, `ai-knowledge/core/LOAD.md`, and `ai-knowledge/skills/**/SKILL.md`.
- Keep human-readable companions under `ai-knowledge/human/**`.
- Use `ai-knowledge/human/README.md` as the human entrypoint.
- For each project skill at `ai-knowledge/skills/<skill-id>/SKILL.md`, add a companion at `ai-knowledge/human/skills/<skill-id>.md`.
- Use `ai-knowledge/human/core-workflow.md` for the human overview of AIKC-maintained core workflow.

## Update Rule

Update human-readable companions only when the corresponding AI-facing knowledge, skill, or workflow meaning changes.

Do not rewrite human docs for mechanical formatting, generated timestamps, one-off task chatter, or runtime-only values.

## AI Reading Rule

Agents should load the compact AI-facing layer first and avoid reading human-readable companions unless:

- the user asks for explanation, documentation, onboarding, or review;
- the AI-facing skill is ambiguous or insufficient;
- a human-readable companion must be updated or checked;
- a knowledge migration, upgrade, or documentation task explicitly targets the human layer.

## Backfill Rule

When existing skills or durable knowledge have no human-readable companion, add one during the next relevant knowledge, documentation, or workflow upgrade task. The companion should explain purpose, trigger, maintenance rules, and important safety constraints.

## Companion Shape

Human-readable companions should include:

- purpose and audience;
- when the knowledge applies;
- how the AI-facing file should stay compact;
- what humans may safely edit;
- update triggers;
- validation or review commands.
