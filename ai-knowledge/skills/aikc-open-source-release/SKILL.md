# AIKC Open-Source Release Skill

Use this skill when preparing AI Knowledge Center for a public GitHub or npm
release, or when validating release readiness after package, CLI, security,
community, or documentation changes.

## Release Contract

- License, contribution guide, security policy, code of conduct, changelog,
  issue templates, and CI must be present before a first public release.
- Preserve local-first defaults: `127.0.0.1`, repository-scoped MCP,
  allowlisted commands, and telemetry opt-out with
  `AIKC_TELEMETRY_EXPORTER=none`.
- Release notes must include user-visible changes, upgrade notes, rollback
  version, validation evidence, and supported platforms.
- The published CLI must expose `aikc doctor --json` and
  `aikc context-pack --project <path> --task <task>` as direct verification
  and context-routing entrypoints.
- Never print or commit npm tokens, `.env.local`, private project content, or
  user registry data.

## Validation

Run from the package repository:

```powershell
node ai-knowledge/scripts/doctor.cjs --json
node ai-knowledge/scripts/eval-workflow.cjs
node ai-knowledge/scripts/code-review.cjs
node ai-knowledge/scripts/knowledge-check.cjs
npm run typecheck
npm run lint
npm run build
npm pack --dry-run
npm run smoke:package
```

`smoke:package` packs the built package, installs it in a clean local temporary
directory and a temporary npm global prefix, initializes projects through both
install modes, and runs `doctor` plus `context-pack`. It must use an isolated
`AIKC_HOME` and remove its temporary package and state after completion.

## Platform Boundary

- Local host: Windows, macOS, or Linux. The smoke script must handle the local
  npm launcher safely on each platform.
- Remote target: GitHub Actions runners on Windows, macOS, and Linux. CI must
  run the same package smoke test across that matrix.
- No remote shell, SSH, production deployment, or broadened network binding is
  part of release preparation.

## Publish

Use `docs/release-checklist.md` for the human publish sequence. Publishing and
creating a GitHub Release require explicit maintainer authority; do not attempt
them merely because the checks pass.
