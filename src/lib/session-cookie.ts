// 세션 쿠키 서명 (campnic_*).
//
// 왜 필요했나:
//   세션 쿠키가 평문 JSON 이었다. httpOnly 라 JS 로 '읽지'는 못하지만, 값을 '만들어
//   넣는' 건 아무나 할 수 있다 — devtools 든 curl 이든 `campnic_org={"orgId":"...”}`
//   한 줄이면 그 기관 포털이 그대로 열렸다(실제로 열어 확인했다). 관리자·파트너·
//   참가자 쿠키도 전부 같은 구조였다.
//
// 형식: <base64url(JSON)>.<base64url(HMAC-SHA256(base64url(JSON)))>
//   서명이 없거나 어긋나면 그 쿠키는 없는 것으로 친다 → 로그인 화면으로.
//
// ⚠ 검증은 미들웨어(src/proxy.ts)가 요청마다 한 번에 한다. 통과한 쿠키는 그 자리에서
//   평문 JSON 으로 되돌려 놓으므로, 쿠키를 읽는 쪽(requireOrg·requirePartner 등)은
//   예전 그대로 JSON.parse 만 하면 된다. 읽는 코드를 40군데 고치지 않아도 되는 이유다.
// ⚠ 반대로 쿠키를 '쓰는' 쪽은 반드시 seal() 을 거쳐야 한다. 안 거치면 미들웨어가
//   서명 없는 값으로 보고 버려서 로그인이 안 된 것처럼 보인다.
//   (scripts/check-session-cookies.mjs 가 빠진 곳을 잡는다)
//
// Web Crypto 를 쓴다 — 미들웨어(Edge)와 서버 액션(Node) 양쪽에서 같은 코드가 돌아야 한다.
// node:crypto 를 쓰면 Edge 번들에서 깨진다.

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ⚠ ArrayBuffer 를 직접 잡아 씌운다. `new Uint8Array(n)` 은 Uint8Array<ArrayBufferLike> 라
//   crypto.subtle 의 BufferSource 로 안 들어간다(SharedArrayBuffer 가능성 때문에).
function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let keyPromise: Promise<CryptoKey> | null = null;

function sessionKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    /* SESSION_SECRET 이 없으면 서비스 롤 키에서 파생한다 — 둘 다 서버에만 있는 값이라
       안전하고, 별도 환경변수를 세팅하지 않아도 배포 즉시 서명이 켜진다.
       ⚠ 이 값이 바뀌면 로그인된 세션이 전부 무효가 된다(재로그인). 키를 돌릴 땐 그걸 감안할 것. */
    const secret =
      process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) {
      throw new Error(
        "[session] SESSION_SECRET(또는 SUPABASE_SERVICE_ROLE_KEY)이 없습니다. " +
          "세션 쿠키에 서명할 수 없어 기동을 중단합니다."
      );
    }
    keyPromise = crypto.subtle.importKey(
      "raw",
      // 용도 분리 — 같은 비밀값을 다른 데 쓰더라도 서명이 섞이지 않게 한다.
      enc.encode(`campnic-session-v1:${secret}`),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
  }
  return keyPromise;
}

/** 쿠키에 넣을 값 — 반드시 이걸 거쳐 저장한다. */
export async function seal(payload: unknown): Promise<string> {
  const body = toB64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    "HMAC",
    await sessionKey(),
    enc.encode(body)
  );
  return `${body}.${toB64url(new Uint8Array(sig))}`;
}

/**
 * 서명 확인 후 평문 JSON 문자열로 되돌린다. 서명이 없거나 어긋나면 null.
 * (JSON.parse 까지 하지 않는 이유: 호출부가 기존처럼 문자열을 요구한다)
 */
export async function unseal(raw: string | undefined | null): Promise<string | null> {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  // 서명 없는 값 = 예전 평문 쿠키이거나 손으로 만들어 넣은 값. 둘 다 거부한다.
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await sessionKey(),
      fromB64url(raw.slice(dot + 1)),
      enc.encode(body)
    );
    if (!ok) return null;
    const json = dec.decode(fromB64url(body));
    JSON.parse(json); // 형태 확인만 — 깨진 값이 그대로 흘러가지 않게
    return json;
  } catch {
    return null;
  }
}
