"use client";
import Link from "next/link";
import { useState } from "react";

type Item = {
  key: string;
  icon: string;
  title: string;
  body: React.ReactNode;
};

export function HelpAccordion({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState<string | null>(null);

  const items: Item[] = [
    {
      key: "path",
      icon: "🌿",
      title: "숲길이 뭐예요?",
      body: (
        <>
          <p>
            숲길은 이벤트에서 수행하는 <strong>미션</strong>이에요. 사진을 찍거나,
            퀴즈를 풀거나, 장소를 방문하는 등 다양한 형태가 있어요.
          </p>
          <p className="mt-2">
            한 숲길을 완료하면 <strong>도토리 🌰</strong>를 받아요.
          </p>
          <Link
            href={`/event/${eventId}/missions`}
            className="mt-3 inline-block rounded-full bg-[#2D5A3D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#224a30]"
          >
            숲길 보러가기 →
          </Link>
        </>
      ),
    },
    {
      key: "acorn",
      icon: "🌰",
      title: "도토리는 어떻게 모아요?",
      body: (
        <>
          <p>미션을 수행하고 승인을 받으면 도토리를 받아요.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[#2D5A3D]">
            <li>사진·영상 미션: 제출 후 숲지기 승인</li>
            <li>퀴즈·위치 미션: 바로 자동 승인</li>
            <li>팀 미션: 팀원 모두가 참여하면 완료</li>
          </ul>
          <p className="mt-2">
            모은 도토리는 <strong>순위</strong>와 <strong>나무 성장</strong>에 반영돼요.
          </p>
        </>
      ),
    },
    {
      key: "tree",
      icon: "🌲",
      title: "나무 성장이 뭐예요?",
      body: (
        <>
          <p>모은 도토리에 따라 나만의 나무가 5단계로 자라요.</p>
          <div className="mt-3 flex items-end justify-between rounded-xl bg-white/70 p-3 text-center">
            {[
              { e: "🌱", n: "새싹", m: "0+" },
              { e: "🌿", n: "덤불", m: "6+" },
              { e: "🪵", n: "묘목", m: "16+" },
              { e: "🌲", n: "나무", m: "31+" },
              { e: "🏞️", n: "숲", m: "61+" },
            ].map((l) => (
              <div key={l.n} className="flex-1">
                <div className="text-2xl">{l.e}</div>
                <div className="text-[10px] font-semibold text-[#2D5A3D]">{l.n}</div>
                <div className="text-[9px] text-[#6B6560]">🌰 {l.m}</div>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      key: "chat",
      icon: "💬",
      title: "토리톡은 무엇인가요?",
      body: (
        <>
          <p>
            토리톡은 이벤트 참가자끼리 소통하는 <strong>채팅 공간</strong>이에요.
            숲지기·팀원과 대화하고 소식을 나눌 수 있어요.
          </p>
          <Link
            href={`/event/${eventId}/chat`}
            className="mt-3 inline-block rounded-full bg-[#2D5A3D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#224a30]"
          >
            토리톡 열기 →
          </Link>
        </>
      ),
    },
    {
      key: "reward",
      icon: "🎁",
      title: "보상·쿠폰은 어떻게 받아요?",
      body: (
        <>
          <p>
            숲길을 완료하거나 순위권에 들면 다양한 보상을 받아요. 쿠폰은
            <strong> “오늘의 선물”</strong>에서 바로 사용할 수 있어요.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[#2D5A3D]">
            <li>점수 누적 보상 · 순위 보상</li>
            <li>뱃지 · 추첨 · 즉시 보상</li>
          </ul>
          <Link
            href={`/event/${eventId}/rewards`}
            className="mt-3 inline-block rounded-full bg-[#2D5A3D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#224a30]"
          >
            보상 보러가기 →
          </Link>
        </>
      ),
    },
    {
      key: "rank",
      icon: "🏆",
      title: "숲지기 순위는 어떻게 정해져요?",
      body: (
        <>
          <p>
            모은 도토리 🌰 수를 기준으로 순위가 결정돼요. 동점일 경우 먼저 도달한
            사람이 상위에 표시돼요.
          </p>
          <p className="mt-2 text-[#6B6560]">
            1·2·3등은 🥇🥈🥉 이모지로 표시되고, 내 팀은 보라색 테두리로 강조돼요.
          </p>
          <Link
            href={`/event/${eventId}/leaderboard`}
            className="mt-3 inline-block rounded-full bg-[#2D5A3D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#224a30]"
          >
            명예의 전당 보기 →
          </Link>
        </>
      ),
    },
    {
      key: "guild",
      icon: "🏕️",
      title: "숲 패밀리 가입 방법은?",
      body: (
        <>
          <p>
            숲 패밀리는 함께 미션을 수행하는 <strong>팀</strong>이에요.
            패밀리 페이지에서 가입하거나 초대 코드를 입력해 참여할 수 있어요.
          </p>
          <Link
            href={`/event/${eventId}/guild`}
            className="mt-3 inline-block rounded-full bg-[#2D5A3D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#224a30]"
          >
            숲 패밀리 보기 →
          </Link>
        </>
      ),
    },
  ];

  return (
    <div className="space-y-2">
      {items.map((it) => {
        const isOpen = open === it.key;
        return (
          <div
            key={it.key}
            className="overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white/80 shadow-sm"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`help-panel-${it.key}`}
              onClick={() => setOpen(isOpen ? null : it.key)}
              className="flex w-full items-center gap-3 px-4 py-4 text-left focus:outline-none focus:ring-2 focus:ring-[#4A7C59]/40"
            >
              <span className="text-2xl" aria-hidden>
                {it.icon}
              </span>
              <span className="flex-1 font-bold text-[#2D5A3D]">{it.title}</span>
              <span
                className={`text-[#6B6560] transition-transform ${isOpen ? "rotate-180" : ""}`}
                aria-hidden
              >
                ▾
              </span>
            </button>
            <div
              id={`help-panel-${it.key}`}
              role="region"
              hidden={!isOpen}
              className="border-t border-[#D4E4BC]/70 bg-[#FFF8F0]/60 px-4 py-4 text-sm leading-relaxed text-[#3d3a34]"
            >
              {it.body}
            </div>
          </div>
        );
      })}
    </div>
  );
}
