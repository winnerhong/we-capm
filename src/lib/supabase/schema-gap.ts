// "스키마가 아직 안 올라왔다" 를 에러와 구분한다.
//
// ## 왜 필요한가
//   코드는 배포됐는데 SQL 은 사람이 손으로 돌린다. 그 사이(몇 분~며칠)에는
//   테이블·함수가 없는 게 **정상**이다. 앱은 이 경우를 대비해 안전한 기본값으로
//   떨어지도록 짜여 있다(lib/features/org-switches.ts, lib/org-tools/pins.ts).
//
//   그런데 그걸 console.error 로 찍으면 Next dev 오버레이가 빨간 에러를 띄운다.
//   고쳐야 할 버그처럼 보이는데 실제로는 "SQL 을 돌리세요" 다. 진짜 에러가
//   그 사이에 섞이면 아무도 못 알아본다.
//
// ## 그리고 {} 만 찍히던 문제
//   Supabase 의 PostgrestError 를 그대로 console.error 에 넘기면 서버 컴포넌트에서
//   `{}` 로 나온다(RSC 직렬화를 거치며 속성이 벗겨진다). 무엇이 잘못됐는지 한 글자도
//   안 남는다. 그래서 code·message 를 **직접 뽑아** 문자열로 찍는다.

type PgLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

export type PgErrorInfo = { code: string; message: string; hint: string };

export function describePgError(e: unknown): PgErrorInfo {
  const o = (e ?? {}) as PgLike;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    code: str(o.code),
    message: str(o.message) || (e instanceof Error ? e.message : ""),
    hint: str(o.hint) || str(o.details),
  };
}

/**
 * 아직 안 만들어진 테이블·함수인가.
 *   PGRST202  함수가 스키마 캐시에 없음
 *   PGRST205  테이블이 스키마 캐시에 없음
 *   42P01     undefined_table   (PostgREST 를 거치지 않은 경로)
 *   42883     undefined_function
 *   42703     undefined_column  — 컬럼만 빠진 반쪽 적용
 */
export function isSchemaGap(e: unknown): boolean {
  const { code } = describePgError(e);
  return (
    code === "PGRST202" ||
    code === "PGRST205" ||
    code === "42P01" ||
    code === "42883" ||
    code === "42703"
  );
}

const warned = new Set<string>();

/**
 * 스키마 미적용은 **한 번만** 조용히 알린다(console.warn — 빨간 오버레이 안 뜬다).
 * 그 외는 진짜 문제라 매번 error 로 찍는다.
 *
 * @param what      무엇을 부르다 났나 ("org_pinned_tools")
 * @param migration 돌려야 할 파일 ("20260901000000_org_tool_pins.sql")
 */
export function reportQueryFailure(
  what: string,
  migration: string,
  e: unknown
): void {
  const { code, message, hint } = describePgError(e);

  if (isSchemaGap(e)) {
    if (warned.has(what)) return;
    warned.add(what);
    console.warn(
      `[schema] ${what} 없음 — supabase/migrations/${migration} 을 아직 적용하지 않았습니다. ` +
        `그동안은 안전한 기본값으로 동작합니다. (${code})`
    );
    return;
  }

  console.error(
    `[query] ${what} 실패 — ${code || "코드없음"}: ${message || "메시지없음"}` +
      (hint ? ` / ${hint}` : "")
  );
}
