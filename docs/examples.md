# Reproducible examples

These examples show the three workflows AIKC must make easy for a new user.
Runnable fixture directories live in [`examples/`](../examples/README.md).

## 1. TypeScript project: discover and verify gates

```powershell
mkdir aikc-typescript-demo
Set-Location aikc-typescript-demo
npm init -y
npx -y ai-knowledge-center@latest upgrade --project . --write --ai
npx -y ai-knowledge-center@latest doctor --project . --json
```

Expected result: the generated `ai-workflow.yaml` contains AIKC workflow
commands and gates; `doctor` returns structured health evidence. Add your
project's `typecheck`, `lint`, and `build` commands to the manifest, then have
the agent use the allowlisted gate metadata rather than guessing commands.

Use the top-level CLI to show the smallest recommended reading set for a task:

```powershell
npx -y ai-knowledge-center@latest context-pack --project . --task "add a health endpoint" --summary
```

## 2. Existing project: safe upgrade candidates

```powershell
aikc upgrade --project C:\repo\existing-app --dry-run
aikc upgrade --project C:\repo\existing-app --write --ai
```

Expected result: missing workflow files are created. Existing files that differ
are preserved and receive adjacent `*.aikc-upgrade.md` candidates for semantic
merge; they are not overwritten by default.

## 3. Multi-agent project: repository-scoped context

```powershell
aikc mcp --project C:\repo\existing-app
```

Expected result: an MCP client can inspect the manifest, search knowledge,
generate a context pack, list skills, run doctor, and invoke only allowlisted
commands. Keep the MCP server restricted to the repository root.
