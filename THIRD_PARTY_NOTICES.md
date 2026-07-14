# Third-party notices

AI Knowledge Center is distributed under the [MIT License](LICENSE). It uses
open-source npm packages listed in the committed `package.json` and
`package-lock.json` files. The lockfile is the authoritative, reproducible
record of the direct and transitive dependency versions for each release.

## What is included

- Runtime dependencies power the CLI, Fastify server, React dashboard, stdio
  MCP server, validation, and optional OpenTelemetry integration.
- Development dependencies are used only to type-check, lint, build, and test
  the published package.
- Each dependency remains subject to its own license and notice requirements.
  AIKC does not claim ownership of upstream packages or their trademarks.

## Review and audit

Before a release, contributors can inspect the exact dependency tree and npm's
advisory results with:

```powershell
npm ci
npm ls --all
npm audit --omit=dev
```

For an individual package's source, license, and repository metadata, use its
entry in `package-lock.json` or `npm view <package> license repository`.
Security issues in AIKC itself should follow [SECURITY.md](SECURITY.md).
