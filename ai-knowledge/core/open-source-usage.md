# Open Source Usage Policy

<!-- aikc-template-version: 2026-06-22 -->

Use mature open-source packages when they reduce custom code, repeated agent reasoning, cross-platform bugs, or token-heavy diagnostics.

## Prefer Libraries For

- CLI parsing and subcommand routing.
- Cross-platform file discovery, watching, path handling, and config/cache directories.
- Full-text search, indexing, ranking, and Markdown processing.
- Schema validation, OpenAPI generation, and typed API contracts.
- Structured logging, log formatting, diagnostics, and health checks.
- Retry, concurrency, process execution, archive handling, and release automation.
- MCP/server tools or other structured agent integrations.

## Selection Criteria

Before adding a dependency, check:

- active maintenance and recent releases;
- TypeScript support or reliable type definitions;
- license compatibility;
- package size and transitive dependency risk;
- cross-platform behavior for Windows, macOS, Linux, containers, and CI;
- security posture and audit result;
- whether the package replaces enough custom code or token-heavy workflow to justify itself.

## Implementation Rules

- Prefer one focused library over broad frameworks unless the framework is already part of the project.
- Keep wrappers thin and local, so packages can be swapped later.
- Preserve existing behavior with targeted tests, smoke checks, or fixture runs.
- Update `README.md`, core docs, skills, and templates when a package changes the recommended workflow.
- Do not introduce network-facing behavior, telemetry changes, or filesystem scope expansion as a side effect of adopting a package.

## Useful Package Categories

- `@modelcontextprotocol/sdk`: AIKC MCP servers or project-scoped MCP tools.
- `@modelcontextprotocol/server-filesystem`: repository-scoped filesystem MCP, never broader paths without explicit need.
- Context7: optional current package documentation lookup when stale API knowledge is likely.
- GitMCP-style repository docs MCP: optional task-scoped lookup for external open-source repository documentation.
- Serena-style semantic code MCP: optional repository-scoped retrieval for large codebases when AIKC repo-map recommendations are too broad.
- Playwright or Playwright MCP: browser smoke tests and dashboard QA when visual or interactive behavior matters.
- GitHub MCP: optional issue, pull request, release, and workflow automation when GitHub permissions are needed.
- `fast-glob` or similar: file discovery and ignore rules.
- `minisearch` or similar: small local full-text search indexes.
- `cac`, `commander`, or similar: CLI parsing.
- `chokidar`: cross-platform file watching.
- `conf` and `env-paths`: local config/cache/state paths.
- `zod-openapi` or Fastify OpenAPI tools: generated API contracts.
- `pino-pretty`: local development log readability while keeping production logs structured.

Use these as examples, not hard requirements. Choose packages based on the current project shape.

Do not introduce heavy agent runtimes such as durable workflow frameworks unless the project actually needs resumable multi-step execution, human approval nodes, or long-running state beyond AIKC's manifest loops, task-state checkpoints, and gates.
