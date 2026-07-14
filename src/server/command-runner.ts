import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SpanStatusCode } from '@opentelemetry/api';
import { execaCommand } from 'execa';
import type { CommandRunSummary } from '../shared/api.js';
import type { WorkflowCommand, WorkflowGate } from '../shared/manifest.js';
import { rememberRun } from './project-service.js';
import { appRoot } from './paths.js';
import { getTracer } from './telemetry.js';

function fallbackTraceId(traceId: string): string {
  return /^0+$/.test(traceId) ? randomBytes(16).toString('hex') : traceId;
}

function aikcVersion(): string {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8')) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function runProjectCommand(args: {
  projectId: string;
  projectRoot: string;
  command: WorkflowCommand | WorkflowGate;
}): Promise<CommandRunSummary> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const span = getTracer().startSpan('aikc.command_run', {
    attributes: {
      'aikc.project_id': args.projectId,
      'aikc.command_id': args.command.id,
      'aikc.command_label': args.command.label,
      'aikc.command': args.command.command,
    },
  });
  const traceId = fallbackTraceId(span.spanContext().traceId);
  try {
    const result = await execaCommand(args.command.command, {
      cwd: args.projectRoot,
      shell: true,
      reject: false,
      timeout: args.command.timeoutMs ?? 5 * 60_000,
      all: false,
    });
    const finished = Date.now();

    const run: CommandRunSummary = {
      id: randomUUID(),
      projectId: args.projectId,
      commandId: args.command.id,
      label: args.command.label,
      command: args.command.command,
      startedAt,
      finishedAt: new Date(finished).toISOString(),
      durationMs: finished - started,
      exitCode: result.exitCode ?? null,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
      traceId,
      aikcVersion: aikcVersion(),
      summary: result.exitCode === 0 ? 'Completed successfully.' : result.timedOut ? 'Timed out before completion.' : `Exited with code ${String(result.exitCode ?? 'unknown')}.`,
      residualRisk:
        result.exitCode === 0
          ? 'No residual risk recorded by AIKC; review command-specific output when needed.'
          : 'Verification did not pass. Inspect the command output and fix the failure before relying on this result.',
    };
    span.setAttributes({
      'aikc.duration_ms': run.durationMs,
      'aikc.exit_code': run.exitCode ?? -1,
      'aikc.timed_out': run.timedOut,
    });
    span.setStatus({ code: run.exitCode === 0 ? SpanStatusCode.OK : SpanStatusCode.ERROR });
    rememberRun(run);
    return run;
  } catch (error) {
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}
