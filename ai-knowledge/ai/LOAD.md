# Agent Stage 0 Router

This is a compatibility router. Core workflow lives in `ai-knowledge/core/LOAD.md`.

When the user says `按 ai-knowledge/LOAD.md 执行, 任务：...`, the Agent must run the workflow itself and must not hand script execution back to the user.

## 1. Extract Task

Extract the text after `任务：` as the task. If the task is unclear, ask one concise clarifying question.

## 2. Ensure CLI

Read `ai-knowledge/core/LOAD.md`, then run:

```powershell
node ai-knowledge/scripts/ensure-aikc-cli.cjs --upgrade
```

## 3. Start Project Route

Run:

```powershell
node ai-knowledge/scripts/ai-workflow-start.cjs --task "<task>"
```

This script checks workflow entrypoints, initializes `.aikc/task-state/current.json`, prints routing context, and triggers the token check only when sparse trigger conditions are met. It does not replace Agent judgment.

After interruptions, context compaction, or long tool sequences, recover task memory from disk:

```powershell
node ai-knowledge/scripts/task-state.cjs resume --json
```

## 4. Skill Routing

Read:

```text
ai-knowledge/skills/SKILL_INDEX.md
```

Load only matching `SKILL.md` files. If no skill matches, work from repository context and decide during closeout whether reusable knowledge should be captured.

## 5. Closeout

Before finishing non-read-only work, read `ai-knowledge/core/LOAD-END.md`, then run:

```powershell
node ai-knowledge/scripts/ai-closeout.cjs
```

Then run every applicable gate from `ai-workflow.yaml`.

## Required First Reply

After loading these entrypoints, reply briefly:

```text
已读取项目约束，将按本项目 AI 工作流执行。
本次任务：<task>
已加载入口：ai-knowledge/LOAD.md, ai-knowledge/core/LOAD.md, ai-knowledge/ai/LOAD.md
将自动执行：AIKC ensure, AI workflow start, applicable gates, AI closeout
```
