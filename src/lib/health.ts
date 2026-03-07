/** In-memory store for request metrics (resets on server restart) */
const requestMetrics: { latencyMs: number; timestamp: number; path: string; status: number }[] = [];
const MAX_METRICS = 500;
const ERROR_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function recordRequest(path: string, latencyMs: number, status: number) {
  requestMetrics.push({ path, latencyMs, timestamp: Date.now(), status });
  if (requestMetrics.length > MAX_METRICS) {
    requestMetrics.shift();
  }
}

export function getMetrics() {
  const now = Date.now();
  const recent = requestMetrics.filter((m) => now - m.timestamp < ERROR_WINDOW_MS);
  const errors = recent.filter((m) => m.status >= 400);
  const avgLatency =
    recent.length > 0 ? recent.reduce((s, m) => s + m.latencyMs, 0) / recent.length : 0;
  const p95 =
    recent.length > 0
      ? recent
          .sort((a, b) => a.latencyMs - b.latencyMs)
          [Math.floor(recent.length * 0.95)]?.latencyMs ?? 0
      : 0;
  return {
    totalRequests: recent.length,
    errorCount: errors.length,
    errorRate: recent.length > 0 ? (errors.length / recent.length) * 100 : 0,
    avgLatencyMs: Math.round(avgLatency * 10) / 10,
    p95LatencyMs: Math.round(p95 * 10) / 10,
    windowMinutes: 60,
  };
}
