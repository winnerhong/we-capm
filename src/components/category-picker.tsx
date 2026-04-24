"use client";

import { useState, useRef, useEffect } from "react";

interface BuiltInCategory {
  value: string;
  label: string;
  icon: string;
}

const BUILT_IN: BuiltInCategory[] = [
  { value: "FOREST", label: "숲 체험", icon: "🌲" },
  { value: "CAMPING", label: "캠핑", icon: "⛺" },
  { value: "KIDS", label: "유아·키즈", icon: "👶" },
  { value: "FAMILY", label: "가족", icon: "👨‍👩‍👧" },
  { value: "TEAM", label: "기업 팀빌딩", icon: "🏢" },
  { value: "ART", label: "아트·공예", icon: "🎨" },
];

interface Props {
  name: string;
  defaultValue?: string;
  customCategories?: string[];
  required?: boolean;
}

export function CategoryPicker({
  name,
  defaultValue = "FOREST",
  customCategories = [],
  required,
}: Props) {
  const initialCustom = customCategories.slice();
  if (
    defaultValue &&
    !BUILT_IN.some((b) => b.value === defaultValue) &&
    !initialCustom.includes(defaultValue)
  ) {
    initialCustom.push(defaultValue);
  }

  const [value, setValue] = useState<string>(defaultValue);
  const [customs, setCustoms] = useState<string[]>(initialCustom);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState("🏷️");
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) {
      newInputRef.current?.focus();
    }
  }, [creating]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === "__NEW__") {
      setCreating(true);
      return;
    }
    setValue(v);
  };

  const handleCreate = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) {
      newInputRef.current?.focus();
      return;
    }
    const combined = `${newIcon} ${trimmed}`.trim();
    if (!customs.includes(combined)) {
      setCustoms((prev) => [...prev, combined]);
    }
    setValue(combined);
    setNewLabel("");
    setNewIcon("🏷️");
    setCreating(false);
  };

  const COMMON_ICONS = [
    "🏷️",
    "🌳",
    "🌊",
    "🎨",
    "🎪",
    "🧘",
    "🏃",
    "🎯",
    "🎓",
    "🧩",
    "🍃",
    "🌸",
    "🔥",
    "🏕️",
  ];

  if (creating) {
    return (
      <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
        <input type="hidden" name={name} value={value} />
        <p className="mb-2 text-xs font-semibold text-sky-800">
          ➕ 새 카테고리 만들기
        </p>
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              className="rounded-lg border border-[#D4E4BC] bg-white px-2 py-2 text-lg focus:border-[#3A7A52] focus:outline-none"
              aria-label="아이콘 선택"
            >
              {COMMON_ICONS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <input
              ref={newInputRef}
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="카테고리 이름 (예: 야생화 관찰)"
              maxLength={40}
              className="flex-1 rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setCreating(false);
                  setNewLabel("");
                }
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewLabel("");
              }}
              className="rounded-lg border border-[#D4E4BC] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B6560] hover:bg-[#F5F1E8]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="rounded-lg bg-[#2D5A3D] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#3A7A52]"
            >
              ➕ 추가
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <select
        required={required}
        value={value}
        onChange={handleSelectChange}
        className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
      >
        <optgroup label="기본 카테고리">
          {BUILT_IN.map((o) => (
            <option key={o.value} value={o.value}>
              {o.icon} {o.label}
            </option>
          ))}
        </optgroup>
        {customs.length > 0 && (
          <optgroup label="내 카테고리">
            {customs.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </optgroup>
        )}
        <option value="__NEW__">➕ 새 카테고리 만들기…</option>
      </select>
    </div>
  );
}
