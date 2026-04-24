// Rate limiting — in-memory sliding window counter.
//
// 서버리스 환경 (Vercel) 에선 함수 인스턴스 별로 격리된 Map 을 가진다.
// 즉, 다중 인스턴스로 스케일아웃되면 실제 limit 은 instance 수 × max 가 된다.
// 그래도 "단일 IP 폭주" 정도는 충분히 막아준다.
// 트래픽이 커지면 Upstash Redis (sliding_window) 로 업그레이드 예정.
//
// Edge runtime (proxy.ts) 에서도 동작 — fs/net 같은 Node API 를 쓰지 않고
// Map + Date.now() 만 쓴다.

type Bucket = {
  count: number;
  resetAt: number; // epoch ms
};

const buckets = new Map<string, Bucket>();

export type LimitConfig = {
  /** 카운터 키 — 일반적으로 `<scope>:<ip>` 또는 `<scope>:<ip>:<subject>`. */
  key: string;
  /** 윈도우 길이 (ms). */
  windowMs: number;
  /** 윈도우 내 최대 허용 요청 수. */
  max: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** 다음 윈도우 재시작까지 남은 ms. */
  resetInMs: number;
};

/**
 * sliding (fixed) window counter.
 *  - key 의 bucket 이 없거나 만료됐으면 새 윈도우 시작 (count=1).
 *  - count >= max 면 거부.
 *  - 그 외는 count 증가.
 */
export function rateLimit(cfg: LimitConfig): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(cfg.key);
  if (!b || b.resetAt <= now) {
    buckets.set(cfg.key, { count: 1, resetAt: now + cfg.windowMs });
    return {
      allowed: true,
      remaining: cfg.max - 1,
      resetInMs: cfg.windowMs,
    };
  }
  if (b.count >= cfg.max) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: b.resetAt - now,
    };
  }
  b.count += 1;
  return {
    allowed: true,
    remaining: cfg.max - b.count,
    resetInMs: b.resetAt - now,
  };
}

/**
 * 요청에서 client IP 추출.
 * 우선순위: x-forwarded-for (첫 번째) → x-real-ip → null.
 * IP 가 null 이면 호출부가 "unknown" 같은 고정 키로 fallback (더 엄격한 limit 권장).
 *
 * 주의: x-forwarded-for 는 클라이언트가 조작 가능하다. 프록시 (Vercel/Cloudflare) 뒤에서만
 *       신뢰해야 하며, 본 프로덕션 환경은 Vercel edge 가 첫 프록시이므로 OK.
 */
export function getClientIp(request: Request): string | null {
  const h = request.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = h.get("x-real-ip");
  if (xri) {
    const trimmed = xri.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/**
 * 429 Too Many Requests 응답.
 * JSON body + Retry-After (초) + X-RateLimit-Remaining.
 */
export function tooManyRequests(result: RateLimitResult): Response {
  const retrySec = Math.max(1, Math.ceil(result.resetInMs / 1000));
  return new Response(
    JSON.stringify({
      ok: false,
      error: `너무 많이 시도했어요. ${retrySec}초 후 다시 시도해 주세요.`,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Retry-After": String(retrySec),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.resetInMs / 1000)),
      },
    }
  );
}

/**
 * 주기적 GC — 매 100 번째 호출마다 만료된 bucket 청소.
 * 인스턴스가 오래 살아남을수록 Map 이 커지기 때문.
 */
let gcCounter = 0;
export function maybeGcBuckets(): void {
  gcCounter = (gcCounter + 1) % 100;
  if (gcCounter !== 0) return;
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}
