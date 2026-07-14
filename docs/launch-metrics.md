# Launch metrics

Use this template after a public release to learn which problem-led posts lead
to real use. Do not optimize for stars alone and do not collect user content,
tokens, or repository data.

## Baseline and cadence

Record a baseline before the first announcement, then update this table once a
week for six weeks. Keep the raw source links and screenshots out of the
repository unless they are explicitly public and reusable.

| Metric | Baseline | Week 2 target | Week 6 target | Source |
| --- | ---: | ---: | ---: | --- |
| GitHub stars | 0 | 100 | 300–500 | Repository Insights / API |
| npm weekly downloads | 0 | 50 | 200 | npm downloads API |
| New external Issues or Discussions | 0 | 10 | 30 | GitHub Issues + Discussions |
| External contributors | 0 | 1–2 | 3–5 | Git history / PRs |
| Public case-study repositories | 0 | 3 | 8 | Showcase issue template |
| Successful-install reports | 0 | 90%+ | 95%+ | Support and doctor reports |

## Weekly evidence

For each launch channel, record one concise row outside the repository or in a
public Discussion:

| Week | Channel and problem addressed | Canonical link | Installs / issues / discussions | What to change next |
| --- | --- | --- | --- | --- |
| 1 | Example: “How do we stop an agent from skipping project gates?” | URL | Counts only | Keep, revise, or stop |

Use different canonical links or campaign labels per channel when an analytics
surface supports them. Do not infer installs from stars or impressions.

## Read-only collection commands

These commands collect public aggregate counts; they do not access user
projects or telemetry:

```powershell
gh repo view AHappyAtlas/ai-knowledge-center --json stargazerCount,issues
gh api repos/AHappyAtlas/ai-knowledge-center/traffic/views
gh api repos/AHappyAtlas/ai-knowledge-center/traffic/clones
Invoke-RestMethod https://api.npmjs.org/downloads/point/last-week/ai-knowledge-center
```

GitHub traffic endpoints can return only a rolling window and may require the
repository owner's token. If a source cannot be measured, mark it as unknown
rather than inventing attribution.

## Decision rules

- Respond to first-use and installation issues within 24–48 hours.
- Turn repeated installation failures into `doctor` improvements or an
  automated repair before expanding FAQ text.
- Ship a small version only when it improves installation, compatibility,
  visible verification evidence, or documentation.
- Stop a channel that produces only low-quality stars or irrelevant traffic;
  prioritize public examples, useful Issues, and reproducible feedback.
