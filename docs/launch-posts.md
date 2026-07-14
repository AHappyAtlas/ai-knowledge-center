# Launch-post drafts

These drafts are starting points. Verify each claim against the released
version and link to the public repository before publishing.

## English

**Your coding agent read the docs. Did it run the right checks?**

AI Knowledge Center is a local-first CLI, dashboard, and repo-scoped MCP server
for coding-agent workflows. It keeps project knowledge, allowed commands, and
verification gates discoverable in one project manifest, then exposes compact
context and health checks to agents.

The goal is not another agent runtime. It is a small control layer for the
project you already have: agents load relevant knowledge, see the gates they
must run, and leave verifiable evidence.

- default local binding;
- repository-scoped MCP;
- manifest allowlists for commands;
- optional integrations do not silently grant permissions;
- telemetry export can be disabled.

Try the quick start, tell us where your agent loses project context, and share
the validation workflow you want AIKC to support.

## 中文

**你的代码 Agent 读了文档，但它真的跑了正确的检查吗？**

AI Knowledge Center 是面向代码 Agent 的本地优先 CLI、Dashboard 和
repo-scoped MCP。它把项目知识、允许执行的命令和验证门禁组织在项目内，再向
Agent 提供最小上下文与可验证的健康检查结果。

它不是另一个万能 Agent runtime，而是给现有项目增加一层轻量控制面：Agent
知道该读什么、该跑什么检查，以及如何留下可复核的证据。

- 默认仅本机监听；
- MCP 默认限制在仓库范围；
- 命令必须来自 manifest allowlist；
- 集成声明不会静默扩大权限；
- 可用 `AIKC_TELEMETRY_EXPORTER=none` 关闭遥测导出。

欢迎试用，并分享你最希望 AIKC 帮 Agent 固化的项目验证流程。
