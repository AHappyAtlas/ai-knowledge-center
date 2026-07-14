# AIKC Open-Source Release

This is the human-readable companion for:

```text
ai-knowledge/skills/aikc-open-source-release/SKILL.md
```

## Purpose

Use this skill when turning AIKC changes into a public npm and GitHub release.
It makes release readiness reproducible without storing credentials or
automating a publish action.

## What it protects

The workflow checks that the packed npm artifact—not only the current checkout—
can install and initialize a clean project. The test isolates AIKC state in a
temporary directory so it cannot write to a contributor's normal registry.
CI repeats that same test on Windows, macOS, and Linux.

The skill also preserves AIKC's intended security boundaries: localhost by
default, repository-scoped MCP, manifest allowlists, and optional telemetry.

## Maintainer responsibilities

Review `docs/release-checklist.md` before publishing. A maintainer must make
the final npm and GitHub Release actions because they require account authority
and release judgment. Never include `.env.local`, npm tokens, or private
project files in a commit, issue, release note, or log.

## Update triggers

Update the companion and skill when package validation, platform support,
security boundaries, or the release approval model changes. Update neither for
a routine version bump alone.

## Validation

```powershell
node ai-knowledge/scripts/human-docs-check.cjs
node ai-knowledge/scripts/knowledge-check.cjs
npm run smoke:package
```
