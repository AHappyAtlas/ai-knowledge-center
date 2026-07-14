# Security Policy

## Supported versions

Security fixes are made for the latest published npm version. Please upgrade
before reporting a behavior that may already be fixed.

## Reporting a vulnerability

Do not open a public GitHub issue for a suspected vulnerability. Use the
repository's private security advisory reporting channel when it is enabled. If
private reporting is unavailable, contact the repository maintainer privately
through the repository profile and include only the minimum details needed to
start triage.

Include:

- affected AIKC version and host OS;
- a minimal, redacted reproduction;
- impact and any prerequisites;
- a suggested mitigation, if known.

Do not include access tokens, `.env` files, private project documents, or
customer data. The project aims to acknowledge reports within seven days and
will coordinate a fix and disclosure timeline with the reporter.

## Security boundaries

- The server binds to `127.0.0.1` by default. Binding another host is an
  explicit operator action.
- AIKC MCP is repository-scoped when started with `aikc mcp --project <path>`.
- Manifest command execution is allowlisted; `dangerous: true` commands require
  confirmation.
- Telemetry export can be disabled with `AIKC_TELEMETRY_EXPORTER=none`.

See [docs/mcp-security.md](docs/mcp-security.md) for the operating model.
