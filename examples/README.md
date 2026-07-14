# AIKC example projects

Each directory is a small, self-contained starting point for a public demo or
local evaluation. They are intentionally not included in the published npm
package.

| Example | Demonstrates | Start |
| --- | --- | --- |
| `typescript-gates` | A TypeScript project whose manifest declares typecheck, lint, and build gates. | `cd examples/typescript-gates; npm install; npx aikc doctor --project . --json` |
| `existing-project-upgrade` | An existing project with human-owned instructions that AIKC upgrades additively. | Copy it to a temporary directory, then run `aikc upgrade --project . --write --ai`. |
| `multi-agent-skills` | A repo-scoped MCP and standard `SKILL.md` collection for multiple coding agents. | `aikc mcp --project examples/multi-agent-skills` |

Run examples in a temporary checkout. Do not use the fixture directories as a
replacement for a real repository's instructions or security policy.
