# TypeScript gates example

Install dependencies, then run the three declared project gates:

```powershell
npm install
npx aikc doctor --project . --json
npm run typecheck
npm run lint
npm run build
```

The important behavior is explicit: AIKC can read the gate declarations from
`ai-workflow.yaml` instead of asking an agent to guess which commands matter.
