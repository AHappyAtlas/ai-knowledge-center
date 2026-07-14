# Knowledge Capture Policy

<!-- aikc-template-version: 2026-06-22 -->

Use this policy at task start and closeout.

## Capture When

Capture knowledge when a task produces any reusable, verified project item:

- A project constraint that future agents must obey.
- A repeated failure mode and its proven fix.
- A validation command, gate, or environment caveat.
- A deployment, runtime, cluster, proxy, login, or operational workflow that is likely to recur.
- A stable UI/backend contract or state-machine rule.
- A repeated local or remote operation that should become a script, skill, MCP/server tool, or reference to reduce future token and command-discovery cost.

## Where To Capture

- Update an existing `ai-knowledge/skills/**/SKILL.md` when the lesson fits its trigger.
- Create `ai-knowledge/skills/<skill-id>/SKILL.md` when the knowledge has a distinct trigger and workflow. Also update `ai-knowledge/skills/SKILL_INDEX.md`.
- Keep `SKILL.md` files compact and trigger-oriented for AI token efficiency.
- Add or update `ai-knowledge/human/skills/<skill-id>.md` only when the corresponding skill meaning changes or a missing companion is being backfilled.
- Use project-owned `ai-knowledge/references/*.md` for checklists, templates, long explanations, or decision policies that support skills.
- Add or update project scripts when the reusable lesson is executable and repeatable.
- Add MCP/server tools when the reusable operation needs typed inputs, permission boundaries, external state, or many repeated tool calls.
- Do not capture project-specific lessons in `ai-knowledge/core`; core is AIKC-maintained workflow.

## Automation Packaging Decision

Before adding a new script, skill, or MCP/server tool, identify:

- Local host OS: Windows, macOS, or Linux.
- Remote target OS, when applicable: Windows, macOS, Linux, container, CI, or unknown.
- Transport: local shell, SSH, PowerShell remoting, Docker, API, MCP, or CI runner.
- Stable inputs and outputs.
- Validation command and failure signal.

Prefer small scripts for deterministic command sequences, skills for judgment-heavy workflows, and MCP/server tools for structured operations that are called often.

## Do Not Capture

Do not capture:

- One-off chat transcripts or temporary task narration.
- Unverified guesses.
- Secrets, account credentials, session data, proxy subscription URLs, tokens, or private runtime dumps.
- Ephemeral values such as current process IDs, temporary ports, transient queue contents, or today's node health unless they reveal a durable rule.

## Required Final Decision

Every non-read-only final response must include:

```text
知识沉淀: yes/no
Location: ai-knowledge/... or N/A
Reason: why it was captured or why it was not captured
```

If knowledge should have been captured but was not, the task is not complete.
