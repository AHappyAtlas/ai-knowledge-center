# AI Knowledge Scripts

These scripts are internal AI Knowledge Center workflow tools. They live inside
`ai-knowledge/scripts` so project-level files such as `package.json` stay focused
on the host project's own build, test, and runtime commands.

Human maintainers may run them from the project root when debugging AIKC
workflow behavior:

```bash
node ai-knowledge/scripts/ensure-aikc-cli.cjs --upgrade
node ai-knowledge/scripts/ai-workflow-start.cjs --task "<task>"
node ai-knowledge/scripts/code-review.cjs
node ai-knowledge/scripts/knowledge-check.cjs
node ai-knowledge/scripts/human-docs-check.cjs
node ai-knowledge/scripts/doctor.cjs
node ai-knowledge/scripts/context-pack.cjs --task "<task>"
node ai-knowledge/scripts/context-pack.cjs --summary --task "<task>"
node ai-knowledge/scripts/log-summary.cjs --file "<log-or-output-file>" --lines 100 --json
node ai-knowledge/scripts/run-bounded.cjs --json -- <command> [args...]
node ai-knowledge/scripts/repo-map.cjs --write --query "<task>"
node ai-knowledge/scripts/token-budget-check.cjs
node ai-knowledge/scripts/observe-workflow.cjs --phase start --task "<task>" --json
node ai-knowledge/scripts/task-state.cjs status --json
node ai-knowledge/scripts/task-state.cjs resume --json
node ai-knowledge/scripts/eval-workflow.cjs
node ai-knowledge/scripts/ai-closeout.cjs
aikc mcp --project .
```

Do not add these commands to a host project's `package.json`. If the dashboard
or another tool needs to run one, declare the exact command in `ai-workflow.yaml`.

When adding or updating scripts, follow
`ai-knowledge/core/script-automation-policy.md`: add `--help` for non-trivial
scripts, support `--dry-run` for broad changes, keep output concise by default,
and document parameters or environment variables here for human maintainers.

`ensure-aikc-cli.cjs --upgrade` actively updates the global AIKC CLI, refreshes
project templates with `aikc upgrade --project . --write --ai`, and prints
manual retry commands if npm global update fails. Pass `--no-ai` after
`--upgrade` only when the AI handoff prompt should be skipped.

`human-docs-check.cjs` verifies the human-readable knowledge layer:
`ai-knowledge/human/README.md`, `ai-knowledge/human/core-workflow.md`, and one
`ai-knowledge/human/skills/<skill-id>.md` companion for every indexed skill.

`doctor.cjs` prints a compact health summary for workflow files, gates, human
companions, unresolved upgrade candidates, global CLI, and the background Web
pid file. Use `--json` when an AI Agent will consume the output.

`context-pack.cjs` returns a compact JSON reading plan for a task. It favors
AI-facing entrypoints and matched skills, and keeps `ai-knowledge/human/**`
out of the default context unless the task needs human-readable docs. It also
separates stable prefix files from task-specific files and includes token
estimates plus short hashes so agents can skip unchanged low-frequency context
and preserve prompt-cache-friendly ordering.
Use `--summary` at task start or after interruptions when an Agent only needs
the recommended file list, token budget, and long-output policy.

`log-summary.cjs` reads only the newest bounded slice of a repository log or
captured command-output file and reports recent lines plus error-like matches.
Use it before loading raw watch, dev-server, build, or CI logs into Agent
context.

`run-bounded.cjs` executes a command, writes complete stdout/stderr to
`.aikc/runs/*.log`, and prints only a bounded JSON or text summary. Use it for
commands that may emit long build, test, watch, or diagnostic output.

`repo-map.cjs` builds a compact file, symbol, and import map. Use `--write` to
store `.aikc/index/repo-map.json`; `context-pack.cjs` can use that map to
recommend files without rereading the repository.

`token-budget-check.cjs` is a regression gate for context size. It checks
context-pack summary size, recommended context budget, repo-map JSON, and
bounded command output.

`observe-workflow.cjs` writes compact per-session metrics to both
`.aikc/observability/workflow-observations.jsonl` and the user-level
`~/.ai-knowledge-center/observations/workflow-observations.jsonl`. It stores
budgets, gate status, recent bounded-run sizes, task-state counts, and upgrade
candidate counts; it does not store chat transcripts, secrets, or full logs.

`task-state.cjs` writes and reads `.aikc/task-state/current.json` so long tasks
can recover after context loss. Use `start` at task start, `checkpoint` after
meaningful phases, `resume --json` after interruptions, and `close` after
successful closeout.

`eval-workflow.cjs` runs smoke eval cases from `ai-knowledge/evals`.

`aikc mcp --project .` exposes AIKC as a repo-scoped stdio MCP server for agent clients. It provides structured access to the manifest, doctor, context-pack, knowledge search/preview, skill listing, and allowlisted manifest command execution.
