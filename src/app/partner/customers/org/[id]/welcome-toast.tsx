"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "./copy-button";

interface Props {
  username: string;
  password: string;
}

/**
 * 신규 등록 직후 env-toast 형태로 자동 계정 안내 + SMS 발송 완료 알림.
 * 3초 후 자동 fade-out, 닫기 버튼 클릭으로도 닫힘.
 */
export function WelcomeToast({ username, password }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 15000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-[min(420px,calc(100vw-2rem))] rounded-2xl border-2 border-emerald-300 bg-white p-4 shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg">
          ✓
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-emerald-900">
            SMS 발송 완료
          </p>
          <p className="mt-0.5 text-xs text-[#6B6560]">
            대표자 번호로 자동 계정 정보를 전송했어요.
          </p>

          <div className="mt-3 space-y-1.5 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-[#8B7F75]">
                  아이디
                </p>
                <p className="truncate font-mono text-xs font-bold text-[#2D5A3D]">
                  {username}
                </p>
              </div>
              <CopyButton text={username} label="복사" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-[#8B7F75]">
                  임시 비밀번호
                </p>
                <p className="truncate font-mono text-xs font-bold text-[#2D5A3D]">
                  {password}
                </p>
              </div>
              <CopyButton text={password} label="복사" />
            </div>
          </div>

          <p className="mt-2 text-[11px] text-amber-700">
            ⚠ 이 정보는 새로고침하면 사라져요. 필요하면 지금 복사해 두세요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="닫기"
          className="flex-shrink-0 rounded-lg px-2 py-1 text-lg text-[#6B6560] hover:bg-[#FFF8F0]"
        >
          ×
        </button>
      </div>
    </div>
  );
}
