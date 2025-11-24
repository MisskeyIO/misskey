import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Enable diagnostic logging at info level
// Useful during development to verify telemetry pipeline initialization
if (process.env.OTEL_LOG_LEVEL) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel[process.env.OTEL_LOG_LEVEL.toUpperCase()] ?? DiagLogLevel.INFO);
} else {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

// Allow overriding OTLP endpoint; defaults assume a Signoz collector service
const collectorEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://signoz-otel-collector:4318';

const traceExporter = new OTLPTraceExporter({ url: `${collectorEndpoint}/v1/traces` });
const metricExporter = new OTLPMetricExporter({ url: `${collectorEndpoint}/v1/metrics` });

// Enrich resource metadata so traces/metrics can be tied back to the originating pod
const resourceAttributes = {
  [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'misskey',
  [SemanticResourceAttributes.SERVICE_NAMESPACE]: process.env.OTEL_SERVICE_NAMESPACE,
  [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.K8S_POD_NAME || process.env.HOSTNAME,
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV,
  'k8s.namespace.name': process.env.K8S_NAMESPACE,
  'k8s.node.name': process.env.K8S_NODE_NAME,
};

Object.keys(resourceAttributes).forEach((key) => resourceAttributes[key] === undefined && delete resourceAttributes[key]);

const sdk = new NodeSDK({
  resource: Resource.default().merge(new Resource(resourceAttributes)),
  traceExporter,
  metricReader: new PeriodicExportingMetricReader({ exporter: metricExporter }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start()
  .then(() => {
    console.log('OpenTelemetry auto-instrumentation initialized');
  })
  .catch((error) => {
    console.error('Error initializing OpenTelemetry', error);
  });

process.once('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('OpenTelemetry SDK shut down'))
    .catch((err) => console.error('Error during OpenTelemetry shutdown', err))
    .finally(() => process.exit(0));
});
