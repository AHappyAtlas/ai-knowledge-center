# Coding-agent compatibility

AIKC is a project-local workflow layer. Its portable artifacts are Markdown
knowledge, `AGENTS.md`, `ai-workflow.yaml`, standard `SKILL.md` folders, and a
stdio MCP server. It does not replace a coding agent's own permission model or
configuration format.

| Surface | Codex | Claude Code | Cursor | GitHub Copilot |
| --- | --- | --- | --- | --- |
| Project instructions and Markdown knowledge | Read `AGENTS.md` and AIKC knowledge paths | Read project instructions and AIKC knowledge paths | Read project instructions and AIKC knowledge paths | Read repository instructions and AIKC knowledge paths |
| Project `SKILL.md` collection | Supported when the client enables project skills | Supported when the client enables project skills | Supported when the client enables project skills | Supported when the client enables project skills |
| AIKC stdio MCP | Configure `aikc mcp --project <path>` | Configure the same command in the client | Configure the same command in the client | Configure the same command in the client |
| Gates and command allowlist | Query through MCP or read `ai-workflow.yaml` | Query through MCP or read `ai-workflow.yaml` | Query through MCP or read `ai-workflow.yaml` | Query through MCP or read `ai-workflow.yaml` |

## What is verified by AIKC CI

The published npm artifact is smoke-tested on Windows, macOS, and Linux CI
runners. The test packs the artifact, installs it into an isolated local
project and an isolated npm global prefix, initializes empty projects, then
runs `doctor` and `context-pack`.

This verifies the AIKC CLI. Each agent client still needs its own current MCP
and project-skill configuration, and users should grant only the permissions
needed for the task.

## Shared setup

Initialize the repository first:

```powershell
npx -y ai-knowledge-center@latest upgrade --project . --write --ai
```

Then configure your client to launch this repository-scoped MCP server:

```text
aikc mcp --project <absolute-project-path>
```

Do not configure an unrestricted filesystem server merely to use AIKC.
