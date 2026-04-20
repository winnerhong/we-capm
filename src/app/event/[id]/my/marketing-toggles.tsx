"use client";

import { useEffect, useState } from "react";

type Channel = "sms" | "email" | "push";

type Prefs = Record<Channel, boolean>;

const STORAGE_KEY = "toriro_marketing_prefs_v1";

const DEFAULT_PREFS: Prefs = { sms: true, email: false, push: true };

export function MarketingTogglesCard() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Prefs>;
        setPrefs({
          sms: parsed.sms ?? DEFAULT_PREFS.sms,
          email: parsed.email ?? DEFAULT_PREFS.email,
          push: parsed.push ?? DEFAULT_PREFS.push,
        });
      }
    } catch {}
  }, []);

  function toggle(channel: Channel) {
    setPrefs((prev) => {
      const next = { ...prev, [channel]: !prev[channel] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  const items: { key: Channel; icon: string; label: string; desc: string }[] = [
    { key: "sms", icon: "📱", label: "SMS", desc: "행사·보상 알림을 문자로 받아요" },
    { key: "email", icon: "📧", label: "이메일", desc: "월간 소식을 이메일로 받아요" },
    { key: "push", icon: "🔔", label: "푸시", desc: "브라우저 푸시 알림" },
  ];

  return (
    <section className="rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
        <span>📣</span>
        <span>마케팅 수신 설정</span>
        <span className="ml-auto rounded-full bg-[#D4E4BC] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
          처리 정지권 (제37조)
        </span>
      </h2>
      <ul className="space-y-2">
        {items.map((item) => {
          const on = mounted ? prefs[item.key] : DEFAULT_PREFS[item.key];
          return (
            <li
              key={item.key}
              className="flex items-center gap-3 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-4 py-3"
            >
              <span className="text-xl" aria-hidden>
                {item.icon}
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-[#2D5A3D]">
                  {item.label}
                </div>
                <div className="text-[11px] text-[#6B6560]">{item.desc}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${item.label} 수신 ${on ? "끄기" : "켜기"}`}
                onClick={() => toggle(item.key)}
                className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/40 ${
                  on ? "bg-[#3A7A52]" : "bg-[#D4C6B8]"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    on ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-[#8B7F75]">
        언제든 끄고 켤 수 있어요. 꺼진 채널로는 마케팅 정보를 보내지 않아요.
      </p>
    </section>
  );
}
