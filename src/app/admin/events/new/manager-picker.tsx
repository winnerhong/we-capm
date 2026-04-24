"use client";

import { useState, useEffect } from "react";
import { AcornIcon } from "@/components/acorn-icon";

export interface SchoolCandidate {
  id: number;
  name: string;
  username: string;
  phone: string;
  district: string;
}

export interface OrgCandidate {
  id: string;
  org_name: string;
  auto_username: string;
  representative_phone: string | null;
  org_type: string | null;
}

type Source = "SCHOOL" | "ORG";
type Selected =
  | { source: "SCHOOL"; school: SchoolCandidate }
  | { source: "ORG"; org: OrgCandidate }
  | null;

export function ManagerPicker({
  schools,
  orgs,
  preSelectedSchoolId,
}: {
  schools: SchoolCandidate[];
  orgs: OrgCandidate[];
  preSelectedSchoolId?: number | null;
}) {
  const [source, setSource] = useState<Source>("ORG");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Selected>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (preSelectedSchoolId) {
      const found = schools.find((s) => s.id === preSelectedSchoolId);
      if (found) {
        setSelected({ source: "SCHOOL", school: found });
        setSource("SCHOOL");
      }
    }
  }, [preSelectedSchoolId, schools]);

  const managerId =
    selected?.source === "SCHOOL"
      ? selected.school.username
      : selected?.source === "ORG"
      ? selected.org.auto_username
      : "";

  const schoolIdValue = selected?.source === "SCHOOL" ? selected.school.id : "";
  const orgIdValue = selected?.source === "ORG" ? selected.org.id : "";

  const filteredSchools = search
    ? schools.filter(
        (s) =>
          s.name.includes(search) ||
          s.district?.includes(search) ||
          s.phone?.includes(search)
      )
    : schools;

  const filteredOrgs = search
    ? orgs.filter(
        (o) =>
          o.org_name.includes(search) ||
          o.auto_username?.includes(search) ||
          o.representative_phone?.includes(search)
      )
    : orgs;

  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-[#2C2C2C]">
        🏫 운영 주체(매니저) 선택
      </label>

      <input type="hidden" name="school_id" value={schoolIdValue} />
      <input type="hidden" name="partner_org_id" value={orgIdValue} />
      <input type="hidden" name="manager_id" value={managerId} />

      <div
        onClick={() => setOpen(!open)}
        className="w-full cursor-pointer rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-base"
      >
        {selected?.source === "SCHOOL" ? (
          <span>
            <span className="mr-2 rounded-full bg-[#E8F0E4] px-2 py-0.5 text-xs text-[#2D5A3D]">
              학교DB
            </span>
            {selected.school.name}{" "}
            <span className="text-xs text-neutral-400">
              ({selected.school.district})
            </span>
          </span>
        ) : selected?.source === "ORG" ? (
          <span>
            <span className="mr-2 rounded-full bg-[#FFF0D9] px-2 py-0.5 text-xs text-[#8B6B3F]">
              지사 CRM
            </span>
            {selected.org.org_name}{" "}
            <span className="text-xs text-neutral-400">
              ({selected.org.auto_username})
            </span>
          </span>
        ) : (
          <span className="text-neutral-400">기관 또는 운영자 검색</span>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[#D4E4BC] bg-white shadow-lg">
          <div className="flex gap-1 border-b border-[#E8F0E4] p-2">
            <button
              type="button"
              onClick={() => setSource("ORG")}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                source === "ORG"
                  ? "bg-[#2D5A3D] text-white"
                  : "bg-[#FFF8F0] text-[#6B6560]"
              }`}
            >
              <span className="inline-flex items-center gap-1"><AcornIcon /> 지사 CRM 기관 ({orgs.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSource("SCHOOL")}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                source === "SCHOOL"
                  ? "bg-[#2D5A3D] text-white"
                  : "bg-[#FFF8F0] text-[#6B6560]"
              }`}
            >
              🏫 학교 DB ({schools.length})
            </button>
          </div>

          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, 아이디, 연락처 검색…"
              className="w-full rounded-lg border border-[#D4E4BC] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D5A3D]"
              autoFocus
            />
          </div>

          <div className="max-h-60 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setSearch("");
                setOpen(false);
              }}
              className="w-full border-b border-[#F5F1E8] px-3 py-2 text-left text-sm text-[#6B6560] hover:bg-[#FFF8F0]"
            >
              ✏️ 직접 입력 (운영자 아이디 수동 입력)
            </button>

            {source === "ORG" &&
              filteredOrgs.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setSelected({ source: "ORG", org: o });
                    setSearch("");
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#FFF8F0]"
                >
                  <span>
                    <span className="mr-2 rounded-full bg-[#FFF0D9] px-2 py-0.5 text-xs text-[#8B6B3F]">
                      {o.org_type ?? "OTHER"}
                    </span>
                    {o.org_name}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {o.auto_username}
                  </span>
                </button>
              ))}

            {source === "SCHOOL" &&
              filteredSchools.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelected({ source: "SCHOOL", school: s });
                    setSearch("");
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#FFF8F0]"
                >
                  <span>{s.name}</span>
                  <span className="text-xs text-neutral-400">{s.district}</span>
                </button>
              ))}

            {((source === "ORG" && filteredOrgs.length === 0) ||
              (source === "SCHOOL" && filteredSchools.length === 0)) && (
              <div className="px-3 py-4 text-center text-sm text-neutral-400">
                검색 결과 없음
              </div>
            )}
          </div>
        </div>
      )}

      {selected?.source === "ORG" && (
        <div className="mt-2 rounded-lg bg-[#FFF8F0] p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#FFF0D9] px-2 py-0.5 text-xs text-[#8B6B3F]">
              지사 CRM
            </span>
            <strong>{selected.org.org_name}</strong>
          </div>
          <div className="mt-1 text-xs text-[#6B6560]">
            매니저 아이디: <strong>{selected.org.auto_username}</strong>
            {selected.org.representative_phone && (
              <> · 연락처: {selected.org.representative_phone}</>
            )}
          </div>
          <div className="mt-1 text-xs text-[#2D5A3D]">
            ℹ️ 이 기관은 지사가 발급한 계정으로 /manager 에서 로그인할 수 있어요
          </div>
        </div>
      )}

      {selected?.source === "SCHOOL" && (
        <div className="mt-2 rounded-lg bg-[#E8F0E4] p-3 text-sm">
          <div>
            <strong>{selected.school.name}</strong>
          </div>
          <div className="text-xs text-[#6B6560]">
            아이디: {selected.school.username} · 연락처: {selected.school.phone}
          </div>
        </div>
      )}
    </div>
  );
}
