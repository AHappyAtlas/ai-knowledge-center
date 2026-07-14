import { trace } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

let initialized = false;

export function setupTelemetry(): void {
  if (initialized) return;
  initialized = true;

  if (process.env['AIKC_TELEMETRY_EXPORTER'] === 'none') return;

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env['AIKC_TELEMETRY_SERVICE_NAME'] ?? 'ai-knowledge-center',
    }),
    spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
  });
  provider.register();
}

export function getTracer() {
  setupTelemetry();
  return trace.getTracer('ai-knowledge-center');
}
