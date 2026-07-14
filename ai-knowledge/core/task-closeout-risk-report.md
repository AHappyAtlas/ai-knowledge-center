# Task Closeout Risk Report

<!-- aikc-template-version: 2026-06-22 -->

Report R1-R13 before finishing non-read-only tasks.

| ID | Dimension | Check |
| --- | --- | --- |
| R1 | Build/typecheck | Did the selected V1-V5 gates run, or is the reason for skipping explicit? |
| R2 | Frontend/UI | Did UI/API-client changes build, avoid overlap, and preserve existing workflow ergonomics? |
| R3 | Backend/runtime | Did service, polling, broadcast, cache, or hot-path changes avoid unnecessary load? |
| R4 | Shared state/critical path | Did changes avoid corrupting accounts, sessions, queues, cluster state, and ownership boundaries? |
| R5 | Operational regression | Are important user workflows and deployment scenarios considered when relevant? |
| R6 | Secrets/network | Did output and docs avoid secrets, broad host binding, risky proxy/TUN changes, and exposed paths? |
| R7 | Knowledge loop | Did reusable, verified project lessons get added to skills or references when warranted, and did the final response explain why? |
| R8 | Diff scope | Are unrelated uncommitted changes preserved and ignored unless directly required? |
| R9 | Reusable automation | Did repeated operations get evaluated for packaging as scripts, skills, MCP/server tools, or references with local/remote OS boundaries? |
| R10 | Token efficiency | Did long logs, repeated diagnostics, health checks, or workflow-size problems get evaluated for summaries, structured output, caches, operations indexes, or doctor commands? |
| R11 | Code review | Did review inspect correctness, tests, security, operations, docs, maintainability, and unresolved findings before completion? |
| R12 | Bounded loops | Did any new or changed loop define input, output, validation, budget, stop condition, and human escalation? |
| R13 | Human-readable knowledge | Did AI-facing knowledge or skill changes update, skip, or backfill the human-readable companion intentionally? |

Use clear labels: passed, failed, skipped, or N/A. Explain any skipped check.
