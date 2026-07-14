# Code Review Policy

<!-- aikc-template-version: 2026-06-23 -->

Code review is a required completion gate for every non-read-only task. A task is not done until the code review decision and all applicable gates pass.

## Review Standard

Use open-source community practice:

- Require a review before merge or completion, similar to required pull request reviews.
- Require checks to pass, similar to required status checks.
- Review the change for correctness, design, maintainability, tests, security, operations, and documentation.
- Prefer actionable comments with severity and location when issues remain.

## Required Review Steps

1. Re-read the user request and compare it with the actual changed files.
2. Inspect the diff or changed files for behavior regressions, missing validation, unsafe filesystem/network changes, secrets, and unrelated edits.
3. Confirm unresolved upgrade candidates such as `*.aikc-upgrade.md` are either semantically merged or intentionally left with a clear reason.
4. Run `node ai-knowledge/scripts/code-review.cjs`.
5. Run all applicable gates from `ai-workflow.yaml`.
6. If any review issue or gate fails, fix it and rerun review plus gates before final response.

## Final Response Requirement

Final replies for non-read-only work must include:

- Code review: passed/failed/skipped, command run, and review decision.
- Gates: commands run and results.
- Remaining risk: no known risk or specific residual risk.

Read-only tasks may mark code review as N/A and explain why.
