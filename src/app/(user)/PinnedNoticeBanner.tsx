"use client";

// PinnedNoticeBanner — 청취자 포털 상단에 고정 노출되는 공지사항 배너.
//
// 데이터 흐름:
//   호스트가 SpotlightTriggerBar 의 "공지사항" input 에 글자 입력 + [게시]
//   → triggerSpotlightAction(sessionId, "BANNER", { text })
//   → fm_spotlight_events INSERT
//   → Supabase Realtime publication
//   → 이 컴포넌트가 수신해서 상단 배너로 노출
//
// 동작:
//   - 마운트 시 활성 LIVE 세션의 BANNER 1건 조회 (만료 전 / dismiss 전)
//   - Realtime 으로 새 BANNER INSERT 감지 → 슬라이드 인
//   - 사용자 [×] 클릭 시 localStorage 에 dismiss 기록 (재노출 방지)
//   - 만료 시각 도달하면 자동 사라짐

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface FmSessionRow {
  id: string;
  org_id: string;
  is_live: boolean;
  ended_at: string | null;
}

interface BannerRow {
  id: string;
  session_id: string;
  kind: string;
  payload_json: { text?: string } | null;
  triggered_at: string;
  expires_at: string | null;
  dismissed_at: string | null;
}

interface Props {
  orgId: string;
}

const DISMISS_KEY_PREFIX = "fm-notice-dismissed:";

export function PinnedNoticeBanner({ orgId }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerRow | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // 1초 폴링 — 만료 시각 도달 자동 비표시
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 활성 LIVE 세션 + 활성 BANNER 초기 조회
  const refetch = useCallback(async () => {
    if (!orgId) return;
    const supa = createClient();
    type SbOne<T> = { data: T | null };

    const sessResp = (await (
      supa.from("tori_fm_sessions" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: boolean) => {
              order: (
                c: string,
                o: { ascending: boolean }
              ) => {
                limit: (n: number) => {
                  maybeSingle: () => Promise<SbOne<FmSessionRow>>;
                };
              };
            };
          };
        };
      }
    )
      .select("id, org_id, is_live, ended_at")
      .eq("org_id", orgId)
      .eq("is_live", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()) as SbOne<FmSessionRow>;

    const sess = sessResp.data;
    if (!sess) {
      setSessionId(null);
      setBanner(null);
      return;
    }
    setSessionId(sess.id);

    const nowIso = new Date().toISOString();
    const banResp = (await (
      supa.from("fm_spotlight_events" as never) as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              is: (k: string, v: null) => {
                or: (q: string) => {
                  order: (
                    c: string,
                    o: { ascending: boolean }
                  ) => {
                    limit: (n: number) => {
                      maybeSingle: () => Promise<SbOne<BannerRow>>;
                    };
                  };
                };
              };
            };
          };
        };
      }
    )
      .select(
        "id, session_id, kind, payload_json, triggered_at, expires_at, dismissed_at"
      )
      .eq("session_id", sess.id)
      .eq("kind", "BANNER")
      .is("dismissed_at", null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("triggered_at", { ascending: false })
      .limit(1)
      .maybeSingle()) as SbOne<BannerRow>;

    setBanner(banResp.data);
  }, [orgId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Realtime 구독 — 새 BANNER 즉시 반영
  useEffect(() => {
    if (!sessionId) return;
    const supa = createClient();
    const ch = supa
      .channel(`fm-notice-${sessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "fm_spotlight_events",
          filter: `session_id=eq.${sessionId}`,
        } as never,
        ((payload: { new?: BannerRow; eventType?: string }) => {
          // 새 INSERT/UPDATE 들어오면 단순히 refetch — 활성 BANNER 재계산
          if (payload.new?.kind === "BANNER" || payload.eventType === "DELETE") {
            void refetch();
          }
        }) as never
      )
      .subscribe();
    return () => {
      void supa.removeChannel(ch);
    };
  }, [sessionId, refetch]);

  // 만료 시각 도달 또는 dismissed → 비표시
  if (!banner) return null;
  if (banner.dismissed_at) return null;

  const expiresMs = banner.expires_at ? new Date(banner.expires_at).getTime() : null;
  if (expiresMs !== null && now >= expiresMs) return null;

  // 사용자가 이미 [×] 닫은 공지인지 확인
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage.getItem(`${DISMISS_KEY_PREFIX}${banner.id}`)) {
        return null;
      }
    } catch {
      /* localStorage 사용 불가 환경 — silent */
    }
  }

  const text = (banner.payload_json?.text ?? "").toString().trim();
  if (!text) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(`${DISMISS_KEY_PREFIX}${banner.id}`, "1");
    } catch {
      /* silent */
    }
    // 강제 리렌더 — banner 그대로 두면 다음 렌더에서 localStorage 체크로 null 반환.
    setBanner({ ...banner });
  };

  // 마퀴 duration — 글자 수에 비례 (60px/sec 기준), 최소 12초 / 최대 40초.
  // text 길이에 따라 자연스러운 속도가 되도록 보정.
  const marqueeSec = Math.min(40, Math.max(12, Math.round(text.length * 0.6)));

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 border-b border-amber-300/60 bg-gradient-to-r from-amber-300 via-amber-200 to-amber-300 shadow-md"
    >
      <div className="mx-auto flex max-w-md items-center gap-2 px-3 py-2">
        <span className="shrink-0 text-base" aria-hidden>
          📢
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p
            className="fm-notice-marquee text-sm font-bold text-[#1B2B3A]"
            style={
              {
                ["--marquee-dur" as string]: `${marqueeSec}s`,
              } as React.CSSProperties
            }
          >
            {text}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="공지 닫기"
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-[#1B2B3A]/70 transition hover:bg-white/40 hover:text-[#1B2B3A]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
