#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const requiredFiles = [
  "ai-workflow.yaml",
  ".aikcignore",
  "AGENTS.md",
  "ai-knowledge/LOAD.md",
  "ai-knowledge/core/LOAD.md",
  "ai-knowledge/core/LOAD-END.md",
  "ai-knowledge/core/knowledge-capture-policy.md",
  "ai-knowledge/core/script-automation-policy.md",
  "ai-knowledge/core/bounded-loop-policy.md",
  "ai-knowledge/core/human-readable-knowledge-policy.md",
  "ai-knowledge/core/token-efficiency.md",
  "ai-knowledge/core/open-source-token-tools.md",
  "ai-knowledge/core/project-capabilities.md",
  "ai-knowledge/core/open-source-usage.md",
  "ai-knowledge/core/human-friendly-task-summary.md",
  "ai-knowledge/core/task-closeout-verification.md",
  "ai-knowledge/core/task-closeout-risk-report.md",
  "ai-knowledge/core/code-review-policy.md",
  "ai-knowledge/ai/LOAD.md",
  "ai-knowledge/prompt/任务收尾-Review并沉淀.md",
  "ai-knowledge/skills/SKILL_INDEX.md",
  "ai-knowledge/skills/aikc-project-workflow/SKILL.md",
  "ai-knowledge/human/README.md",
  "ai-knowledge/human/core-workflow.md",
  "ai-knowledge/human/skills/aikc-project-workflow.md",
  "ai-knowledge/scripts/README.md",
  "ai-knowledge/scripts/ensure-aikc-cli.cjs",
  "ai-knowledge/scripts/ai-workflow-start.cjs",
  "ai-knowledge/scripts/ai-closeout.cjs",
  "ai-knowledge/scripts/code-review.cjs",
  "ai-knowledge/scripts/context-pack.cjs",
  "ai-knowledge/scripts/log-summary.cjs",
  "ai-knowledge/scripts/run-bounded.cjs",
  "ai-knowledge/scripts/repo-map.cjs",
  "ai-knowledge/scripts/token-budget-check.cjs",
  "ai-knowledge/scripts/observe-workflow.cjs",
  "ai-knowledge/scripts/doctor.cjs",
  "ai-knowledge/scripts/eval-workflow.cjs",
  "ai-knowledge/scripts/task-state.cjs",
  "ai-knowledge/scripts/human-docs-check.cjs",
  "ai-knowledge/scripts/knowledge-check.cjs",
  "ai-knowledge/scripts/knowledge-token-check.cjs",
  "ai-knowledge/evals/workflow-smoke.json",
];

const missing = requiredFiles.filter(relPath => !fs.existsSync(path.join(repoRoot, relPath)));
if (missing.length) {
  console.error(`Missing required knowledge files:\n${missing.map(item => `- ${item}`).join("\n")}`);
  process.exit(1);
}

const skillIndex = fs.readFileSync(path.join(repoRoot, "ai-knowledge/skills/SKILL_INDEX.md"), "utf8");
const skillLinks = [...skillIndex.matchAll(/`(ai-knowledge\/skills\/[^`]+\/SKILL\.md)`/g)].map(match => match[1]);
const missingSkills = skillLinks.filter(relPath => !fs.existsSync(path.join(repoRoot, relPath)));
if (missingSkills.length) {
  console.error(`Skill index references missing skills:\n${missingSkills.map(item => `- ${item}`).join("\n")}`);
  process.exit(1);
}

const loadEnd = fs.readFileSync(path.join(repoRoot, "ai-knowledge/core/LOAD-END.md"), "utf8");
if (!loadEnd.includes("Reply Message Rules") || !loadEnd.includes("human-friendly-task-summary.md")) {
  console.error("Core closeout is missing reply message rules.");
  process.exit(1);
}
if (!loadEnd.includes("code-review-policy.md") || !loadEnd.includes("ai-knowledge/scripts/code-review.cjs")) {
  console.error("Core closeout is missing code review requirements.");
  process.exit(1);
}

const replySummary = fs.readFileSync(path.join(repoRoot, "ai-knowledge/core/human-friendly-task-summary.md"), "utf8");
if (!replySummary.includes("Progress Replies") || !replySummary.includes("Final Replies") || !replySummary.includes("Code review") || !replySummary.includes("Multi-Item Tables")) {
  console.error("Human-friendly task summary is missing progress or final reply rules.");
  process.exit(1);
}

const codeReviewPolicy = fs.readFileSync(path.join(repoRoot, "ai-knowledge/core/code-review-policy.md"), "utf8");
if (!codeReviewPolicy.includes("Required Review Steps") || !codeReviewPolicy.includes("Final Response Requirement")) {
  console.error("Core code review policy is missing required sections.");
  process.exit(1);
}

const scriptAutomationPolicy = fs.readFileSync(path.join(repoRoot, "ai-knowledge/core/script-automation-policy.md"), "utf8");
if (!scriptAutomationPolicy.includes("When To Script") || !scriptAutomationPolicy.includes("Script Standards") || !scriptAutomationPolicy.includes("Automation Candidate Table") || !scriptAutomationPolicy.includes("Host project `package.json` must not")) {
  console.error("Core script automation policy is missing required sections.");
  process.exit(1);
}

const boundedLoopPolicy = fs.readFileSync(path.join(repoRoot, "ai-knowledge/core/bounded-loop-policy.md"), "utf8");
if (!boundedLoopPolicy.includes("Loop Contract") || !boundedLoopPolicy.includes("stop condition") || !boundedLoopPolicy.includes("human escalation")) {
  console.error("Core bounded loop policy is missing required sections.");
  process.exit(1);
}

const humanReadablePolicy = fs.readFileSync(path.join(repoRoot, "ai-knowledge/core/human-readable-knowledge-policy.md"), "utf8");
if (!humanReadablePolicy.includes("AI-facing knowledge") || !humanReadablePolicy.includes("human-readable companions") || !humanReadablePolicy.includes("Backfill Rule")) {
  console.error("Core human-readable knowledge policy is missing required sections.");
  process.exit(1);
}

const scriptsReadme = fs.readFileSync(path.join(repoRoot, "ai-knowledge/scripts/README.md"), "utf8");
if (!scriptsReadme.includes("Do not add these commands to a host project") || !scriptsReadme.includes("script-automation-policy.md")) {
  console.error("AI knowledge scripts README is missing human usage guidance.");
  process.exit(1);
}

const workflow = fs.readFileSync(path.join(repoRoot, "ai-workflow.yaml"), "utf8");
if (!workflow.includes("ai-knowledge/scripts/code-review.cjs")) {
  console.error("ai-workflow.yaml is missing the code review gate.");
  process.exit(1);
}

const contextPackScript = fs.readFileSync(path.join(repoRoot, "ai-knowledge/scripts/context-pack.cjs"), "utf8");
if (!contextPackScript.includes("stablePrefixFiles") || !contextPackScript.includes("estimatedTokens") || !contextPackScript.includes("hash") || !contextPackScript.includes("toolOutputPolicy") || !contextPackScript.includes("deferredFiles")) {
  console.error("Context pack script is missing stable-prefix cache metadata or bounded output policy.");
  process.exit(1);
}

const logSummaryScript = fs.readFileSync(path.join(repoRoot, "ai-knowledge/scripts/log-summary.cjs"), "utf8");
if (!logSummaryScript.includes("--lines") || !logSummaryScript.includes("recentLines") || !logSummaryScript.includes("Refusing to read outside repository")) {
  console.error("Log summary script is missing bounded repository-scoped log-reading behavior.");
  process.exit(1);
}
const runBoundedScript = fs.readFileSync(path.join(repoRoot, "ai-knowledge/scripts/run-bounded.cjs"), "utf8");
if (!runBoundedScript.includes(".aikc") || !runBoundedScript.includes("runs") || !runBoundedScript.includes("max-chars") || !runBoundedScript.includes("fullLogPath")) {
  console.error("Run-bounded script is missing full-log storage or bounded-output behavior.");
  process.exit(1);
}
const repoMapScript = fs.readFileSync(path.join(repoRoot, "ai-knowledge/scripts/repo-map.cjs"), "utf8");
if (!repoMapScript.includes(".aikcignore") || !repoMapScript.includes("symbols") || !repoMapScript.includes("imports") || !repoMapScript.includes("recommendedFiles")) {
  console.error("Repo map script is missing ignore, symbol, import, or recommendation behavior.");
  process.exit(1);
}
const tokenBudgetScript = fs.readFileSync(path.join(repoRoot, "ai-knowledge/scripts/token-budget-check.cjs"), "utf8");
if (!tokenBudgetScript.includes("max-summary-tokens") || !tokenBudgetScript.includes("recommended-context-budget") || !tokenBudgetScript.includes("run-bounded")) {
  console.error("Token budget check script is missing regression budget checks.");
  process.exit(1);
}
const observeWorkflowScript = fs.readFileSync(path.join(repoRoot, "ai-knowledge/scripts/observe-workflow.cjs"), "utf8");
if (!observeWorkflowScript.includes("workflow-observations.jsonl") || !observeWorkflowScript.includes("context-pack.cjs") || !observeWorkflowScript.includes("token-budget-check.cjs")) {
  console.error("Observe workflow script is missing observation log or metric collection behavior.");
  process.exit(1);
}

const projectUpgrader = fs.readFileSync(path.join(repoRoot, "src/cli/project-upgrader.ts"), "utf8");
const requiredTemplateMarkers = [
  "coreLoadMd",
  "knowledgeCapturePolicyMd",
  "scriptAutomationPolicyMd",
  "boundedLoopPolicyMd",
  "humanReadableKnowledgePolicyMd",
  "aiWorkflowStartScript",
  "aiCloseoutScript",
  "knowledgeCheckScript",
  "runBoundedScript",
  "repoMapScript",
  "tokenBudgetCheckScript",
  "observeWorkflowScript",
  "ai-knowledge/core/LOAD.md",
  "ai-knowledge/core/LOAD-END.md",
  "Reusable Automation Rule",
  "Token Efficiency Rule",
  "token-efficiency.md",
  "bounded-loop-policy.md",
  "human-readable-knowledge-policy.md",
  "project-capabilities.md",
  "open-source-usage.md",
  "code-review-policy.md",
  "codeReviewPolicyMd",
  "codeReviewScript",
  "ai-knowledge/scripts/code-review.cjs",
  "ai-knowledge/scripts/context-pack.cjs",
  "ai-knowledge/scripts/log-summary.cjs",
  "ai-knowledge/scripts/run-bounded.cjs",
  "ai-knowledge/scripts/repo-map.cjs",
  "ai-knowledge/scripts/token-budget-check.cjs",
  "ai-knowledge/scripts/observe-workflow.cjs",
  "ai-knowledge/scripts/doctor.cjs",
  "ai-knowledge/scripts/eval-workflow.cjs",
  "ai-knowledge/scripts/task-state.cjs",
  "ai-knowledge/scripts/human-docs-check.cjs",
  "ai-knowledge/scripts/README.md",
  "Host project `package.json` must not",
  "Reply Message Rules",
  "Multi-Item Tables",
  "Automation Candidate Table",
  "stablePrefixFiles",
  "stablePrefixHash",
  ".aikcignore",
  "run-bounded",
  "repo-map",
  "token-budget-check",
  "observe-workflow",
  "Progress Replies",
  "global CLI update result",
  "npm install -g ai-knowledge-center@latest",
  "knowledge-capture-policy.md",
  "aikc-template-version: ${TEMPLATE_VERSION}",
];
const missingTemplateMarkers = requiredTemplateMarkers.filter(marker => !projectUpgrader.includes(marker));
if (missingTemplateMarkers.length) {
  console.error(`Project upgrade templates are missing required markers:\n${missingTemplateMarkers.map(item => `- ${item}`).join("\n")}`);
  process.exit(1);
}

const initializer = fs.readFileSync(path.join(repoRoot, "src/server/project-initializer.ts"), "utf8");
if (!initializer.includes("ai-knowledge/core/knowledge-capture-policy.md") || !initializer.includes("ai-knowledge/core/script-automation-policy.md") || !initializer.includes("ai-knowledge/core/bounded-loop-policy.md") || !initializer.includes("ai-knowledge/core/human-readable-knowledge-policy.md") || !initializer.includes("ai-knowledge/scripts/README.md") || !initializer.includes("ai-knowledge/scripts/log-summary.cjs") || !initializer.includes("ai-knowledge/core/LOAD-END.md") || !initializer.includes("Reply Message Rules")) {
  console.error("Server auto-initializer is missing core knowledge-capture or LOAD-END templates.");
  process.exit(1);
}

const clientApp = fs.readFileSync(path.join(repoRoot, "src/client/App.tsx"), "utf8");
if (!clientApp.includes("ai-knowledge/core") || !clientApp.includes("knowledge-capture decision") || !clientApp.includes("human-friendly-task-summary.md")) {
  console.error("Dashboard initialization prompt is missing core workflow or knowledge-capture requirements.");
  process.exit(1);
}
if (!clientApp.includes("npm install -g ai-knowledge-center@latest") || !clientApp.includes("global CLI update result")) {
  console.error("Dashboard initialization prompt is missing global CLI update and retry requirements.");
  process.exit(1);
}

const load = fs.readFileSync(path.join(repoRoot, "ai-knowledge/LOAD.md"), "utf8");
const coreLoad = fs.readFileSync(path.join(repoRoot, "ai-knowledge/core/LOAD.md"), "utf8");
if (!load.includes("task-state.cjs") || !coreLoad.includes("task-state.cjs") || !coreLoad.includes("resume --json")) {
  console.error("LOAD entrypoints are missing durable task-state write/read/recover requirements.");
  process.exit(1);
}

const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
if (!readme.includes("npm install -g ai-knowledge-center@latest") || !readme.includes("global CLI update result")) {
  console.error("README setup prompts are missing global CLI update and retry requirements.");
  process.exit(1);
}

console.log(`knowledge ok (${requiredFiles.length} required files, ${skillLinks.length} indexed skills)`);
