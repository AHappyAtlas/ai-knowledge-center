# AIKC Project Capabilities

<!-- aikc-template-version: 2026-06-22 -->

Use this file when a task touches AIKC project setup, dashboard metadata, workflow manifests, gates, MCP, integrations, telemetry, Dagger, project discovery, upgrade behavior, or package lifecycle.

## Core Runtime Shape

- AIKC is distributed as the global npm CLI `aikc` / `ai-knowledge-center`.
- AIKC can also run as a stdio MCP server with `aikc mcp --project <path>` for agent clients that need structured access to manifests, doctor, context-pack, knowledge search, skills, and allowlisted commands.
- Production serves the dashboard UI and `/api/*` from one Fastify process and one local port, default `127.0.0.1:4318`.
- `aikc` starts the server in the background by default and keeps request logging quiet; use `--foreground --log-level info` for debugging and `aikc stop` to stop the background server.
- Development may use Vite for the UI and Fastify for the API, but generated project workflows should not assume a separate frontend host.
- Binding to `0.0.0.0` or broad network exposure is intentional operational work and should not be introduced casually.

## Project Discovery

AIKC can discover projects from:

- explicit `--projects` or `AIKC_PROJECTS`;
- `--config-dir`, `AIKC_CONFIG_DIR`, or `~/.ai-knowledge-center/config/projects.json`;
- persisted user registry entries written by `aikc upgrade --project <path> --write`;
- workspace auto-discovery from the current directory, configured workspace, or common local code folders when no registry entries exist.

Project initialization must not overwrite human docs, local config, or uncommitted project work.
Project registration must merge with the user registry and preserve existing entries.

## Manifest Contract

`ai-workflow.yaml` is the project manifest for:

- knowledge entrypoints: `load`, `core`, `aiLoad`, `skills`, `skillIndex`, `closeoutPrompt`, and `agentsFile`;
- gates and commands;
- bounded loops with input, output, validation, budget, stop condition, and escalation;
- dashboard watched paths and links;
- MCP server metadata;
- optional integrations such as current docs lookup, browser QA, and GitHub automation;
- telemetry settings;
- Dagger metadata.

Commands and gates should use exact shell commands for AIKC internal workflow scripts, usually under `ai-knowledge/scripts`. Host project package scripts are for the host project's own build, test, and runtime tasks. Commands marked `dangerous: true` require explicit confirmation through trusted automation.
Gate categories should accept common workflow categories such as `knowledge`, `typecheck`, `lint`, `test`, `security`, `build`, and `custom`; unknown project-specific categories should degrade to `custom` instead of breaking dashboard loading.
The standard gate set should include an internal code review command such as `node ai-knowledge/scripts/code-review.cjs`; non-read-only work is incomplete until code review and all applicable gates pass.

Durable Agent loops should be declared through manifest commands, gates, watched paths, or dashboard metadata. Each loop must follow `ai-knowledge/core/bounded-loop-policy.md`: define input, output, validation, budget, stop condition, and human escalation.

Standard AIKC-managed projects should expose doctor, context-pack, and workflow eval commands:

- `node ai-knowledge/scripts/doctor.cjs`
- `node ai-knowledge/scripts/context-pack.cjs --task "<task>"`
- `node ai-knowledge/scripts/eval-workflow.cjs`

Standard AIKC-managed projects should declare the repo-scoped AIKC MCP server:

```yaml
mcp:
  servers:
    - id: aikc
      label: AI Knowledge Center MCP
      type: stdio
      command: aikc
      args: [mcp, --project, .]
      scope: repository
```

Use `integrations` to advertise optional open-source helpers without silently granting network, browser, GitHub, semantic indexing, or broader filesystem access:

```yaml
integrations:
  docs:
    provider: context7
    mode: optional
  repoDocs:
    provider: custom
    mode: optional
  semanticCodeSearch:
    provider: custom
    mode: optional
  browserQa:
    provider: playwright
    mode: optional
  vcs:
    provider: github-mcp
    mode: optional
```

## Dashboard Contract

The dashboard is document-first and should expose project context without becoming the source of truth.

Stable dashboard surfaces include:

- project menu with search and status filters;
- focused project context for Git state, knowledge assets, MCP, integrations, telemetry, Dagger, gates, commands, and links;
- knowledge list sorted by references, updated time, or created time;
- knowledge search and Markdown preview;
- AI Agent setup prompt aligned with CLI upgrade templates.

The repository checkout remains the source of truth; AIKC does not copy project knowledge into an internal database.

## Upgrade And Initialization

`aikc upgrade --project <path> --write --ai` is the standard safe setup and upgrade path.

Required behavior:

- create missing workflow files and AI knowledge scripts;
- keep existing differing files unchanged;
- write `*.aikc-upgrade.md` candidates beside conflicts;
- write `.aikc/upgrade/AI_UPGRADE_PROMPT.md`;
- register the project in `~/.ai-knowledge-center/config/projects.json` without replacing existing projects;
- ask the Agent to semantically merge candidates instead of blindly overwriting project rules;
- keep `ai-knowledge/core/**` as AIKC-maintained workflow and project-specific rules in skills or project references.

`--force` may overwrite conflicts after backups, but should be rare maintenance work.

## Token And Template Updates

- `node ai-knowledge/scripts/ensure-aikc-cli.cjs` checks the global CLI against npm and installs or updates it when needed.
- `node ai-knowledge/scripts/ensure-aikc-cli.cjs --upgrade` should actively try to update the global CLI, stop and restart a running background `aikc` server when needed, then call the current global CLI to refresh templates for the current project with `aikc upgrade --project . --write --ai` by default.
- Pass `--no-ai` after `--upgrade` only when the AI handoff prompt should be skipped.
- If npm global update fails, the Agent must report the failure and provide manual retry commands: `aikc stop`, `npm install -g ai-knowledge-center@latest`, and `aikc`.
- If a background `aikc` Web process is already running when the global CLI is updated, the ensure script must restart it so the dashboard uses the new package.
- Token checks should stay sparse: explicit token/context/routing tasks, first local state creation, or changes to core entrypoints, `AGENTS.md`, `ai-workflow.yaml`, or `SKILL_INDEX.md`.
- Template upgrades should preserve package manager choices, gates, MCP settings, dashboard metadata, response templates, and project skills.
- Template upgrades should merge missing MCP servers and integrations by id, preserving project-local settings.

## API And Automation

Useful local API surfaces include:

- `GET /api/health`;
- `GET /api/projects`;
- `GET /api/projects/:projectId`;
- `GET /api/projects/:projectId/knowledge`;
- `GET /api/projects/:projectId/knowledge/search`;
- `GET /api/projects/:projectId/knowledge/preview`;
- `POST /api/projects/:projectId/run/:commandId`.

The API is for trusted local automation or AI workflows that already understand the project manifest.

Useful MCP tool surfaces include project listing, manifest summary, doctor, context-pack, knowledge search/preview, skill listing, and manifest-command execution. Manifest-command execution must remain allowlisted by `ai-workflow.yaml`; dangerous commands still require explicit confirmation.

## Release Discipline

For AIKC package changes:

- edit `src/` and rebuild `dist/`;
- keep README, dashboard prompt, project-upgrader templates, and server auto-initializer templates aligned;
- run `node ai-knowledge/scripts/doctor.cjs`, `node ai-knowledge/scripts/eval-workflow.cjs`, `node ai-knowledge/scripts/knowledge-check.cjs`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm pack --dry-run`;
- verify temporary project initialization when template behavior changes;
- never publish with a token that fails `npm whoami`.
