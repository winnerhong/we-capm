import Link from "next/link";
import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";

type Props = {
  broadcast: ControlRoomSnapshot["broadcast"];
  orgId: string;
  isTvMode: boolean;
};

function formatAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

export function BroadcastTile({ broadcast, orgId }: Props) {
  const data = broadcast;

  const isEmpty = data.sentLast24h === 0 && data.lastSentAt === null;
  const broadcastHref = `/org/${orgId}/missions/broadcast`;

  return (
    <div className={`${styles.surface} flex flex-col p-4`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          📣
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#a8b8d0]">
          돌발 미션
        </h2>
      </div>

      {isEmpty ? (
        /* 빈 상태 — 컴팩트 한 줄. 큰 padding/아이콘 대신 인라인으로
           위젯이 화면 차지를 최소화. 내용 생기면 아래 분기로 자연스럽게 확장. */
        <div className="flex flex-wrap items-center gap-2 py-1">
          <span className="text-[12px] text-[#a8b8d0]">
            아직 발송 기록 없음
          </span>
          <Link
            href={broadcastHref}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#ff4d8a] px-2.5 py-1 text-[11px] font-bold text-[#0a0f0d] transition hover:bg-[#ff6699]"
          >
            <span aria-hidden>📣</span>
            <span>첫 돌발미션 보내기</span>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid flex-1 grid-cols-1 items-center gap-6 py-2 md:grid-cols-[1.2fr_1fr]">
            {/* 좌측: 24h 발송 수 큰 숫자 */}
            <div>
              <div className="text-[10px] text-[#a8b8d0]">지난 24시간 발송</div>
              <div
                className={`${styles.neonPink} flex items-end gap-2 font-mono text-5xl font-extrabold leading-none tabular-nums md:text-6xl`}
              >
                <span>{data.sentLast24h.toLocaleString("ko-KR")}</span>
                <span className="text-2xl text-[#a8b8d0] md:text-3xl">건</span>
              </div>
            </div>

            {/* 우측: 통계 2개 세로 */}
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-[10px] text-[#a8b8d0]">평균 응답률</div>
                <div
                  className={`${styles.neonGreen} font-mono text-2xl font-bold leading-none tabular-nums md:text-3xl`}
                >
                  {data.avgResponseRatePct.toLocaleString("ko-KR")}
                  <span className="ml-1 text-sm text-[#a8b8d0]">%</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#a8b8d0]">평균 응답시간</div>
                <div className="font-mono text-2xl font-bold leading-none tabular-nums text-[#f4ecd8] md:text-3xl">
                  {data.avgResponseTimeMinutes === null ? (
                    <span className="text-[#a8b8d0]">—</span>
                  ) : (
                    <>
                      {data.avgResponseTimeMinutes.toLocaleString("ko-KR")}
                      <span className="ml-1 text-sm text-[#a8b8d0]">분</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 하단 히스토리 1줄 */}
          {data.lastSentAt && (
            <>
              <div className={styles.divider} />
              <div className="pt-2 text-[11px] text-[#a8b8d0]">
                마지막:{" "}
                <span className="font-semibold text-[#c9c9c9]">
                  {data.lastSentTitle
                    ? `'${data.lastSentTitle}'`
                    : "제목 없음"}
                </span>{" "}
                · {formatAgo(data.lastSentAt)}
              </div>
            </>
          )}

          {/* CTA */}
          <Link
            href={broadcastHref}
            className={`${styles.broadcastPulse} mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff4d8a] px-4 py-3 text-sm font-bold text-[#0a0f0d] transition-transform hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-[#ff4d8a] focus:ring-offset-2 focus:ring-offset-[#0a0f0d]`}
          >
            <span aria-hidden>📣</span>
            <span>지금 쏘기</span>
          </Link>
        </>
      )}
    </div>
  );
}
