# 任务收尾：Review 并沉淀

在完成任何代码、配置或知识库改动前，Agent 必须执行本 prompt。只读问答任务可以跳过命令验证，但要说明 `N/A`。

## 1. Review

- 重新核对用户原始任务和实际改动是否一致。
- 检查是否误改人类文档、项目配置、生成物或无关文件。
- 检查 `ai-workflow.yaml`、`AGENTS.md`、`ai-knowledge/LOAD.md`、`ai-knowledge/core/LOAD.md`、`ai-knowledge/core/LOAD-END.md`、`ai-knowledge/ai/LOAD.md` 是否仍然互相指向正确。
- 如果存在 `.aikc-upgrade.md` 候选文件，只能语义合并，不要粗暴覆盖。
- 如果改动 MCP 或 integrations，确认 MCP 仍默认 repo-scoped，`integrations` 仍是声明式可选能力，不会静默授予网络、浏览器、GitHub 或更大文件系统权限。

## 2. Validate

按改动范围运行 `ai-workflow.yaml` 声明的 gates。最低要求：

```powershell
node ai-knowledge/scripts/knowledge-check.cjs
```

涉及 TypeScript、CLI、server、client、manifest loader 或宿主项目 package scripts 时，还要运行：

```powershell
npm run typecheck
npm run lint
npm run build
```

如果无法运行某项，记录命令、失败原因和剩余风险，不要伪造通过。

## 3. Knowledge Capture

`ai-knowledge/core/**` 是 AIKC 维护的核心工作流；不要把项目相关经验写入 core。只沉淀稳定、可复用、项目相关的经验：

- 项目约束。
- 常见故障模式。
- 验证流程。
- CLI、manifest、dashboard、MCP、integrations、telemetry 的长期规则。

不要沉淀：

- 一次性聊天记录。
- 仅对本轮临时成立的路径。
- 未验证猜测。
- 用户隐私或凭据。

如果新增或修改项目 skill，必须同步更新 `ai-knowledge/skills/SKILL_INDEX.md`。

如果本轮出现 Agent 以后会重复执行的操作，必须判断是否应该封装为：

- 项目脚本：确定性的本地/远程命令序列、验证、部署或文件处理。
- 项目 skill：需要判断的复用流程、排障路径或领域步骤。
- MCP/server tool：需要结构化输入、权限边界、外部状态或大量重复工具调用的操作。
- reference：支持 skill 的清单、模板或长解释。

封装前要分别标注本机操作系统和远程目标机器操作系统，避免 Windows、Linux、macOS 的 shell、路径和权限差异被隐藏在提示词里。

## 4. Final Report

最终回复必须包含：

- 创建或修改的文件。
- 已运行的验证命令及结果。
- code review 结论。
- knowledge-capture 结论。
- reusable automation/token-efficiency 结论。
- 剩余风险，或 `暂无已知剩余风险`。
