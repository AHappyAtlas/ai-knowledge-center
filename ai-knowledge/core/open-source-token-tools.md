# Open Source Token And Cache Tools

<!-- aikc-template-version: 2026-06-22 -->

Use this AIKC-maintained reference when evaluating open-source skills or MCP servers for better prompt-cache hit rates, lower context load, or cheaper repeated code/docs lookup.

## Default AIKC Path

- Prefer AIKC built-ins first: `context-pack.cjs`, `repo-map.cjs`, `log-summary.cjs`, `run-bounded.cjs`, `token-budget-check.cjs`, repo-scoped filesystem MCP, and `aikc mcp --project .`.
- Context7 is the approved optional docs lookup integration when package API knowledge may be stale. It saves tokens by pulling focused current docs instead of loading broad README files or dependency source.
- Semantic code-search MCPs are optional, not default. Use one only when `repo-map.cjs --query "<task>"` is not selective enough, the repository is large enough to justify an index, and the server can stay repository-scoped.
- Do not add generic memory/cache MCPs by default. They can lower repeated lookup cost, but they also risk stale project state, secret retention, and broad filesystem scope unless they have clear invalidation and storage boundaries.

## Useful Open-Source Candidates

| Candidate | Role | When To Use | Default |
| --- | --- | --- | --- |
| Model Context Protocol SDK and official servers | Typed agent tools and repo-scoped filesystem access | Building or exposing structured AIKC operations | Built in |
| Context7 MCP | Current package docs on demand | Implementation tasks involving external libraries or drifting APIs | Optional integration |
| GitMCP-style repository docs MCP | Turn public GitHub repos into docs context | External open-source repo research where docs are more useful than cloning | Optional task-scoped integration |
| Serena-style semantic code MCP | Symbol-aware code retrieval and edits | Large repos where lexical repo-map recommendations are too broad | Optional repo-scoped integration |

## Adoption Rules

1. Keep stable instructions first in prompts and context packs. External MCP output belongs after stable prefix files.
2. Prefer read-only, repository-scoped MCP configuration unless a task explicitly needs broader access.
3. Require an invalidation rule before caching generated knowledge: file hash, mtime, package version, or explicit user refresh.
4. Do not persist secrets, chat transcripts, raw logs, tokens, private account data, or external session state.
5. Add a project skill only when the workflow needs agent judgment. Add an MCP/server tool only when repeated typed operations would replace many fragile tool calls.

## Decision Shortcut

- Docs drift: use Context7.
- External open-source repo docs: consider a task-scoped repository-docs MCP.
- Large local code search: use AIKC `repo-map` first; consider semantic MCP only if the map is too broad.
- Long logs or noisy commands: use AIKC bounded/summarizing scripts.
- Repeated project operation: package as an AIKC script or skill before adding another MCP.
