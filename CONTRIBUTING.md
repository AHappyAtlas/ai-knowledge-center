# Contributing to AI Knowledge Center

Thank you for improving AI Knowledge Center (AIKC). AIKC is a local-first CLI,
dashboard, and repository-scoped MCP server for coding-agent workflows.

## Before opening a change

- Search existing issues and discussions first.
- Keep pull requests focused: one behavior, bug, or documentation concern per
  change where practical.
- Do not add secrets, private project content, telemetry endpoints, or broader
  filesystem/network permissions as part of an unrelated change.
- Preserve the default local host binding and repository-scoped MCP boundary.

## Local development

Use Node.js 22 or newer and npm:

```powershell
npm ci
npm run dev
```

The development UI is available at `http://127.0.0.1:5177`; Fastify serves the
local API at `http://127.0.0.1:4318`.

Before submitting a pull request, run:

```powershell
node ai-knowledge/scripts/knowledge-check.cjs
npm run typecheck
npm run lint
npm run build
npm pack --dry-run
```

## Change expectations

- Edit `src/`, not generated `dist/`, unless preparing an explicit release
  artifact.
- Add or update documentation when behavior, setup, security boundaries, or
  CLI output changes.
- Keep MCP command execution allowlisted by `ai-workflow.yaml`; commands marked
  `dangerous: true` must continue to require explicit confirmation.
- Keep telemetry opt-out working: `AIKC_TELEMETRY_EXPORTER=none`.
- Explain validation in the pull request description, including any check that
  could not run.

## Reporting bugs and proposing features

Use the repository issue templates. Good bug reports include the AIKC version,
host OS, Node/npm version, the smallest reproducible project, the command run,
and redacted output. Do not attach tokens, `.env` files, or private repository
contents.

For security-sensitive findings, follow [SECURITY.md](SECURITY.md) rather than
opening a public issue.
