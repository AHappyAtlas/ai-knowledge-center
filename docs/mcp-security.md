# MCP and local security model

AI Knowledge Center is designed to provide coding agents with project context
without silently broadening their authority.

## Defaults

| Boundary | Default | Operator-controlled change |
| --- | --- | --- |
| Dashboard/API host | `127.0.0.1` | Pass `--host` only when intentional LAN exposure is required. |
| MCP scope | One repository via `aikc mcp --project <path>` | Configure another project explicitly; do not use filesystem-wide scope by default. |
| Command execution | Manifest allowlist | Add exact commands to `ai-workflow.yaml`; review the command before enabling it. |
| High-impact commands | Explicit confirmation | Mark the command `dangerous: true`. |
| Integrations | Declarative only | Explicitly grant network, browser, GitHub, or semantic-search access in the client/task that needs it. |
| Telemetry | Configurable | Set `AIKC_TELEMETRY_EXPORTER=none` to disable export. |

## What the MCP server exposes

The stdio MCP server can return manifests, project summaries, knowledge search
and previews, project skill lists, doctor output, context packs, and allowlisted
manifest command results. It is not a general-purpose filesystem shell.

Start it with an explicit project root:

```powershell
aikc mcp --project C:\repo\my-project
```

## Safe manifest pattern

```yaml
commands:
  - id: verify
    label: Verify package
    command: npm run build
    dangerous: false
  - id: deploy
    label: Deploy production
    command: npm run deploy
    dangerous: true
```

Treat every command as code execution. Keep commands deterministic, avoid
embedding credentials, and use a dry-run flag for destructive or broad changes
when the underlying tool supports one.

## Operator checklist

Before enabling an integration or command, confirm its repository scope, inputs
and outputs, failure behavior, needed permissions, and whether the action is
reversible. Do not use AIKC to bypass your existing source-control, review, or
deployment controls.
