# Release checklist

This checklist creates a repeatable, auditable AIKC release. It intentionally
does not publish packages or create GitHub releases automatically.

## Prepare

- [ ] Confirm the version in `package.json` and update `CHANGELOG.md`.
- [ ] Review the README quick start, security boundary statements, and CLI
      examples against the built package.
- [ ] Upload `docs/assets/ai-knowledge-center-social-preview.svg` (or a
      raster export) as the repository social-preview image.
- [ ] Check that no `.env`, token, private project data, local logs, or user
      registry files are staged.
- [ ] Confirm the release can be rolled back by installing the previous npm
      version.

## Validate

```powershell
node ai-knowledge/scripts/doctor.cjs --json
node ai-knowledge/scripts/eval-workflow.cjs
node ai-knowledge/scripts/code-review.cjs
node ai-knowledge/scripts/knowledge-check.cjs
npm run typecheck
npm run lint
npm run build
npm pack --dry-run
```

- [ ] In a temporary empty directory, verify both a local `npx -y ai-knowledge-center@<version> upgrade --project . --write --ai` flow and a global npm-prefix install flow.
- [ ] Confirm the generated project is safe to rerun and conflicting files
      produce `*.aikc-upgrade.md` candidates rather than being overwritten.
- [ ] Run `npx -y ai-knowledge-center@<version> doctor --project <temporary-project> --json` against that
      generated project.
- [ ] Verify the built CLI starts locally and `/api/health` responds on
      `127.0.0.1`.

## Publish

- [ ] Verify npm identity with `npm whoami`; never paste the token into logs.
- [ ] Publish using the approved release account.
- [ ] Create a GitHub Release with the matching tag, changelog excerpt,
      upgrade notes, rollback version, and validated platforms.
- [ ] Install the published package in a clean environment and rerun the
      quick-start flow.

## Announce and observe

- [ ] Publish the English and Chinese launch posts from `docs/launch-posts.md`.
- [ ] Link the demo, quick start, security model, and issue templates.
- [ ] Record source, installs, issues, and activation signals for the next
      two-week review; do not optimize only for stars.
