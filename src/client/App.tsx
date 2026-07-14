import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Toaster, toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  Bot,
  Cable,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  File,
  FileCheck2,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  Hammer,
  Languages,
  Loader2,
  Moon,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  Plus,
} from 'lucide-react';
import { fetchProjects, listKnowledge, previewKnowledge, searchKnowledge } from './api.js';
import type {
  FileProbe,
  GateStatus,
  KnowledgeListResponse,
  KnowledgeListSort,
  KnowledgePreview,
  KnowledgeSearchResponse,
  ProjectSummary,
} from '../shared/api.js';

type Language = 'zh' | 'en';
type Theme = 'dark' | 'light';
type Tone = 'ok' | 'warn' | 'busy';
type ProjectFilter = 'all' | Tone;
type ProjectTab = 'knowledge' | 'details';
type KnowledgeView = 'all' | 'skills';
type SkillTableSort = 'name' | 'path' | 'references' | 'size' | 'createdAt' | 'updatedAt';
type SortDirection = 'asc' | 'desc';
type KnowledgeTreeNode = {
  name: string;
  path: string;
  children: Map<string, KnowledgeTreeNode>;
  item: KnowledgeListResponse['items'][number] | null;
};
type I18nKey =
  | 'app.subtitle'
  | 'theme.dark'
  | 'theme.light'
  | 'lang.zh'
  | 'lang.en'
  | 'action.refresh'
  | 'summary.projects'
  | 'summary.clean'
  | 'summary.changed'
  | 'summary.warnings'
  | 'summary.gatesPassed'
  | 'summary.lastScan'
  | 'workspace.search'
  | 'workspace.visible'
  | 'filter.all'
  | 'filter.ok'
  | 'filter.busy'
  | 'filter.warn'
  | 'filter.none'
  | 'project.focus'
  | 'side.context'
  | 'side.knowledge'
  | 'side.noSelection'
  | 'projectMenu.title'
  | 'projectMenu.add'
  | 'projectDetail.overview'
  | 'projectDetail.health'
  | 'markdown.preview'
  | 'projectTab.knowledge'
  | 'projectTab.details'
  | 'status.ok'
  | 'status.busy'
  | 'status.warn'
  | 'status.noDescription'
  | 'git.notRepo'
  | 'git.noHead'
  | 'git.changed'
  | 'git.staged'
  | 'git.conflicted'
  | 'git.ahead'
  | 'git.behind'
  | 'knowledge.title'
  | 'knowledge.noCommit'
  | 'knowledge.noCommittedChange'
  | 'knowledge.dirty'
  | 'knowledge.assets'
  | 'asset.load'
  | 'asset.skills'
  | 'asset.agents'
  | 'asset.closeout'
  | 'asset.ok'
  | 'asset.missing'
  | 'capabilities.title'
  | 'capabilities.mcpNone'
  | 'capabilities.server'
  | 'capabilities.servers'
  | 'capabilities.telemetryDisabled'
  | 'capabilities.daggerEnabled'
  | 'capabilities.daggerDetected'
  | 'capabilities.daggerMissing'
  | 'details.title'
  | 'details.root'
  | 'details.manifest'
  | 'details.watch'
  | 'details.links'
  | 'details.updated'
  | 'gates.title'
  | 'gates.none'
  | 'commands.title'
  | 'commands.dangerous'
  | 'agentPrompt.copied'
  | 'agentPrompt.copyFailed'
  | 'run.notRun'
  | 'run.pass'
  | 'run.timeout'
  | 'run.exit'
  | 'confirm.dangerous'
  | 'empty.projects'
  | 'knowledgeSearch.title'
  | 'knowledgeSearch.project'
  | 'knowledgeSearch.query'
  | 'knowledgeSearch.placeholder'
  | 'knowledgeSearch.run'
  | 'knowledgeSearch.results'
  | 'knowledgeSearch.files'
  | 'knowledgeSearch.truncated'
  | 'knowledgeSearch.noResults'
  | 'knowledgeSearch.preview'
  | 'knowledgeSearch.pick'
  | 'knowledgeSearch.size'
  | 'knowledgeSearch.updated'
  | 'knowledgeSearch.previewTruncated'
  | 'knowledgeList.title'
  | 'knowledgeList.sort'
  | 'knowledgeList.references'
  | 'knowledgeList.updatedAt'
  | 'knowledgeList.createdAt'
  | 'knowledgeList.empty'
  | 'knowledgeList.refs'
  | 'knowledgeView.all'
  | 'knowledgeView.skills'
  | 'skillList.title'
  | 'skillList.empty'
  | 'skillTable.filter'
  | 'skillTable.name'
  | 'skillTable.path'
  | 'skillTable.usageCount'
  | 'skillTable.size'
  | 'skillTable.createdAt'
  | 'skillTable.updatedAt'
  | 'skillTable.pageSize'
  | 'skillTable.page'
  | 'skillTable.previous'
  | 'skillTable.next'
  | 'skillTable.open';

const spring = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.75,
} as const;

const fadeIn = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: spring,
};

const i18n: Record<Language, Record<I18nKey, string>> = {
  zh: {
    'app.subtitle': '本地 AI 工程控制台：统一查看项目知识、规则、门禁、MCP、Telemetry 与 Dagger 状态。',
    'theme.dark': '深色',
    'theme.light': '浅色',
    'lang.zh': '中文',
    'lang.en': 'English',
    'action.refresh': '刷新',
    'summary.projects': '项目',
    'summary.clean': '健康项目',
    'summary.changed': '变更文件',
    'summary.warnings': '告警',
    'summary.gatesPassed': '已通过门禁',
    'summary.lastScan': '最近扫描',
    'workspace.search': '筛选项目、路径或描述',
    'workspace.visible': '当前显示',
    'filter.all': '全部',
    'filter.ok': '健康',
    'filter.busy': '有变更',
    'filter.warn': '需关注',
    'filter.none': '没有匹配的项目。',
    'project.focus': '聚焦',
    'side.context': '当前上下文',
    'side.knowledge': '知识',
    'side.noSelection': '选择一个项目后，知识搜索和运行输出会跟随它。',
    'projectMenu.title': '项目菜单',
    'projectMenu.add': '添加项目',
    'projectDetail.overview': '项目详情',
    'projectDetail.health': '状态概览',
    'markdown.preview': '预览',
    'projectTab.knowledge': '知识库',
    'projectTab.details': '项目详情',
    'status.ok': '健康',
    'status.busy': '有变更',
    'status.warn': '需关注',
    'status.noDescription': '暂无项目描述。',
    'git.notRepo': '非 Git 仓库',
    'git.noHead': '无 HEAD',
    'git.changed': '变更',
    'git.staged': '已暂存',
    'git.conflicted': '冲突',
    'git.ahead': '领先',
    'git.behind': '落后',
    'knowledge.title': '知识版本',
    'knowledge.noCommit': '未追踪',
    'knowledge.noCommittedChange': '没有找到已提交的 AI 知识变更。',
    'knowledge.dirty': '未提交',
    'knowledge.assets': '知识资产',
    'asset.load': 'LOAD',
    'asset.skills': '技能',
    'asset.agents': 'AGENTS',
    'asset.closeout': '收尾',
    'asset.ok': '正常',
    'asset.missing': '缺失',
    'capabilities.title': '开放工作流',
    'capabilities.mcpNone': '未声明',
    'capabilities.server': '个服务',
    'capabilities.servers': '个服务',
    'capabilities.telemetryDisabled': '已关闭',
    'capabilities.daggerEnabled': '已启用',
    'capabilities.daggerDetected': '已检测',
    'capabilities.daggerMissing': '未检测',
    'details.title': '项目细节',
    'details.root': '根目录',
    'details.manifest': '清单',
    'details.watch': '关注路径',
    'details.links': '链接',
    'details.updated': '更新时间',
    'gates.title': '门禁',
    'gates.none': '未声明门禁。',
    'commands.title': '命令',
    'commands.dangerous': '危险',
    'agentPrompt.copied': '已复制',
    'agentPrompt.copyFailed': '复制失败',
    'run.notRun': '未运行',
    'run.pass': '通过',
    'run.timeout': '超时',
    'run.exit': '退出码',
    'confirm.dangerous': '运行危险命令',
    'empty.projects': '没有找到项目。请在项目目录运行 aikc，设置 AIKC_WORKSPACE/AIKC_PROJECTS，或创建 config/projects.json。',
    'knowledgeSearch.title': '知识搜索',
    'knowledgeSearch.project': '项目',
    'knowledgeSearch.query': '关键词',
    'knowledgeSearch.placeholder': '搜索 LOAD、技能、AGENTS、收尾文档...',
    'knowledgeSearch.run': '搜索',
    'knowledgeSearch.results': '结果',
    'knowledgeSearch.files': '文件',
    'knowledgeSearch.truncated': '结果已截断',
    'knowledgeSearch.noResults': '没有匹配结果。',
    'knowledgeSearch.preview': '预览',
    'knowledgeSearch.pick': '选择一个搜索结果预览文件。',
    'knowledgeSearch.size': '大小',
    'knowledgeSearch.updated': '更新',
    'knowledgeSearch.previewTruncated': '预览已截断',
    'knowledgeList.title': '知识列表',
    'knowledgeList.sort': '排序',
    'knowledgeList.references': '引用',
    'knowledgeList.updatedAt': '更新',
    'knowledgeList.createdAt': '创建',
    'knowledgeList.empty': '没有可预览的知识文件。',
    'knowledgeList.refs': '引用',
    'knowledgeView.all': '全部知识',
    'knowledgeView.skills': 'Skills',
    'skillList.title': 'Skill 列表',
    'skillList.empty': '没有找到可预览的 skill 文件。',
    'skillTable.filter': '筛选 skill',
    'skillTable.name': '名称',
    'skillTable.path': '路径',
    'skillTable.usageCount': '使用次数',
    'skillTable.size': '大小',
    'skillTable.createdAt': '创建',
    'skillTable.updatedAt': '更新',
    'skillTable.pageSize': '每页',
    'skillTable.page': '页',
    'skillTable.previous': '上一页',
    'skillTable.next': '下一页',
    'skillTable.open': '打开',
  },
  en: {
    'app.subtitle': 'Local AI engineering console for project knowledge, rules, gates, MCP, telemetry, and Dagger health.',
    'theme.dark': 'Dark',
    'theme.light': 'Light',
    'lang.zh': '中文',
    'lang.en': 'English',
    'action.refresh': 'Refresh',
    'summary.projects': 'Projects',
    'summary.clean': 'Healthy',
    'summary.changed': 'Changed files',
    'summary.warnings': 'Warnings',
    'summary.gatesPassed': 'Gates passed',
    'summary.lastScan': 'Last scan',
    'workspace.search': 'Filter projects, paths, or descriptions',
    'workspace.visible': 'Visible',
    'filter.all': 'All',
    'filter.ok': 'Healthy',
    'filter.busy': 'Changed',
    'filter.warn': 'Attention',
    'filter.none': 'No projects match the current filters.',
    'project.focus': 'Focus',
    'side.context': 'Current context',
    'side.knowledge': 'Knowledge',
    'side.noSelection': 'Select a project to keep knowledge search and command output in sync.',
    'projectMenu.title': 'Project menu',
    'projectMenu.add': 'Add project',
    'projectDetail.overview': 'Project details',
    'projectDetail.health': 'Health overview',
    'markdown.preview': 'Preview',
    'projectTab.knowledge': 'Knowledge',
    'projectTab.details': 'Project',
    'status.ok': 'Healthy',
    'status.busy': 'Changed',
    'status.warn': 'Attention',
    'status.noDescription': 'No description provided.',
    'git.notRepo': 'not a git repo',
    'git.noHead': 'no HEAD',
    'git.changed': 'changed',
    'git.staged': 'staged',
    'git.conflicted': 'conflicted',
    'git.ahead': 'ahead',
    'git.behind': 'behind',
    'knowledge.title': 'Knowledge revision',
    'knowledge.noCommit': 'untracked',
    'knowledge.noCommittedChange': 'No committed AI knowledge changes found.',
    'knowledge.dirty': 'dirty',
    'knowledge.assets': 'Knowledge assets',
    'asset.load': 'LOAD',
    'asset.skills': 'Skills',
    'asset.agents': 'AGENTS',
    'asset.closeout': 'Closeout',
    'asset.ok': 'ok',
    'asset.missing': 'missing',
    'capabilities.title': 'Open Workflow',
    'capabilities.mcpNone': 'not declared',
    'capabilities.server': 'server',
    'capabilities.servers': 'servers',
    'capabilities.telemetryDisabled': 'disabled',
    'capabilities.daggerEnabled': 'enabled',
    'capabilities.daggerDetected': 'detected',
    'capabilities.daggerMissing': 'not detected',
    'details.title': 'Project details',
    'details.root': 'Root',
    'details.manifest': 'Manifest',
    'details.watch': 'Watch paths',
    'details.links': 'Links',
    'details.updated': 'Updated',
    'gates.title': 'Gates',
    'gates.none': 'No gates declared.',
    'commands.title': 'Commands',
    'commands.dangerous': 'dangerous',
    'agentPrompt.copied': 'Copied',
    'agentPrompt.copyFailed': 'Copy failed',
    'run.notRun': 'not run',
    'run.pass': 'pass',
    'run.timeout': 'timeout',
    'run.exit': 'exit',
    'confirm.dangerous': 'Run dangerous command',
    'empty.projects': 'No projects found. Run aikc from a project directory, set AIKC_WORKSPACE/AIKC_PROJECTS, or create config/projects.json.',
    'knowledgeSearch.title': 'Knowledge search',
    'knowledgeSearch.project': 'Project',
    'knowledgeSearch.query': 'Query',
    'knowledgeSearch.placeholder': 'Search LOAD, skills, AGENTS, closeout docs...',
    'knowledgeSearch.run': 'Search',
    'knowledgeSearch.results': 'results',
    'knowledgeSearch.files': 'files',
    'knowledgeSearch.truncated': 'results truncated',
    'knowledgeSearch.noResults': 'No matches found.',
    'knowledgeSearch.preview': 'Preview',
    'knowledgeSearch.pick': 'Select a search result to preview a file.',
    'knowledgeSearch.size': 'size',
    'knowledgeSearch.updated': 'updated',
    'knowledgeSearch.previewTruncated': 'preview truncated',
    'knowledgeList.title': 'Knowledge list',
    'knowledgeList.sort': 'Sort',
    'knowledgeList.references': 'References',
    'knowledgeList.updatedAt': 'Updated',
    'knowledgeList.createdAt': 'Created',
    'knowledgeList.empty': 'No previewable knowledge files.',
    'knowledgeList.refs': 'refs',
    'knowledgeView.all': 'All knowledge',
    'knowledgeView.skills': 'Skills',
    'skillList.title': 'Skill list',
    'skillList.empty': 'No previewable skill files.',
    'skillTable.filter': 'Filter skills',
    'skillTable.name': 'Name',
    'skillTable.path': 'Path',
    'skillTable.usageCount': 'Uses',
    'skillTable.size': 'Size',
    'skillTable.createdAt': 'Created',
    'skillTable.updatedAt': 'Updated',
    'skillTable.pageSize': 'Per page',
    'skillTable.page': 'Page',
    'skillTable.previous': 'Previous',
    'skillTable.next': 'Next',
    'skillTable.open': 'Open',
  },
};

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'zh';
  const stored = window.localStorage.getItem('aikc.language');
  if (stored === 'zh' || stored === 'en') return stored;
  return window.navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem('aikc.theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function readUrlProjectFilter(): ProjectFilter {
  if (typeof window === 'undefined') return 'all';
  const value = new URLSearchParams(window.location.search).get('filter');
  return value === 'ok' || value === 'busy' || value === 'warn' ? value : 'all';
}

function readUrlParam(name: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(name) ?? '';
}

function statusTone(project: ProjectSummary): Tone {
  if (project.errors.length > 0) return 'warn';
  if (project.git.conflicted > 0) return 'warn';
  if (!project.knowledge.load.exists || !project.knowledge.skills.exists || !project.knowledge.agentsFile.exists) return 'warn';
  if (project.git.changed > 0) return 'busy';
  return 'ok';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${String(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string | null, language: Language): string {
  if (!value) return i18n[language]['knowledge.noCommittedChange'];
  return new Date(value).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US');
}

function shortPath(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts.length > 3 ? `.../${parts.slice(-3).join('/')}` : normalized;
}

function normalizeKnowledgePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

function fileIconForPath(pathValue: string): typeof File {
  const extension = pathValue.split('.').pop()?.toLowerCase();
  if (extension === 'md' || extension === 'txt') return FileText;
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml', 'cjs', 'mjs'].includes(extension ?? '')) return FileCode;
  return File;
}

function MarkdownPreview(props: { content: string; knownPaths: Set<string>; path: string; onOpenPath: (path: string) => void }) {
  return (
    <div className="markdown-preview" data-path={props.path}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const target = href ? normalizeKnowledgePath(href) : '';
            const canOpen = target.length > 0 && props.knownPaths.has(target);
            return (
              <a
                href={href}
                onClick={event => {
                  if (!canOpen) return;
                  event.preventDefault();
                  props.onOpenPath(target);
                }}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {props.content}
      </ReactMarkdown>
    </div>
  );
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

function assetStatus(asset: FileProbe | null, label: string, t: (key: I18nKey) => string) {
  const exists = asset?.exists ?? false;
  return (
    <span className={exists ? 'asset-status ok' : 'asset-status warn'} title={asset?.path ?? label}>
      {exists ? <FileCheck2 size={14} /> : <AlertTriangle size={14} />}
      {label}: {exists ? t('asset.ok') : t('asset.missing')}
    </span>
  );
}

function basename(value: string): string {
  const normalized = normalizeKnowledgePath(value);
  return normalized.split('/').filter(Boolean).pop() ?? normalized;
}

function skillDisplayName(pathValue: string): string {
  const normalized = normalizeKnowledgePath(pathValue);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.at(-1)?.toLowerCase() === 'skill.md' && parts.length >= 2) return parts.at(-2) ?? parts.at(-1) ?? normalized;
  return parts.at(-1) ?? normalized;
}

function compareSkillItems(left: KnowledgeListResponse['items'][number], right: KnowledgeListResponse['items'][number], sort: SkillTableSort): number {
  if (sort === 'name') return skillDisplayName(left.path).localeCompare(skillDisplayName(right.path));
  if (sort === 'path') return left.path.localeCompare(right.path);
  if (sort === 'references') return left.references - right.references;
  if (sort === 'size') return left.size - right.size;
  if (sort === 'createdAt') return left.createdAt.localeCompare(right.createdAt);
  return left.updatedAt.localeCompare(right.updatedAt);
}

function breadcrumbParts(value: string): string[] {
  const normalized = normalizeKnowledgePath(value);
  const parts = normalized.split('/').filter(Boolean);
  return parts.slice(0, -1);
}

function gateBadge(gate: GateStatus, t: (key: I18nKey) => string): string {
  if (!gate.lastRun) return t('run.notRun');
  if (gate.lastRun.exitCode === 0) return `${t('run.pass')} ${formatDuration(gate.lastRun.durationMs)}`;
  if (gate.lastRun.timedOut) return t('run.timeout');
  return `${t('run.exit')} ${String(gate.lastRun.exitCode ?? 'unknown')}`;
}

function agentKnowledgeInitPrompt(): string {
  return [
    'In this target project directory, initialize or upgrade the AI Knowledge Center workflow by first actively trying to update the global CLI with `npm install -g ai-knowledge-center@latest`,',
    'if that fails because of permission or locked files run `aikc stop` and retry `npm install -g ai-knowledge-center@latest` once,',
    'if it still fails report the failure and give the user the manual retry commands `aikc stop`, `npm install -g ai-knowledge-center@latest`, and `aikc`,',
    'then run `aikc upgrade --project . --write --ai` or `npx -y ai-knowledge-center@latest upgrade --project . --write --ai` if the global `aikc` command is unavailable,',
    'read `ai-knowledge/LOAD.md`, `ai-knowledge/core/LOAD.md`, and `ai-knowledge/ai/LOAD.md` when present,',
    'read `.aikc/upgrade/AI_UPGRADE_PROMPT.md` if it exists,',
    'semantically merge any `*.aikc-upgrade.md` candidates without overwriting human docs, config, package scripts, existing AI workflows, MCP settings, integrations, or uncommitted work,',
    'keep AIKC-maintained workflow in `ai-knowledge/core`,',
    'keep AI workflow scripts in `ai-knowledge/scripts` with human usage notes in `ai-knowledge/scripts/README.md` instead of polluting the host `package.json`,',
    'keep project-specific reusable knowledge in `ai-knowledge/skills` or project references,',
    'ensure `ai-workflow.yaml` keeps repo-scoped MCP defaults including `aikc mcp --project .` and does not broaden filesystem MCP scope without explicit user approval,',
    'treat `integrations` such as Context7 docs, repository-docs lookup, semantic code search, Playwright QA, and GitHub MCP as optional declarations unless the task explicitly needs network, browser, GitHub, semantic indexing, or broader filesystem access,',
    'follow `ai-knowledge/core/script-automation-policy.md`, `ai-knowledge/core/token-efficiency.md`, `ai-knowledge/core/open-source-token-tools.md`, `ai-knowledge/core/project-capabilities.md`, `ai-knowledge/core/open-source-usage.md`, `ai-knowledge/core/code-review-policy.md`, and `ai-knowledge/core/human-friendly-task-summary.md`,',
    'run `node ai-knowledge/scripts/doctor.cjs --json`, `node ai-knowledge/scripts/eval-workflow.cjs`, `node ai-knowledge/scripts/code-review.cjs`, `node ai-knowledge/scripts/knowledge-check.cjs`, and all applicable gates until they pass,',
    'and make the final reply include changed files, global CLI update result, code review result, validation, remaining risk, knowledge-capture decision, and reusable automation/token-efficiency decision when applicable.',
  ].join(' ');
}

function createKnowledgeTree(items: KnowledgeListResponse['items']): KnowledgeTreeNode {
  const root: KnowledgeTreeNode = { name: '', path: '', children: new Map(), item: null };
  for (const item of items) {
    const parts = item.path.split('/').filter(Boolean);
    let current = root;
    parts.forEach((part, index) => {
      const nodePath = parts.slice(0, index + 1).join('/');
      const existing = current.children.get(part);
      const next = existing ?? { name: part, path: nodePath, children: new Map<string, KnowledgeTreeNode>(), item: null };
      if (!existing) current.children.set(part, next);
      if (index === parts.length - 1) next.item = item;
      current = next;
    });
  }
  return root;
}

function sortKnowledgeTree(nodes: Iterable<KnowledgeTreeNode>): KnowledgeTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.item && !b.item) return 1;
    if (!a.item && b.item) return -1;
    return a.name.localeCompare(b.name);
  });
}

function countKnowledgeFiles(node: KnowledgeTreeNode): number {
  let count = node.item ? 1 : 0;
  for (const child of node.children.values()) {
    count += countKnowledgeFiles(child);
  }
  return count;
}

function KnowledgeTree(props: {
  node: KnowledgeTreeNode;
  activePath: string | null;
  pendingPath: string | null;
  language: Language;
  t: (key: I18nKey) => string;
  onPick: (item: KnowledgeListResponse['items'][number]) => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <ul className="knowledge-tree">
      {sortKnowledgeTree(props.node.children.values()).map(child =>
        child.item ? (
          <li key={child.path}>
            <motion.button
              {...(reduceMotion ? {} : { whileTap: { scale: 0.992 } })}
              className={[
                'knowledge-tree-file',
                props.activePath === child.item.path || props.pendingPath === child.item.path ? 'active' : '',
                props.pendingPath === child.item.path ? 'loading' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-knowledge-path={child.item.path}
              onClick={() => {
                if (child.item) props.onPick(child.item);
              }}
              title={child.item.path}
            >
              {(() => {
                const FileIcon = fileIconForPath(child.item.path);
                return <FileIcon size={14} />;
              })()}
              <span>{child.name}</span>
              <small>
                {child.item.references} {props.t('knowledgeList.refs')} · {new Date(child.item.updatedAt).toLocaleDateString(props.language === 'zh' ? 'zh-CN' : 'en-US')}
              </small>
            </motion.button>
          </li>
        ) : (
          <KnowledgeTreeFolder
            activePath={props.activePath}
            key={child.path}
            language={props.language}
            node={child}
            pendingPath={props.pendingPath}
            t={props.t}
            onPick={props.onPick}
          />
        ),
      )}
    </ul>
  );
}

function KnowledgeTreeFolder(props: {
  node: KnowledgeTreeNode;
  activePath: string | null;
  pendingPath: string | null;
  language: Language;
  t: (key: I18nKey) => string;
  onPick: (item: KnowledgeListResponse['items'][number]) => void;
}) {
  const activeInside = Boolean(
    (props.activePath && (props.activePath === props.node.path || props.activePath.startsWith(`${props.node.path}/`))) ||
      (props.pendingPath && (props.pendingPath === props.node.path || props.pendingPath.startsWith(`${props.node.path}/`))),
  );
  const [open, setOpen] = useState(activeInside);

  useEffect(() => {
    if (activeInside) setOpen(true);
  }, [activeInside]);

  return (
    <li>
      <details
        open={open}
        onToggle={event => {
          setOpen(event.currentTarget.open);
        }}
      >
        <summary>
          <ChevronRight className="tree-chevron" size={12} />
          {open ? <FolderOpen size={14} /> : <Folder size={14} />}
          <span>{props.node.name}</span>
          <small>{countKnowledgeFiles(props.node)}</small>
        </summary>
        {open && (
          <KnowledgeTree
            activePath={props.activePath}
            language={props.language}
            node={props.node}
            pendingPath={props.pendingPath}
            t={props.t}
            onPick={props.onPick}
          />
        )}
      </details>
    </li>
  );
}

function KnowledgeSearchPanel(props: {
  language: Language;
  selectedProjectId: string;
  projects: ProjectSummary[];
  t: (key: I18nKey) => string;
}) {
  const reduceMotion = useReducedMotion();
  const [projectId, setProjectId] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<KnowledgeListSort>('references');
  const [view, setView] = useState<KnowledgeView>('all');
  const [skillFilter, setSkillFilter] = useState('');
  const [skillSort, setSkillSort] = useState<SkillTableSort>('references');
  const [skillDirection, setSkillDirection] = useState<SortDirection>('desc');
  const [skillPage, setSkillPage] = useState(1);
  const [skillPageSize, setSkillPageSize] = useState(20);
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeListResponse | null>(null);
  const [searchResult, setSearchResult] = useState<KnowledgeSearchResponse | null>(null);
  const [preview, setPreview] = useState<KnowledgePreview | null>(null);
  const [pendingPreviewPath, setPendingPreviewPath] = useState<string | null>(null);
  const [selectedKnowledgePath, setSelectedKnowledgePath] = useState(() => readUrlParam('doc'));

  useEffect(() => {
    if (props.selectedProjectId && props.selectedProjectId !== projectId) {
      setProjectId(props.selectedProjectId);
      setSearchResult(null);
      setPreview(null);
      setPendingPreviewPath(null);
      setKnowledgeList(null);
      return;
    }
    if (!projectId && props.projects[0]) setProjectId(props.projects[0].id);
  }, [projectId, props.projects, props.selectedProjectId]);

  const searchMutation = useMutation({
    mutationFn: async () => searchKnowledge(projectId, query),
    onSuccess: result => {
      setSearchResult(result);
      setPreview(null);
      toast.success(`${String(result.results.length)} ${props.t('knowledgeSearch.results')}`, {
        description: `${String(result.searchedFiles)} ${props.t('knowledgeSearch.files')}`,
      });
    },
    onError: error => {
      toast.error(props.t('knowledgeSearch.noResults'), {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });
  const previewMutation = useMutation({
    mutationFn: async (target: { projectId: string; path: string }) => previewKnowledge(target.projectId, target.path),
    onSuccess: result => {
      setPreview(result);
      setPendingPreviewPath(null);
    },
    onError: () => {
      setPendingPreviewPath(null);
    },
  });
  const listMutation = useMutation({
    mutationFn: async () => listKnowledge(projectId, sort),
    onSuccess: result => {
      setKnowledgeList(result);
      setPreview(null);
      const selectedItem = result.items.find(item => item.path === selectedKnowledgePath) ?? result.items[0];
      if (selectedItem) {
        setPendingPreviewPath(selectedItem.path);
        previewMutation.mutate({ projectId: selectedItem.projectId, path: selectedItem.path });
      }
    },
  });

  const canSearch = projectId.length > 0 && query.trim().length > 0 && !searchMutation.isPending;
  const selectedProject = props.projects.find(project => project.id === projectId) ?? null;
  const skillsRoot = normalizeKnowledgePath(selectedProject?.knowledge.skills.path ?? 'ai-knowledge/skills');
  const skillItems = useMemo(
    () => (knowledgeList?.items ?? []).filter(item => item.path === skillsRoot || item.path.startsWith(`${skillsRoot}/`)),
    [knowledgeList?.items, skillsRoot],
  );
  const filteredSkillItems = useMemo(() => {
    const needle = skillFilter.trim().toLowerCase();
    const filtered = needle
      ? skillItems.filter(item => `${skillDisplayName(item.path)} ${item.path}`.toLowerCase().includes(needle))
      : skillItems;
    return [...filtered].sort((left, right) => {
      const result = compareSkillItems(left, right, skillSort);
      return skillDirection === 'asc' ? result : -result;
    });
  }, [skillDirection, skillFilter, skillItems, skillSort]);
  const skillPageCount = Math.max(1, Math.ceil(filteredSkillItems.length / skillPageSize));
  const normalizedSkillPage = Math.min(skillPage, skillPageCount);
  const paginatedSkillItems = filteredSkillItems.slice((normalizedSkillPage - 1) * skillPageSize, normalizedSkillPage * skillPageSize);
  const visibleKnowledgeItems = view === 'skills' ? skillItems : (knowledgeList?.items ?? []);
  const knowledgeTree = useMemo(() => createKnowledgeTree(visibleKnowledgeItems), [visibleKnowledgeItems]);
  const knowledgeItemsByPath = useMemo(() => new Map((knowledgeList?.items ?? []).map(item => [item.path, item])), [knowledgeList?.items]);
  const knownKnowledgePaths = useMemo(() => new Set(knowledgeItemsByPath.keys()), [knowledgeItemsByPath]);
  const openKnowledgePath = (pathValue: string) => {
    const item = knowledgeItemsByPath.get(pathValue);
    if (item) {
      if (pendingPreviewPath === item.path) return;
      setSelectedKnowledgePath(item.path);
      if (preview?.path === item.path) return;
      setPendingPreviewPath(item.path);
      previewMutation.mutate({ projectId: item.projectId, path: item.path });
    }
  };

  useEffect(() => {
    if (projectId) listMutation.mutate();
  }, [projectId, sort]);

  useEffect(() => {
    setSkillPage(1);
  }, [projectId, skillDirection, skillFilter, skillPageSize, skillSort, view]);

  const toggleSkillSort = (nextSort: SkillTableSort) => {
    if (skillSort === nextSort) {
      setSkillDirection(current => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSkillSort(nextSort);
    setSkillDirection(nextSort === 'name' || nextSort === 'path' ? 'asc' : 'desc');
  };

  useEffect(() => {
    const targetPath = pendingPreviewPath ?? preview?.path;
    if (!targetPath) return;
    window.requestAnimationFrame(() => {
      document.querySelector(`[data-knowledge-path="${CSS.escape(targetPath)}"]`)?.scrollIntoView({ block: 'nearest' });
    });
  }, [pendingPreviewPath, preview?.path]);

  useEffect(() => {
    if (!preview?.path) return;
    const params = new URLSearchParams(window.location.search);
    params.set('doc', preview.path);
    const next = `${window.location.pathname}?${params.toString()}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, '', next);
    }
  }, [preview?.path]);

  return (
    <motion.section className="knowledge-search-panel" {...(reduceMotion ? {} : fadeIn)}>
      <div className="knowledge-toolbar">
      <div className="panel-heading">
        <div>
          <h2>{props.t('knowledgeSearch.title')}</h2>
          <span>
            {props.projects.find(project => project.id === projectId)?.name ?? props.t('knowledgeSearch.project')}
            {searchResult
              ? ` · ${String(searchResult.results.length)} ${props.t('knowledgeSearch.results')} · ${String(searchResult.searchedFiles)} ${props.t('knowledgeSearch.files')}`
              : ''}
            {searchResult?.truncated ? ` · ${props.t('knowledgeSearch.truncated')}` : ''}
          </span>
        </div>
      </div>

      <div className="search-controls">
        <label>
          <span>{props.t('knowledgeSearch.query')}</span>
          <input
            value={query}
            onChange={event => {
              setQuery(event.target.value);
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' && canSearch) searchMutation.mutate();
            }}
            placeholder={props.t('knowledgeSearch.placeholder')}
          />
        </label>
        <label>
          <span>{props.t('knowledgeList.sort')}</span>
          <select
            value={sort}
            onChange={event => {
              setSort(event.target.value as KnowledgeListSort);
            }}
          >
            <option value="references">{props.t('knowledgeList.references')}</option>
            <option value="updatedAt">{props.t('knowledgeList.updatedAt')}</option>
            <option value="createdAt">{props.t('knowledgeList.createdAt')}</option>
          </select>
        </label>
        <button
          className="search-button"
          disabled={!canSearch}
          onClick={() => {
            searchMutation.mutate();
          }}
        >
          {searchMutation.isPending ? <Loader2 className="spin" size={16} /> : <Search size={16} />}
          {props.t('knowledgeSearch.run')}
        </button>
      </div>

      </div>

      {searchMutation.error && <div className="inline-error">{searchMutation.error.message}</div>}
      {previewMutation.error && <div className="inline-error">{previewMutation.error.message}</div>}

      <div className={view === 'skills' ? 'knowledge-workspace skills-mode' : 'knowledge-workspace'}>
        <div className="knowledge-browser">
          <div className="knowledge-view-toggle" aria-label={props.t('knowledgeList.title')}>
            {(['all', 'skills'] as KnowledgeView[]).map(nextView => (
              <button
                className={view === nextView ? 'active' : ''}
                key={nextView}
                onClick={() => {
                  setView(nextView);
                }}
              >
                {props.t(nextView === 'all' ? 'knowledgeView.all' : 'knowledgeView.skills')}
                <span>{nextView === 'skills' ? skillItems.length : (knowledgeList?.items.length ?? 0)}</span>
              </button>
            ))}
          </div>
          <div className="knowledge-list">
            <div className="subpanel-heading">
              <strong>{props.t(view === 'skills' ? 'skillList.title' : 'knowledgeList.title')}</strong>
              <span>
                {knowledgeList ? String(view === 'skills' ? filteredSkillItems.length : visibleKnowledgeItems.length) : listMutation.isPending ? '...' : '0'}
                {knowledgeList?.truncated ? ` · ${props.t('knowledgeSearch.truncated')}` : ''}
              </span>
            </div>
            {knowledgeList && visibleKnowledgeItems.length > 0 && view === 'all' && (
              <KnowledgeTree
                activePath={preview?.path ?? null}
                pendingPath={pendingPreviewPath}
                language={props.language}
                node={knowledgeTree}
                t={props.t}
                onPick={item => {
                  openKnowledgePath(item.path);
                }}
              />
            )}
            {knowledgeList && view === 'skills' && skillItems.length > 0 && (
              <div className="skill-table-panel">
                <div className="skill-table-toolbar">
                  <label>
                    <span>{props.t('skillTable.filter')}</span>
                    <input
                      value={skillFilter}
                      onChange={event => {
                        setSkillFilter(event.target.value);
                      }}
                      placeholder={props.t('skillTable.filter')}
                    />
                  </label>
                  <label>
                    <span>{props.t('knowledgeList.sort')}</span>
                    <select
                      value={`${skillSort}:${skillDirection}`}
                      onChange={event => {
                        const [nextSort, nextDirection] = event.target.value.split(':') as [SkillTableSort, SortDirection];
                        setSkillSort(nextSort);
                        setSkillDirection(nextDirection);
                      }}
                    >
                      <option value="name:asc">{props.t('skillTable.name')} ↑</option>
                      <option value="name:desc">{props.t('skillTable.name')} ↓</option>
                      <option value="references:desc">{props.t('skillTable.usageCount')} ↓</option>
                      <option value="references:asc">{props.t('skillTable.usageCount')} ↑</option>
                      <option value="updatedAt:desc">{props.t('skillTable.updatedAt')} ↓</option>
                      <option value="updatedAt:asc">{props.t('skillTable.updatedAt')} ↑</option>
                      <option value="createdAt:desc">{props.t('skillTable.createdAt')} ↓</option>
                      <option value="createdAt:asc">{props.t('skillTable.createdAt')} ↑</option>
                      <option value="size:desc">{props.t('skillTable.size')} ↓</option>
                      <option value="size:asc">{props.t('skillTable.size')} ↑</option>
                      <option value="path:asc">{props.t('skillTable.path')} ↑</option>
                    </select>
                  </label>
                  <label>
                    <span>{props.t('skillTable.pageSize')}</span>
                    <select
                      value={skillPageSize}
                      onChange={event => {
                        setSkillPageSize(Number(event.target.value));
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                </div>
                <div className="skill-table-scroll">
                  <table className="skill-table">
                    <thead>
                      <tr>
                        {[
                          ['name', props.t('skillTable.name')],
                          ['path', props.t('skillTable.path')],
                          ['references', props.t('skillTable.usageCount')],
                          ['size', props.t('skillTable.size')],
                          ['createdAt', props.t('skillTable.createdAt')],
                          ['updatedAt', props.t('skillTable.updatedAt')],
                        ].map(([column, label]) => (
                          <th key={column}>
                            <button
                              onClick={() => {
                                toggleSkillSort(column as SkillTableSort);
                              }}
                            >
                              {label}
                              {skillSort === column ? (
                                skillDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                              ) : (
                                <ArrowUpDown size={12} />
                              )}
                            </button>
                          </th>
                        ))}
                        <th>{props.t('skillTable.open')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSkillItems.map(item => (
                        <tr className={preview?.path === item.path || pendingPreviewPath === item.path ? 'active' : ''} key={item.path}>
                          <td>
                            <strong>{skillDisplayName(item.path)}</strong>
                          </td>
                          <td title={item.path}>{item.path}</td>
                          <td>{item.references}</td>
                          <td>{formatFileSize(item.size)}</td>
                          <td>{new Date(item.createdAt).toLocaleDateString(props.language === 'zh' ? 'zh-CN' : 'en-US')}</td>
                          <td>{new Date(item.updatedAt).toLocaleDateString(props.language === 'zh' ? 'zh-CN' : 'en-US')}</td>
                          <td>
                            <button
                              className="table-open-button"
                              aria-label={`${props.t('skillTable.open')} ${skillDisplayName(item.path)}`}
                              onClick={() => {
                                openKnowledgePath(item.path);
                              }}
                            >
                              <ExternalLink size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="skill-table-pagination">
                  <span>
                    {props.t('skillTable.page')} {normalizedSkillPage}/{skillPageCount} · {filteredSkillItems.length}
                  </span>
                  <div>
                    <button
                      disabled={normalizedSkillPage <= 1}
                      onClick={() => {
                        setSkillPage(page => Math.max(1, page - 1));
                      }}
                    >
                      <ChevronLeft size={13} />
                      {props.t('skillTable.previous')}
                    </button>
                    <button
                      disabled={normalizedSkillPage >= skillPageCount}
                      onClick={() => {
                        setSkillPage(page => Math.min(skillPageCount, page + 1));
                      }}
                    >
                      {props.t('skillTable.next')}
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}
            {knowledgeList && ((view === 'skills' && skillItems.length > 0 && filteredSkillItems.length === 0) || visibleKnowledgeItems.length === 0) && (
              <div className="search-empty">{props.t(view === 'skills' ? 'skillList.empty' : 'knowledgeList.empty')}</div>
            )}
          </div>

          <AnimatePresence initial={false}>
            {searchResult && (
              <motion.div className="search-results" key="search-results" {...fadeIn}>
                {searchResult.results.map(result => (
                  <motion.button
                    {...(reduceMotion ? {} : { whileTap: { scale: 0.992 } })}
                    className={preview?.path === result.path || pendingPreviewPath === result.path ? 'search-result active' : 'search-result'}
                    key={`${result.path}:${String(result.line)}:${result.excerpt}`}
                    onClick={() => {
                      openKnowledgePath(result.path);
                    }}
                  >
                    <strong>{result.path}</strong>
                    <span>
                      {result.projectName} · L{result.line}
                    </span>
                    <p>{result.excerpt}</p>
                  </motion.button>
                ))}
                {searchResult.results.length === 0 && <div className="search-empty">{props.t('knowledgeSearch.noResults')}</div>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={pendingPreviewPath ? 'preview-panel doc-preview-shell loading' : 'preview-panel doc-preview-shell'}>
          <AnimatePresence mode="wait" initial={false}>
            {preview ? (
              <motion.div className="preview-document" key={preview.path} {...fadeIn}>
                <div className="preview-header">
                  <div>
                    <div className="document-breadcrumb" title={preview.path}>
                      {(breadcrumbParts(preview.path).length > 0 ? breadcrumbParts(preview.path) : [knowledgeList?.projectName ?? preview.projectName]).map(part => (
                        <span key={`${preview.path}:${part}`}>{part}</span>
                      ))}
                    </div>
                    <div className="document-title-row">
                      {(() => {
                        const PreviewIcon = fileIconForPath(preview.path);
                        return <PreviewIcon size={21} />;
                      })()}
                      <h2>{basename(preview.path)}</h2>
                    </div>
                    <div className="document-properties">
                      <span><b>project:</b> {preview.projectName}</span>
                      <span><b>size:</b> {formatFileSize(preview.size)}</span>
                      <span>
                        <b>updated:</b> {new Date(preview.updatedAt).toLocaleString(props.language === 'zh' ? 'zh-CN' : 'en-US')}
                      </span>
                      {preview.truncated && <span>{props.t('knowledgeSearch.previewTruncated')}</span>}
                    </div>
                  </div>
                </div>
                <MarkdownPreview content={preview.content} knownPaths={knownKnowledgePaths} path={preview.path} onOpenPath={openKnowledgePath} />
              </motion.div>
            ) : previewMutation.isPending ? (
              <motion.div className="preview-empty" key="pending" {...fadeIn}>
                <Loader2 className="spin" size={18} />
                <span>{props.t('knowledgeSearch.preview')}</span>
              </motion.div>
            ) : (
              <motion.div className="preview-empty" key="empty" {...fadeIn}>
                <BookOpen size={18} />
                <span>{props.t('knowledgeSearch.pick')}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.section>
  );
}

function CapabilityPanel(props: { project: ProjectSummary; t: (key: I18nKey) => string }) {
  const mcpConfigured = props.project.mcp.filter(server => server.configured).length;
  const integrationCount = props.project.integrations.length;
  const daggerReady = props.project.dagger.enabled || props.project.dagger.detected;
  const mcpLabel =
    mcpConfigured > 0
      ? `${String(mcpConfigured)} ${props.t(mcpConfigured === 1 ? 'capabilities.server' : 'capabilities.servers')}`
      : props.t('capabilities.mcpNone');
  const daggerLabel = props.project.dagger.detected
    ? `${props.t('capabilities.daggerDetected')} · ${shortPath(props.project.dagger.module.path)}`
    : props.project.dagger.enabled
      ? props.t('capabilities.daggerEnabled')
      : props.t('capabilities.daggerMissing');

  return (
    <section className="capability-panel">
      <h3>{props.t('capabilities.title')}</h3>
      <div className="capability-grid">
        <div className={props.project.knowledge.agentsFile.exists ? 'capability-item ok' : 'capability-item warn'}>
          <Bot size={15} />
          <span>AGENTS.md</span>
          <small>{props.project.knowledge.agentsFile.exists ? props.project.knowledge.agentsFile.path : props.t('asset.missing')}</small>
        </div>
        <div className={mcpConfigured > 0 ? 'capability-item ok' : 'capability-item quiet'}>
          <Cable size={15} />
          <span>MCP</span>
          <small>{mcpLabel}</small>
        </div>
        <div className={props.project.telemetry.enabled ? 'capability-item ok' : 'capability-item quiet'}>
          <Activity size={15} />
          <span>Telemetry</span>
          <small>
            {props.project.telemetry.enabled
              ? `${props.project.telemetry.exporter} · ${props.project.telemetry.serviceName}`
              : props.t('capabilities.telemetryDisabled')}
          </small>
        </div>
        <div className={integrationCount > 0 ? 'capability-item ok' : 'capability-item quiet'}>
          <Plus size={15} />
          <span>Integrations</span>
          <small>{integrationCount > 0 ? `${String(integrationCount)} optional` : props.t('capabilities.mcpNone')}</small>
        </div>
        <div className={daggerReady ? 'capability-item ok' : 'capability-item quiet'}>
          <Hammer size={15} />
          <span>Dagger</span>
          <small>{daggerLabel}</small>
        </div>
      </div>
      {props.project.mcp.length > 0 && (
        <div className="mcp-list">
          {props.project.mcp.map(server => (
            <span className={server.configured ? 'exists' : 'missing'} key={server.id} title={server.command ?? server.url ?? server.description ?? server.id}>
              {server.label}
            </span>
          ))}
        </div>
      )}
      {props.project.integrations.length > 0 && (
        <div className="mcp-list">
          {props.project.integrations.map(integration => (
            <span className={integration.mode !== 'disabled' ? 'exists' : 'missing'} key={integration.id} title={integration.description ?? integration.provider}>
              {integration.label ?? integration.id}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function DetailPanel(props: { language: Language; project: ProjectSummary; t: (key: I18nKey) => string }) {
  const missingWatch = props.project.watch.filter(item => !item.exists).length;
  return (
    <section className="detail-panel">
      <h3>{props.t('details.title')}</h3>
      <dl>
        <div>
          <dt>{props.t('details.root')}</dt>
          <dd title={props.project.root}>{shortPath(props.project.root)}</dd>
        </div>
        <div>
          <dt>{props.t('details.manifest')}</dt>
          <dd title={props.project.manifestPath}>{shortPath(props.project.manifestPath)}</dd>
        </div>
        <div>
          <dt>{props.t('details.watch')}</dt>
          <dd>
            {String(props.project.watch.length)} / {String(missingWatch)} {props.t('asset.missing')}
          </dd>
        </div>
        <div>
          <dt>{props.t('details.updated')}</dt>
          <dd>{new Date(props.project.updatedAt).toLocaleTimeString(props.language === 'zh' ? 'zh-CN' : 'en-US')}</dd>
        </div>
      </dl>
    </section>
  );
}

function ProjectMenu(props: {
  projects: ProjectSummary[];
  selectedProjectId: string;
  visibleCount: number;
  totalCount: number;
  query: string;
  filter: ProjectFilter;
  filterCounts: Record<ProjectFilter, number>;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: ProjectFilter) => void;
  onSelect: (projectId: string) => void;
  t: (key: I18nKey) => string;
}) {
  const reduceMotion = useReducedMotion();
  const agentPrompt = useMemo(() => agentKnowledgeInitPrompt(), []);
  return (
    <motion.aside className="project-menu-panel" layout={reduceMotion ? false : true} transition={spring}>
      <div className="project-sidebar-header">
        <div className="menu-heading">
          <strong>{props.t('projectMenu.title')}</strong>
          <div className="menu-heading-actions">
            <span>
              {props.t('workspace.visible')} {props.visibleCount}/{props.totalCount}
            </span>
            <button
              className="menu-add-button"
              onClick={() => {
                void copyText(agentPrompt)
                  .then(() => {
                    toast.success(props.t('agentPrompt.copied'));
                  })
                  .catch(() => {
                    toast.error(props.t('agentPrompt.copyFailed'));
                  });
              }}
              title={props.t('projectMenu.add')}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        <label className="project-search">
          <Search size={16} />
          <input
            value={props.query}
            onChange={event => {
              props.onQueryChange(event.target.value);
            }}
            placeholder={props.t('workspace.search')}
          />
        </label>
      </div>
      <div className="filter-tabs vertical" aria-label={props.t('workspace.visible')}>
        {(['all', 'ok', 'busy', 'warn'] as ProjectFilter[]).map(filter => (
          <button
            className={props.filter === filter ? 'active' : ''}
            key={filter}
            onClick={() => {
              props.onFilterChange(filter);
            }}
          >
            {props.t(`filter.${filter}`)}
            <span>{props.filterCounts[filter]}</span>
          </button>
        ))}
      </div>
      <motion.div className="project-menu-list" layout={reduceMotion ? false : true}>
        {props.projects.map(project => {
          const tone = statusTone(project);
          return (
            <motion.button
              layout={reduceMotion ? false : 'position'}
              {...(reduceMotion ? {} : { whileHover: { x: 2 }, whileTap: { scale: 0.99 } })}
              className={`project-menu-item ${tone} ${props.selectedProjectId === project.id ? 'active' : ''}`}
              key={project.id}
              onClick={() => {
                props.onSelect(project.id);
              }}
            >
              <span className={`status-dot ${tone}`} />
              <strong>{project.name}</strong>
              <small>{project.git.branch ?? props.t('git.notRepo')}</small>
              <em>{project.git.changed} {props.t('git.changed')}</em>
            </motion.button>
          );
        })}
      </motion.div>
    </motion.aside>
  );
}

function ProjectDetailPanel(props: {
  language: Language;
  project: ProjectSummary;
  t: (key: I18nKey) => string;
}) {
  const tone = statusTone(props.project);
  const gates = props.project.gates;
  const commands = props.project.manifest.commands;
  const statusLabel = props.t(tone === 'ok' ? 'status.ok' : tone === 'busy' ? 'status.busy' : 'status.warn');
  const passedGates = gates.filter(gate => gate.lastRun?.exitCode === 0).length;
  const knowledgeAssets = [
    props.project.knowledge.load,
    props.project.knowledge.skills,
    props.project.knowledge.agentsFile,
    props.project.knowledge.closeoutPrompt,
  ].filter(Boolean);
  const presentKnowledgeAssets = knowledgeAssets.filter(item => item?.exists).length;
  const configuredMcp = props.project.mcp.filter(server => server.configured).length;

  return (
    <article className={`project-detail-panel ${tone}`}>
      <header className="project-hero">
        <div>
          <span className="section-kicker">{props.t('projectDetail.overview')}</span>
          <div className="project-title-row">
            <h2>{props.project.name}</h2>
            <span className={`status-chip ${tone}`}>{statusLabel}</span>
          </div>
          <p>{props.project.description ?? props.t('status.noDescription')}</p>
        </div>
        <div className="project-actions">
          <span className="project-id">{props.project.id}</span>
        </div>
      </header>

      <section className="project-health-grid" aria-label={props.t('projectDetail.health')}>
        <div className="health-card">
          <span>{props.t('git.changed')}</span>
          <strong>{props.project.git.changed}</strong>
          <small>
            {props.project.git.staged} {props.t('git.staged')} / {props.project.git.conflicted} {props.t('git.conflicted')}
          </small>
        </div>
        <div className="health-card">
          <span>{props.t('gates.title')}</span>
          <strong>
            {passedGates}/{gates.length}
          </strong>
          <small>{props.t('summary.gatesPassed')}</small>
        </div>
        <div className="health-card">
          <span>{props.t('knowledge.assets')}</span>
          <strong>
            {presentKnowledgeAssets}/{knowledgeAssets.length}
          </strong>
          <small>{props.project.knowledge.revision.dirty ? props.t('knowledge.dirty') : props.t('asset.ok')}</small>
        </div>
        <div className="health-card">
          <span>MCP</span>
          <strong>
            {configuredMcp}/{props.project.mcp.length}
          </strong>
          <small>{props.project.telemetry.enabled ? 'Telemetry on' : props.t('capabilities.telemetryDisabled')}</small>
        </div>
      </section>

      <div className="project-meta compact">
        <div className="meta-item">
          <GitBranch size={16} />
          <span>{props.project.git.branch ?? props.t('git.notRepo')}</span>
        </div>
        <div className="meta-item">
          <GitCommitHorizontal size={16} />
          <span>{props.project.git.shortHead ?? props.t('git.noHead')}</span>
        </div>
        <div className={props.project.git.changed > 0 ? 'meta-item warn' : 'meta-item'}>
          <FileCheck2 size={16} />
          <span>
            {props.project.git.changed} {props.t('git.changed')}
          </span>
        </div>
        <div className="meta-item">
          <ShieldCheck size={16} />
          <span>
            {props.project.git.staged} {props.t('git.staged')}
          </span>
        </div>
        {props.project.git.conflicted > 0 && (
          <div className="meta-item danger">
            <AlertTriangle size={16} />
            <span>
              {props.project.git.conflicted} {props.t('git.conflicted')}
            </span>
          </div>
        )}
        {(props.project.git.ahead > 0 || props.project.git.behind > 0) && (
          <div className="meta-item">
            <span>
              +{props.project.git.ahead} {props.t('git.ahead')} / -{props.project.git.behind} {props.t('git.behind')}
            </span>
          </div>
        )}
      </div>

      <div className="project-detail-layout">
        <div className="project-info-stack">
          <CapabilityPanel project={props.project} t={props.t} />

          <section className={`knowledge-revision ${props.project.knowledge.revision.dirty ? 'dirty' : ''}`}>
            <div className="knowledge-revision-header">
              <BookOpen size={16} />
              <span>{props.t('knowledge.title')}</span>
              <strong>{props.project.knowledge.revision.shortLatestCommit ?? props.t('knowledge.noCommit')}</strong>
              {props.project.knowledge.revision.dirty && <span className="pill warn">{props.t('knowledge.dirty')}</span>}
            </div>
            <p>{props.project.knowledge.revision.latestSubject ?? props.t('knowledge.noCommittedChange')}</p>
            <small>{formatDate(props.project.knowledge.revision.latestAt, props.language)}</small>
            <div className="asset-list" aria-label={props.t('knowledge.assets')}>
              {assetStatus(props.project.knowledge.load, props.t('asset.load'), props.t)}
              {assetStatus(props.project.knowledge.skills, props.t('asset.skills'), props.t)}
              {assetStatus(props.project.knowledge.agentsFile, props.t('asset.agents'), props.t)}
              {assetStatus(props.project.knowledge.closeoutPrompt, props.t('asset.closeout'), props.t)}
            </div>
            {props.project.knowledge.revision.changedFiles.length > 0 && (
              <div className="knowledge-files">
                {props.project.knowledge.revision.changedFiles.slice(0, 4).map(file => (
                  <span key={file}>{file}</span>
                ))}
              </div>
            )}
          </section>

          <DetailPanel language={props.language} project={props.project} t={props.t} />
        </div>

        <div className="project-action-stack">
          {props.project.errors.length > 0 && (
            <div className="project-errors">
              <AlertTriangle size={16} />
              <div>
                {props.project.errors.map(error => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            </div>
          )}

          <section className="gate-list">
            <h3>{props.t('gates.title')}</h3>
            {gates.length === 0 ? (
              <p className="muted">{props.t('gates.none')}</p>
            ) : (
              gates.map(gate => (
                <div className="gate-status-item" key={gate.id} title={`${gate.command}${gate.lastRun ? `\n${gate.lastRun.residualRisk}` : ''}`}>
                  {gate.lastRun?.exitCode === 0 ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
                  <span>{gate.label}</span>
                  <small>
                    {gate.category} · {gateBadge(gate, props.t)}
                  </small>
                  {gate.lastRun && <small>{formatDate(gate.lastRun.finishedAt, props.language)} · AIKC {gate.lastRun.aikcVersion} · {gate.lastRun.summary}</small>}
                </div>
              ))
            )}
          </section>

          {commands.length > 0 && (
            <section className="gate-list compact">
              <h3>{props.t('commands.title')}</h3>
              {commands.map(command => (
                <div className={`gate-status-item ${command.dangerous ? 'dangerous' : ''}`} key={command.id} title={command.command}>
                  <Hammer size={16} />
                  <span>{command.label}</span>
                  <small>
                    {command.dangerous
                      ? `${props.t('commands.dangerous')} · ${command.description ?? command.command}`
                      : command.description ?? command.script ?? ''}
                  </small>
                </div>
              ))}
            </section>
          )}

          {props.project.watch.length > 0 && (
            <section className="watch-list">
              <h3>{props.t('details.watch')}</h3>
              <div>
                {props.project.watch.map(item => (
                  <span className={item.exists ? 'exists' : 'missing'} key={item.path}>
                    {item.path}
                  </span>
                ))}
              </div>
            </section>
          )}

          {props.project.links.length > 0 && (
            <footer className="project-links">
              {props.project.links.map(link => (
                <a href={link.url} key={link.url} rel="noreferrer" target="_blank">
                  {link.label}
                  <ExternalLink size={13} />
                </a>
              ))}
            </footer>
          )}
        </div>
      </div>
    </article>
  );
}

export function App() {
  const [language, setLanguage] = useState<Language>(() => readStoredLanguage());
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const [selectedProjectId, setSelectedProjectId] = useState(() => readUrlParam('project'));
  const [projectQuery, setProjectQuery] = useState(() => readUrlParam('q'));
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>(() => readUrlProjectFilter());
  const [projectTab, setProjectTab] = useState<ProjectTab>('knowledge');
  const t = useMemo(() => (key: I18nKey) => i18n[language][key], [language]);
  const reduceMotion = useReducedMotion();
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });
  const projects = projectsQuery.data?.projects ?? [];

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    window.localStorage.setItem('aikc.theme', theme);
    window.localStorage.setItem('aikc.language', language);
  }, [language, theme]);

  useEffect(() => {
    const firstProject = projects[0];
    if (!firstProject) return;
    if (!selectedProjectId || !projects.some(project => project.id === selectedProjectId)) {
      setSelectedProjectId(firstProject.id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedProjectId) params.set('project', selectedProjectId);
    if (projectQuery.trim()) params.set('q', projectQuery.trim());
    if (projectFilter !== 'all') params.set('filter', projectFilter);
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, '', next);
    }
  }, [projectFilter, projectQuery, selectedProjectId]);

  const selectedProject = projects.find(project => project.id === selectedProjectId) ?? projects[0] ?? null;
  const visibleProjects = useMemo(() => {
    const needle = projectQuery.trim().toLowerCase();
    return projects.filter(project => {
      const tone = statusTone(project);
      const matchesFilter = projectFilter === 'all' || tone === projectFilter;
      const searchable = [project.name, project.id, project.description ?? '', project.root, project.git.branch ?? ''].join(' ').toLowerCase();
      return matchesFilter && (!needle || searchable.includes(needle));
    });
  }, [projectFilter, projectQuery, projects]);
  const filterCounts = useMemo(
    () => ({
      all: projects.length,
      ok: projects.filter(project => statusTone(project) === 'ok').length,
      busy: projects.filter(project => statusTone(project) === 'busy').length,
      warn: projects.filter(project => statusTone(project) === 'warn').length,
    }),
    [projects],
  );

  return (
    <main className="app-shell">
      <Toaster
        closeButton
        position="top-right"
        richColors={false}
        theme={theme}
        toastOptions={{
          className: 'app-toast',
          duration: 2200,
        }}
      />
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-mark" aria-hidden="true">
            <span />
          </div>
          <div>
            <h1>AI Knowledge Center</h1>
            <p>{t('app.subtitle')}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="header-scan-time">
            <span>{t('summary.lastScan')}:</span>
            <span>{projectsQuery.data?.updatedAt ? new Date(projectsQuery.data.updatedAt).toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US') : '--'}</span>
          </span>
          <button
            className="icon-button"
            onClick={() => {
              setLanguage(current => (current === 'zh' ? 'en' : 'zh'));
            }}
            title={language === 'zh' ? t('lang.en') : t('lang.zh')}
          >
            <Languages size={17} />
            <span>{language === 'zh' ? t('lang.zh') : t('lang.en')}</span>
          </button>
          <button
            className="icon-button"
            onClick={() => {
              setTheme(current => (current === 'dark' ? 'light' : 'dark'));
            }}
            title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
          >
            {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
            <span>{theme === 'dark' ? t('theme.dark') : t('theme.light')}</span>
          </button>
          <button
            className="refresh-button"
            onClick={() => {
              toast.promise(projectsQuery.refetch(), {
                loading: t('action.refresh'),
                success: t('summary.lastScan'),
                error: error => (error instanceof Error ? error.message : String(error)),
              });
            }}
            disabled={projectsQuery.isFetching}
          >
            <RefreshCw className={projectsQuery.isFetching ? 'spin' : ''} size={17} />
            {t('action.refresh')}
          </button>
        </div>
      </header>

      {projectsQuery.error && <div className="fatal-error">{projectsQuery.error.message}</div>}
      {projectsQuery.data?.errors.map(error => <div className="fatal-error" key={error}>{error}</div>)}

      <div className="workspace-grid">
        <ProjectMenu
          filter={projectFilter}
          filterCounts={filterCounts}
          projects={visibleProjects}
          query={projectQuery}
          selectedProjectId={selectedProject?.id ?? ''}
          t={t}
          totalCount={projects.length}
          visibleCount={visibleProjects.length}
          onFilterChange={setProjectFilter}
          onQueryChange={setProjectQuery}
          onSelect={setSelectedProjectId}
        />

        <section className="document-focus">
          <div className="project-tabs">
            <button
              className={projectTab === 'knowledge' ? 'active' : ''}
              onClick={() => {
                setProjectTab('knowledge');
              }}
            >
              <BookOpen size={15} />
              {t('projectTab.knowledge')}
            </button>
            <button
              className={projectTab === 'details' ? 'active' : ''}
              onClick={() => {
                setProjectTab('details');
              }}
            >
              <Activity size={15} />
              {t('projectTab.details')}
            </button>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {projectTab === 'knowledge' ? (
              <motion.div className="document-tab-panel" key="knowledge" {...(reduceMotion ? {} : fadeIn)}>
                <KnowledgeSearchPanel language={language} projects={projects} selectedProjectId={selectedProject?.id ?? ''} t={t} />
              </motion.div>
            ) : selectedProject ? (
              <motion.div className="document-tab-panel" key="details" {...(reduceMotion ? {} : fadeIn)}>
                <ProjectDetailPanel language={language} project={selectedProject} t={t} />
              </motion.div>
            ) : null}
          </AnimatePresence>
          {!projectsQuery.isLoading && projects.length > 0 && visibleProjects.length === 0 && <div className="empty-state">{t('filter.none')}</div>}
          {!projectsQuery.isLoading && projects.length === 0 && <div className="empty-state">{t('empty.projects')}</div>}
        </section>
      </div>
    </main>
  );
}
