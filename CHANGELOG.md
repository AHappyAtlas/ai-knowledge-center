# Changelog

All notable user-facing changes are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.1] - 2026-07-14

### Added

- Third-party dependency notices with reproducible review and audit commands,
  included in the published npm package.

### Changed

- Repository discovery metadata, topics, Discussions, and release notes now
  describe the local-first verification-gates positioning and supported
  platforms.
- The dashboard now uses the platform font stack, removing the unused `geist`
  runtime dependency and its transitive production audit findings.

## [0.2.0] - 2026-07-14

### Added

- Open-source governance, security, and release documentation.
- Continuous integration for the package and knowledge workflow checks.
- Local and global package-install smoke tests across the CI platform matrix.
- `aikc context-pack` CLI entrypoint and persistent, privacy-safe gate evidence.
- Runnable TypeScript, safe-upgrade, and multi-agent example projects.

## Release process

Each release should include a GitHub Release and npm package with:

- user-facing changes grouped as Added, Changed, Fixed, Deprecated, Removed,
  and Security when applicable;
- upgrade and rollback notes when behavior or templates change;
- the exact version and validation evidence.

See [docs/release-checklist.md](docs/release-checklist.md).
