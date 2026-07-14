#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function exists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function skillPaths() {
  const index = read("ai-knowledge/skills/SKILL_INDEX.md");
  const matches = [...index.matchAll(/`?(ai-knowledge\/skills\/([^/]+)\/SKILL\.md)`?/g)];
  return matches.map(match => ({ skillId: match[2], skillPath: match[1] }));
}

const required = [
  "ai-knowledge/core/human-readable-knowledge-policy.md",
  "ai-knowledge/human/README.md",
  "ai-knowledge/human/core-workflow.md",
];

const missing = required.filter(relPath => !exists(relPath));
for (const { skillId } of skillPaths()) {
  const companion = `ai-knowledge/human/skills/${skillId}.md`;
  if (!exists(companion)) missing.push(companion);
}

if (missing.length > 0) {
  console.error(`Missing human-readable knowledge companions:\n${missing.map(item => `- ${item}`).join("\n")}`);
  process.exit(1);
}

console.log(`human docs ok (${skillPaths().length} skill companions)`);
