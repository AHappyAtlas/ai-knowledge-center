# AIKC Core Load - Stage 1 Closeout

<!-- aikc-template-version: 2026-06-22 -->

Read this before finishing any non-read-only task. Do not replace it with a short summary.

## Mandatory Closeout

1. Re-check the user request and the current diff. Confirm unrelated user work was not changed.
2. Read `ai-knowledge/core/code-review-policy.md`, perform the review, and run `node ai-knowledge/scripts/code-review.cjs`.
3. Run every applicable gate from `ai-workflow.yaml`. Knowledge-only changes must at least run `node ai-knowledge/scripts/knowledge-check.cjs`.
4. Check V1-V5 in `ai-knowledge/core/task-closeout-verification.md`.
5. Check R1-R13 in `ai-knowledge/core/task-closeout-risk-report.md`.
6. Review changed knowledge entrypoints and confirm paths still point to real files.
7. Read `ai-knowledge/core/knowledge-capture-policy.md` and make a knowledge-capture decision.
8. If project knowledge is reusable and verified, update `ai-knowledge/skills` or project-owned `ai-knowledge/references`.
9. If a new project skill is created, add `ai-knowledge/skills/<skill-id>/SKILL.md` and update `ai-knowledge/skills/SKILL_INDEX.md`.
10. If the task exposed a repeated operation, decide whether it should become a project script, skill, MCP/server tool, or reference. Consider local host OS and remote target OS separately.
11. If the task exposed repeated Agent operations, read `ai-knowledge/core/script-automation-policy.md` and decide whether to add or update an `ai-knowledge/scripts` tool, its parameters, its README usage notes, and its `ai-workflow.yaml` command/gate entry.
12. If the task exposed token waste, long logs, repeated diagnostics, or repeated health checks, decide whether to add summaries, structured output, caches, operations index entries, or a doctor command.
13. If AI-facing knowledge or skills changed, read `ai-knowledge/core/human-readable-knowledge-policy.md` and update the human-readable companion only when the meaning changed.
14. Do not put project-specific lessons into `ai-knowledge/core`.
15. Final response must include the code review decision and the knowledge-capture decision: yes/no, location, and reason.
16. Follow `ai-knowledge/core/human-friendly-task-summary.md` for final response shape.

Read-only answers may skip builds, but still state that no code changed and validation is N/A.
Non-read-only tasks are incomplete until code review and all applicable gates pass.

## Reply Message Rules

- Progress replies should be short and say what is being checked, changed, or validated.
- Final replies for non-read-only work must include changed files, code review result, validation commands and results, remaining risk, knowledge-capture decision, and reusable automation/token-efficiency decision when applicable.
- Use tables for final replies when any area contains multiple sub-items. Prefer rows over nested bullets for changed files, validation commands, knowledge decisions, automation candidates, cache decisions, and risks.
- Final replies must not paste secrets, account data, subscription URLs, raw tokens, or long logs.
- If validation or publishing failed, the final reply must say the exact command that failed and the remaining risk.
- If no files changed, say validation is N/A or list the read-only checks that were run.

If knowledge should have been captured but was not, the task is not complete.
If a repeated operation was observed but no automation packaging decision was reported, the task is not complete.
