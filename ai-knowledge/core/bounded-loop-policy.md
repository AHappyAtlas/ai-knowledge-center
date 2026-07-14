# Bounded Loop Policy

<!-- aikc-template-version: 2026-06-22 -->

Use bounded loops for AI workflow automation. AIKC should prefer explicit, verifiable loops over open-ended autonomous agents.

## Loop Contract

Every loop must define:

- input: task, trigger, project, files, command, or runtime state that starts the loop;
- output: the artifact, decision, report, updated file, or verified state the loop is expected to produce;
- validation: gates, checks, tests, code review, smoke tests, or evidence required before completion;
- budget: practical limits for token use, command retries, runtime, file scope, network calls, or generated candidates;
- stop condition: the exact condition that makes the loop complete;
- human escalation: when the Agent must stop and ask for approval, credentials, product judgment, destructive permission, or a scope decision.

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

## Manifest Guidance

When a loop becomes durable project behavior, describe it in `ai-workflow.yaml` using exact commands, gates, watched paths, or dashboard metadata. Keep executable AI workflow helpers inside `ai-knowledge/scripts`, not host project `package.json`, unless the command belongs to the host project's own build, test, or runtime surface.

Use the structured `loops` manifest section when available. A loop entry should include `input`, `output`, `validation`, `budget`, `stop`, and `escalate`. Upgrade logic should add missing standard loops to old projects without overwriting existing project-specific loop definitions.
