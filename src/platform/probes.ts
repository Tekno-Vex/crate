// Diagnostics probes for things that aren't Spotify APIs but depend on the Spotify renderer
// environment (CSP, network). Used by spike S2.

export interface TopBarElement {
  tag: string;
  className: string;
  id?: string;
  testId?: string;
  background: string;
  opacity: string;
  position: string;
  inlineStyle?: string;
}

/**
 * Elements stacked over the top of our page — finds Spotify's sticky top bar and the element whose
 * background shows while scrolling (the "purple bar"). DOM class names: UNVERIFIED (1.3.5 spike).
 */
export function probeTopBar(anchor: Element | null): TopBarElement[] {
  const rect = anchor?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const seen = new Set<Element>();
  const out: TopBarElement[] = [];
  for (let y = 8; y <= 128; y += 24) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (seen.has(el) || el === document.body || el === document.documentElement) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      out.push({
        tag: el.tagName.toLowerCase(),
        className: typeof el.className === 'string' ? el.className : '',
        id: el.id || undefined,
        testId: el.getAttribute('data-testid') ?? undefined,
        background: cs.backgroundColor,
        opacity: cs.opacity,
        position: cs.position,
        inlineStyle: el.getAttribute('style') ?? undefined,
      });
    }
  }
  return out.slice(0, 30);
}

export interface ReachabilityResult {
  transport: 'http' | 'ws';
  url: string;
  outcome: 'reachable' | 'refused-or-offline' | 'blocked-by-csp' | 'timeout' | 'error';
  ms: number;
  detail?: string;
  cspViolations: string[];
}

async function withCspWatch<T>(fn: () => Promise<T>): Promise<{ value: T; violations: string[] }> {
  const violations: string[] = [];
  const onViolation = (e: SecurityPolicyViolationEvent) =>
    violations.push(`${e.effectiveDirective} blocked ${e.blockedURI}`);
  document.addEventListener('securitypolicyviolation', onViolation);
  try {
    const value = await fn();
    await new Promise((r) => setTimeout(r, 50)); // violation events fire async
    return { value, violations };
  } finally {
    document.removeEventListener('securitypolicyviolation', onViolation);
  }
}

export async function probeHttp(url: string, timeoutMs = 2500): Promise<ReachabilityResult> {
  const start = performance.now();
  const { value, violations } = await withCspWatch(async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      return { outcome: 'reachable' as const, detail: `HTTP ${res.status}` };
    } catch (e) {
      const err = e as Error;
      if (err.name === 'AbortError') return { outcome: 'timeout' as const, detail: 'aborted' };
      return { outcome: 'refused-or-offline' as const, detail: `${err.name}: ${err.message}` };
    } finally {
      clearTimeout(timer);
    }
  });
  return {
    transport: 'http',
    url,
    outcome: violations.length ? 'blocked-by-csp' : value.outcome,
    ms: Math.round(performance.now() - start),
    detail: value.detail,
    cspViolations: violations,
  };
}

export async function probeWebSocket(url: string, timeoutMs = 2500): Promise<ReachabilityResult> {
  const start = performance.now();
  const { value, violations } = await withCspWatch(
    () =>
      new Promise<{ outcome: ReachabilityResult['outcome']; detail?: string }>((resolve) => {
        let ws: WebSocket;
        try {
          ws = new WebSocket(url);
        } catch (e) {
          resolve({ outcome: 'error', detail: String(e) });
          return;
        }
        const timer = setTimeout(() => {
          ws.close();
          resolve({ outcome: 'timeout' });
        }, timeoutMs);
        ws.onopen = () => {
          clearTimeout(timer);
          ws.close();
          resolve({ outcome: 'reachable' });
        };
        ws.onerror = () => {
          clearTimeout(timer);
          resolve({ outcome: 'refused-or-offline', detail: 'onerror' });
        };
      }),
  );
  return {
    transport: 'ws',
    url,
    outcome: violations.length ? 'blocked-by-csp' : value.outcome,
    ms: Math.round(performance.now() - start),
    detail: value.detail,
    cspViolations: violations,
  };
}
