const hits = new Map<string, number[]>();

export function assertRateLimit(key: string, limit = 5, windowMs = 60_000): void {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    throw new Error("Rate limit exceeded. Please wait a moment before starting another scan.");
  }
  recent.push(now);
  hits.set(key, recent);
}
