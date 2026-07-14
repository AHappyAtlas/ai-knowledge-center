# AIKC Core Workflow

AIKC separates compact Agent instructions from human-readable maintenance notes.

The compact Agent path is:

1. `ai-knowledge/LOAD.md`
2. `ai-knowledge/core/LOAD.md`
3. `ai-knowledge/ai/LOAD.md`
4. `ai-knowledge/skills/SKILL_INDEX.md`
5. matched `ai-knowledge/skills/**/SKILL.md`
6. `ai-knowledge/core/LOAD-END.md` before closeout

Humans should use this file to understand the workflow contract without forcing every Agent run to load long explanations.

## Core Ideas

- `ai-knowledge/core/**` is AIKC-maintained workflow.
- `ai-knowledge/skills/**` is project-owned reusable AI knowledge.
- `ai-knowledge/human/**` is human-readable companion documentation.
- `ai-knowledge/scripts/**` contains AI workflow automation and human-debuggable commands.
- Non-read-only tasks must pass code review and applicable gates before completion.
- Final replies should use compact tables when changed files, validation checks, knowledge decisions, automation candidates, cache decisions, or risks have multiple sub-items.
- Repeated operations must get an explicit automation packaging decision, even when the decision is not to create a script.
- Agent loops must be bounded with input, output, validation, budget, stop condition, and human escalation.
- `ai-workflow.yaml` may declare durable loops in the `loops` section.
- `context-pack.cjs` separates stable prefix files from task-specific files and includes token/hash metadata so agents can preserve cache-friendly ordering and skip unchanged low-frequency context.
- `doctor.cjs`, `context-pack.cjs`, and `eval-workflow.cjs` provide diagnosis, compact context planning, and workflow smoke tests.

## Maintenance

When changing AI-facing core behavior, update this human overview only if the meaning changes. Do not update it for one-off task narration or transient runtime data.

Run:

```bash
node ai-knowledge/scripts/human-docs-check.cjs
node ai-knowledge/scripts/doctor.cjs
node ai-knowledge/scripts/context-pack.cjs --task "<task>"
node ai-knowledge/scripts/eval-workflow.cjs
node ai-knowledge/scripts/knowledge-check.cjs
```
