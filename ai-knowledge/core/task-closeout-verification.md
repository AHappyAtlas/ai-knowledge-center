# Task Closeout Verification

<!-- aikc-template-version: 2026-06-22 -->

Report V1-V5 before finishing non-read-only tasks.

| ID | Item | Applies When | Passing Signal |
| --- | --- | --- | --- |
| V1 | Knowledge check | Any AI knowledge or workflow change | `node ai-knowledge/scripts/knowledge-check.cjs` exits 0 |
| V2 | Typecheck/build | Source code or config changed | The project typecheck/build gate exits 0 |
| V3 | Artifact/build output | Generated assets, bundles, docs, or release artifacts changed | Artifacts are regenerated and no stale/missing output remains |
| V4 | Runtime/performance/load | Server, background task, polling, broadcast, or hot path changed | No unexplained errors or load regressions in the relevant check |
| V5 | Code review | Any non-read-only task | `node ai-knowledge/scripts/code-review.cjs` exits 0 and the Agent reports a review decision |

Use the real command for the changed surface. Do not invent pass results.
