# Human-Friendly Task Summary

<!-- aikc-template-version: 2026-06-23 -->

Replies are part of the workflow contract. Keep them short, concrete, and honest.

## Progress Replies

- Say what is being inspected, changed, or validated.
- Mention blockers as soon as they are known.
- Do not paste secrets, account data, subscription URLs, raw tokens, or long logs.

## Final Replies

Recommended shape:

```markdown
Conclusion: one sentence explaining what changed or what is blocked.

| Area | Item | Status | Details |
| --- | --- | --- | --- |
| Changed | `path/a` | changed | What changed and why. |
| Changed | `path/b` | changed | What changed and why. |
| Code review | `node ai-knowledge/scripts/code-review.cjs` | passed/failed/N/A | Review decision and notable finding. |
| Validation | `command` | passed/failed/not run | Reason, failure summary, or skipped-check explanation. |
| Knowledge capture | `ai-knowledge/...` or N/A | yes/no | Reusable lesson captured, or why not. |
| Automation/efficiency | script/skill/MCP/reference/cache/doctor/N/A | yes/no | Repeated operation, token saving, or why no packaging was warranted. |
| Risk | item | none/low/medium/high | What remains for the user to know or confirm. |
```

Rules:

- Non-read-only tasks must mention changed files, code review, validation, remaining risk, and knowledge-capture decision.
- Use a table when an area has more than one sub-item, repeated command, skipped check, or risk. It is acceptable to repeat the same `Area` value across rows.
- Keep table cells compact; put long logs, stack traces, or transcripts behind a referenced file, command, or summary instead of pasting them.
- Mention reusable automation or token-efficiency decisions when the task exposed repeated operations, long commands, repeated diagnostics, expensive context, or wasted context.
- Build failures cannot be reported as complete; include the failed command and residual risk.
- Publish failures cannot be reported as complete; include the package/version and failed command.
- Explain skipped checks.
- Do not paste secrets, accounts, subscription URLs, or long logs into the final reply.
- If no files changed, state that the task was read-only and validation is N/A or list the checks performed.

## Multi-Item Tables

When a section has many sub-items, prefer one table per concern rather than deeply nested bullets.

Suggested tables:

| Table | Columns | Use When |
| --- | --- | --- |
| Changed files | `File`, `Status`, `Reason` | More than two files changed, or files have different purposes. |
| Validation | `Command`, `Status`, `Evidence`, `Residual risk` | Multiple gates, skipped checks, or failures. |
| Knowledge and automation | `Decision`, `Location`, `Trigger`, `Reason` | Reusable knowledge, script candidates, MCP/tool candidates, cache candidates, or explicit no-capture decisions. |
| Remaining risk | `Risk`, `Level`, `Owner/Next check` | There are several caveats or user-visible follow-ups. |
