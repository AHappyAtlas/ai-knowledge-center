# Existing project upgrade example

This fixture represents a repository that already owns its instructions. Copy
it outside the AIKC source tree and run:

```powershell
aikc upgrade --project . --write --ai
```

AIKC must preserve `AGENTS.md`. If the generated template differs, it writes
an adjacent `AGENTS.aikc-upgrade.md` candidate for a semantic merge rather than
overwriting the human-owned file.
