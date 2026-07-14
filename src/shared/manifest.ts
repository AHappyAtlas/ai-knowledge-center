import { z } from 'zod';

export const packageManagerSchema = z.enum(['npm', 'pnpm', 'yarn']);
export type PackageManager = z.infer<typeof packageManagerSchema>;

const gateCategories = ['review', 'typecheck', 'lint', 'test', 'security', 'knowledge', 'build', 'custom'] as const;
const gateCategorySchema = z.preprocess(value => {
  if (typeof value !== 'string') return value;
  return gateCategories.includes(value as (typeof gateCategories)[number]) ? value : 'custom';
}, z.enum(gateCategories).default('custom'));

function shellArg(value: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(value) ? value : JSON.stringify(value);
}

export function scriptToCommand(packageManager: PackageManager, script: string, args: readonly string[] = []): string {
  const renderedArgs = args.map(shellArg);
  const suffix = renderedArgs.length > 0 ? ` -- ${renderedArgs.join(' ')}` : '';

  if (packageManager === 'npm') return `npm run ${shellArg(script)}${suffix}`;
  if (packageManager === 'pnpm') return `pnpm ${shellArg(script)}${suffix}`;
  return `yarn ${shellArg(script)}${suffix}`;
}

const runnableBaseSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    command: z.string().min(1).optional(),
    script: z.string().min(1).optional(),
    packageManager: packageManagerSchema.default('yarn'),
    args: z.array(z.string().min(1)).default([]),
    description: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
    dangerous: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (!value.command && !value.script) {
      context.addIssue({
        code: 'custom',
        message: 'command or script is required',
        path: ['command'],
      });
    }
  });

type RunnableBase = z.output<typeof runnableBaseSchema>;

function normalizeRunnable<T extends RunnableBase>(value: T): T & { command: string } {
  return {
    ...value,
    command: value.command ?? scriptToCommand(value.packageManager, value.script ?? '', value.args),
  };
}

export const commandSchema = runnableBaseSchema.transform(normalizeRunnable);

export const knowledgeSchema = z.object({
  load: z.string().default('ai-knowledge/LOAD.md'),
  core: z.string().default('ai-knowledge/core'),
  aiLoad: z.string().default('ai-knowledge/ai/LOAD.md'),
  skills: z.string().default('ai-knowledge/skills'),
  skillIndex: z.string().default('ai-knowledge/skills/SKILL_INDEX.md'),
  closeoutPrompt: z.string().optional(),
  agentsFile: z.string().default('AGENTS.md'),
});

export const gateSchema = runnableBaseSchema
  .extend({
    category: gateCategorySchema,
  })
  .transform(normalizeRunnable);

export const dashboardSchema = z.object({
  watch: z.array(z.string()).default([]),
  links: z
    .array(
      z.object({
        label: z.string().min(1),
        url: z.string().min(1),
      })
    )
    .default([]),
});

export const mcpServerSchema = z.object({
  id: z.string().min(1).regex(/^[a-zA-Z0-9._-]+$/),
  label: z.string().min(1),
  type: z.enum(['stdio', 'http', 'sse', 'config']).default('stdio'),
  command: z.string().min(1).optional(),
  args: z.array(z.string()).default([]),
  scope: z.enum(['repository', 'workspace', 'user', 'external']).default('repository'),
  configPath: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const mcpSchema = z.object({
  servers: z.array(mcpServerSchema).default([]),
});

const integrationProviders = ['context7', 'playwright', 'github-mcp', 'custom'] as const;
const integrationModes = ['builtin', 'optional', 'external', 'disabled'] as const;

export const integrationSchema = z.object({
  provider: z.enum(integrationProviders).default('custom'),
  mode: z.enum(integrationModes).default('optional'),
  label: z.string().min(1).optional(),
  command: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const integrationsSchema = z.record(z.string().min(1), integrationSchema).default({});

export const telemetrySchema = z.object({
  enabled: z.boolean().default(true),
  serviceName: z.string().min(1).optional(),
  exporter: z.enum(['console', 'otlp', 'none']).default('console'),
  endpoint: z.string().min(1).optional(),
});

export const daggerSchema = z.object({
  enabled: z.boolean().default(false),
  modulePath: z.string().min(1).default('.'),
  pipeline: z.string().min(1).optional(),
  command: z.string().min(1).optional(),
});

export const loopBudgetSchema = z.object({
  maxRetries: z.number().int().nonnegative().optional(),
  maxRuntimeMs: z.number().int().positive().optional(),
  maxFiles: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
});

export const workflowLoopSchema = z.object({
  input: z.string().min(1),
  output: z.string().min(1),
  validation: z.array(z.string().min(1)).default([]),
  budget: loopBudgetSchema.default({}),
  stop: z.string().min(1),
  escalate: z.string().min(1),
  description: z.string().optional(),
});

export const workflowManifestSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  id: z.string().min(1).regex(/^[a-zA-Z0-9._-]+$/),
  name: z.string().min(1),
  description: z.string().optional(),
  knowledge: knowledgeSchema.default({
    load: 'ai-knowledge/LOAD.md',
    core: 'ai-knowledge/core',
    aiLoad: 'ai-knowledge/ai/LOAD.md',
    skills: 'ai-knowledge/skills',
    skillIndex: 'ai-knowledge/skills/SKILL_INDEX.md',
    agentsFile: 'AGENTS.md',
  }),
  commands: z.array(commandSchema).default([]),
  gates: z.array(gateSchema).default([]),
  dashboard: dashboardSchema.default({ watch: [], links: [] }),
  mcp: mcpSchema.default({ servers: [] }),
  integrations: integrationsSchema,
  telemetry: telemetrySchema.default({ enabled: true, exporter: 'console' }),
  dagger: daggerSchema.default({ enabled: false, modulePath: '.' }),
  loops: z.record(z.string().min(1), workflowLoopSchema).default({}),
});

export type WorkflowCommand = z.infer<typeof commandSchema>;
export type WorkflowGate = z.infer<typeof gateSchema>;
export type McpServer = z.infer<typeof mcpServerSchema>;
export type WorkflowIntegration = z.infer<typeof integrationSchema>;
export type WorkflowLoop = z.infer<typeof workflowLoopSchema>;
export type WorkflowManifest = z.infer<typeof workflowManifestSchema>;

export const registryEntrySchema = z.object({
  path: z.string().min(1),
  id: z.string().min(1).regex(/^[a-zA-Z0-9._-]+$/).optional(),
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  autoInit: z.boolean().default(true),
  packageManager: packageManagerSchema.default('npm'),
});

export const registrySchema = z.object({
  projects: z.array(registryEntrySchema).default([]),
});

export type RegistryEntry = z.infer<typeof registryEntrySchema>;
export type RegistryFile = z.infer<typeof registrySchema>;
