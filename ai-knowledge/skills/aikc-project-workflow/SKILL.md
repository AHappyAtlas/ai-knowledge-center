# AIKC Project Workflow Skill

Use this skill when changing the AI Knowledge Center package itself: CLI behavior, project upgrade templates, manifest loading, dashboard metadata, gates, telemetry, or this repository's AI workflow knowledge.

## Stable Project Facts

- Package name: `ai-knowledge-center`.
- Global CLI names: `aikc` and `ai-knowledge-center`.
- Published CLI entrypoint: `dist/cli/aikc.js`.
- Source CLI entrypoint: `src/cli/aikc.ts`.
- Project upgrade logic lives in `src/cli/project-upgrader.ts`.
- Production dashboard and API are served by Fastify from one port, default `127.0.0.1:4318`.
- Development uses two processes: server on `4318` and Vite UI on `5177`.

## Change Guidance

- Prefer editing `src/` and rebuilding; do not hand-edit `dist/` unless release artifacts are explicitly required.
- Keep CLI options documented in `README.md` aligned with `src/cli/aikc.ts`.
- Keep scaffold templates in `src/cli/project-upgrader.ts` aligned with root examples in `ai-knowledge/`.
- New-project and upgrade templates must include AIKC-maintained `ai-knowledge/core/**`, compatibility entrypoints, internal AI workflow scripts under `ai-knowledge/scripts/**`, and a mandatory final knowledge-capture decision.
- Keep the ownership boundary explicit: `ai-knowledge/core/**` is upgraded by AIKC; project-specific reusable knowledge belongs in `ai-knowledge/skills/**` or project-owned references.
- Core workflow templates must ask agents to package repeated operations as project scripts, project skills, MCP/server tools, or references, with local host OS and remote target OS considered separately.
- Core workflow templates must treat AI workflow loops as bounded loops with explicit input, output, validation, budget, stop condition, and human escalation.
- Core workflow templates must keep AI-facing knowledge compact and maintain human-readable companions under `ai-knowledge/human/**` only when meaning changes or missing companions are backfilled.
- Core workflow templates must include token-efficiency guidance for minimal context loading, log summaries, structured output, caches, operations indexes, doctor commands, and compact closeout.
- Core workflow templates must preserve AIKC project capabilities that are not project-specific: manifest contract, dashboard metadata, gates/commands, MCP, telemetry, Dagger, project discovery, API automation, safe upgrade semantics, and release discipline.
- Core workflow templates must guide agents to prefer mature open-source packages over hand-rolled implementations when they improve CLI parsing, file discovery, search, schema/API contracts, logging, config paths, watchers, process execution, or MCP/server tooling.
- Keep the dashboard initialization prompt in `src/client/App.tsx` aligned with `src/cli/project-upgrader.ts`, so copied prompts, CLI upgrade, and dashboard auto-init describe the same behavior.
- Avoid making `aikc --version` start the server if adding version support; handle informational flags before importing `src/server/index.ts`.
- Preserve the documented behavior that `aikc upgrade --write` creates candidates for conflicts instead of overwriting project-specific files.
- Existing projects should be updateable: changed local files get `*.aikc-upgrade.md` candidates and an AI handoff prompt, not blind overwrites.
- Keep knowledge token checks sparse: trigger them for explicit token/context/routing work, first run state creation, or changes to workflow entrypoints and the compact skill index.
- For token/cache/MCP evaluation, read `ai-knowledge/core/open-source-token-tools.md` after this skill. Prefer AIKC's built-in context-pack, repo-map, log-summary, run-bounded, token-budget-check, repo-scoped filesystem MCP, and `aikc mcp --project .` before adding new tools. Treat Context7 as the approved optional docs lookup; treat semantic code-search MCPs as optional repo-scoped additions only when `repo-map` is too broad.
- Package publishing uses the local environment file when needed: load `NPM_TOKEN` from `.env.local` into the process environment for `npm whoami` and `npm publish`, never print the token, and check `NPM_TOKEN_EXPIRES_AT` before relying on it.

## Validation

For source changes, run:

```powershell
npm run typecheck
npm run lint
npm run build
```

For knowledge-only changes, run:

```powershell
node ai-knowledge/scripts/knowledge-check.cjs
```

For package/CLI changes, also verify:

```powershell
npm pack --dry-run
npm whoami
```

Only add new knowledge here when it is stable and useful for future tasks.
