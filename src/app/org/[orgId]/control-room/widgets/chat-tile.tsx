import type { ControlRoomSnapshot } from "@/lib/control-room/types";
import styles from "../control-room.module.css";

type Props = {
  snapshot: ControlRoomSnapshot;
  isTvMode: boolean;
};

function maskName(name: string): string {
  if (!name) return "";
  // "가족" 패턴 그대로 살리는 단순 마스킹
  // 공백 포함 문자열일 경우 첫 토큰만 마스킹
  const parts = name.split(/(\s+)/);
  const head = parts[0] ?? "";
  if (head.length <= 1) {
    parts[0] = "*";
  } else if (head.length === 2) {
    parts[0] = head[0] + "*";
  } else {
    // 마지막-1 글자 치환 (예: 홍길동 -> 홍*동)
    const masked = head
      .split("")
      .map((c, i) => (i === head.length - 2 ? "*" : c))
      .join("");
    parts[0] = masked;
  }
  return parts.join("");
}

function timeAgo(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((now - t) / 1000));
  if (diffSec < 60) return `${diffSec}초 전`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export function ChatTile({ snapshot, isTvMode }: Props) {
  const limit = isTvMode ? 12 : 10;
  const messages = snapshot.chat.slice(0, limit);
  const now = new Date(snapshot.serverNowIso).getTime();

  return (
    <div className={`${styles.surface} flex h-full flex-col p-5`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          💬
        </span>
        <h2 className="text-xs font-semibold tracking-[0.15em] text-[#7FA892]">
          토리톡
        </h2>
        <span className="ml-auto font-mono text-xs text-[#7FA892]">
          {snapshot.chat.length}
        </span>
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[#1f2a24] py-8 text-sm text-[#7FA892]">
          🌱 아직 이야기가 없어요
        </div>
      ) : (
        <ul className="flex flex-1 flex-col gap-2 overflow-hidden">
          {messages.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border border-[#1f2a24] bg-[#0e1513] px-3 py-2"
            >
              <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px]">
                <span className={`${styles.neonCyan} font-semibold`}>
                  {isTvMode ? maskName(m.senderName) : m.senderName}
                </span>
                <span className="truncate text-[#7FA892]">
                  {m.roomName} · {timeAgo(m.createdAt, now)}
                </span>
              </div>
              <div className="line-clamp-2 text-sm text-[#e8f0e4]">
                {m.content}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
