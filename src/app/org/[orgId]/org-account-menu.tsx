"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AcornIcon } from "@/components/acorn-icon";

interface Props {
  orgId: string;
  orgName: string;
  subtitle?: string;
  hasUnreadNotification?: boolean;
}

export function OrgAccountMenu({
  orgId,
  orgName,
  subtitle = "기관 관리자",
  hasUnreadNotification = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const initial = (orgName ?? "").trim().charAt(0) || "🌿";
  const shortName =
    orgName.length > 8 ? orgName.slice(0, 8) + "…" : orgName;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function onCopyParticipantLink() {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/home`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 구형 브라우저 폴백
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        window.prompt("참가자 링크를 복사하세요", url);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  return (
    <div ref={wrapRef} className="relative flex items-center gap-1.5">
      {/* 참가자 링크 복사 */}
      <button
        type="button"
        onClick={onCopyParticipantLink}
        aria-label="참가자 링크 복사"
        title="참가자 앱 링크를 클립보드에 복사"
        className={`relative inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition ${
          copied
            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : "border-[#D4E4BC] bg-white text-[#2D5A3D] hover:bg-[#F5F1E8]"
        }`}
      >
        <span aria-hidden>{copied ? "✅" : "🔗"}</span>
        <span className="hidden sm:inline">
          {copied ? "복사됨!" : "참가자 링크"}
        </span>
      </button>

      {/* Notification bell */}
      <button
        type="button"
        aria-label="알림"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#D4E4BC] bg-white text-[#2D5A3D] transition hover:bg-[#F5F1E8]"
        title="알림 (준비중)"
      >
        <span aria-hidden className="text-sm">
          🔔
        </span>
        {hasUnreadNotification && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white"
          />
        )}
      </button>

      {/* Divider */}
      <span className="hidden h-6 w-px bg-[#D4E4BC] sm:inline-block" />

      {/* Account button (avatar + name + chevron) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-2 rounded-full border border-[#D4E4BC] bg-white py-1 pl-1 pr-2.5 transition hover:bg-[#F5F1E8] sm:pr-3 ${
          open ? "bg-[#E8F0E4] ring-2 ring-[#3A7A52]/20" : ""
        }`}
      >
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3A7A52] to-[#4A7C59] text-xs font-bold text-white shadow-sm"
        >
          {initial}
        </span>
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="max-w-[10rem] truncate text-xs font-bold text-[#2D5A3D]">
            {shortName}
          </span>
          <span className="text-[10px] font-semibold text-[#8B7F75]">
            {subtitle}
          </span>
        </span>
        <span
          aria-hidden
          className={`hidden text-[9px] text-[#8B7F75] transition-transform sm:inline ${
            open ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-[#D4E4BC] bg-white shadow-lg"
        >
          {/* Header (mini profile) */}
          <div className="flex items-center gap-3 border-b border-[#E8E0D0] bg-gradient-to-br from-[#E8F0E4] to-white px-4 py-3">
            <span
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3A7A52] to-[#4A7C59] text-base font-bold text-white shadow-sm"
            >
              {initial}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-[#2D5A3D]">
                {orgName}
              </div>
              <div className="text-[11px] font-semibold text-[#8B7F75]">
                {subtitle}
              </div>
            </div>
          </div>

          {/* Menu items */}
          <ul className="py-1">
            <li>
              <Link
                href={`/org/${orgId}/settings`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#2C2C2C] hover:bg-[#FFF8F0] hover:text-[#2D5A3D]"
              >
                <span aria-hidden>🏫</span>
                <span>우리 기관 정보</span>
              </Link>
            </li>
            <li>
              <Link
                href={`/org/${orgId}/documents`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#2C2C2C] hover:bg-[#FFF8F0] hover:text-[#2D5A3D]"
              >
                <span aria-hidden>📄</span>
                <span>서류 관리</span>
              </Link>
            </li>
            <li>
              <Link
                href={`/org/${orgId}/settings/acorn-cap`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#2C2C2C] hover:bg-[#FFF8F0] hover:text-[#2D5A3D]"
              >
                <AcornIcon />
                <span>도토리 상한 설정</span>
              </Link>
            </li>
          </ul>

          <div className="border-t border-[#E8E0D0]">
            <form action="/api/auth/manager-logout" method="POST">
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
              >
                <span aria-hidden>🚪</span>
                <span>로그아웃</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
