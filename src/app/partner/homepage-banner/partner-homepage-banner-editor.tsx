"use client";

// 지사 측 — 자기 기관의 하단 홈페이지 배너 편집 폼.
// 기관 측(HomepageBannerEditor) 와 거의 동일하지만 partner action 호출.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePartnerHomepageBannerAction } from "./actions";
import { CoverImagePicker } from "@/components/cover-image-picker";
import { HomepageBannerDisplay } from "@/components/homepage-banner-display";

type Props = {
  orgId: string;
  initial: {
    subtitle: string;
    text: string;
    url: string;
    imageUrl: string;
    footerBrand: string;
    footerMeta: string;
  };
};

export function PartnerHomepageBannerEditor({ orgId, initial }: Props) {
  const router = useRouter();
  const [subtitle, setSubtitle] = useState(initial.subtitle);
  const [text, setText] = useState(initial.text);
  const [url, setUrl] = useState(initial.url);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl);
  const [footerBrand, setFooterBrand] = useState(initial.footerBrand);
  const [footerMeta, setFooterMeta] = useState(initial.footerMeta);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData();
    fd.set("homepage_banner_subtitle", subtitle);
    fd.set("homepage_banner_text", text);
    fd.set("homepage_banner_url", url);
    fd.set("homepage_banner_image_url", imageUrl);
    fd.set("homepage_banner_footer_brand", footerBrand);
    fd.set("homepage_banner_footer_meta", footerMeta);
    startTransition(async () => {
      const r = await updatePartnerHomepageBannerAction(orgId, fd);
      if (r.ok) {
        setMsg({ kind: "ok", text: "저장됐어요" });
        router.refresh();
      } else {
        setMsg({ kind: "err", text: r.error ?? "저장 실패" });
      }
    });
  };

  const previewBanner =
    subtitle.trim() ||
    text.trim() ||
    imageUrl.trim() ||
    url.trim() ||
    footerBrand.trim() ||
    footerMeta.trim()
      ? {
          subtitle: subtitle.trim() || null,
          text: text.trim() || null,
          url: url.trim() || null,
          imageUrl: imageUrl.trim() || null,
          footerBrand: footerBrand.trim() || null,
          footerMeta: footerMeta.trim() || null,
        }
      : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
          보조 안내문 <span className="font-normal text-[#8B7F75]">(메인 문구 위에 작게 표시)</span>
        </label>
        <input
          type="text"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          maxLength={200}
          placeholder="예) 더 많은 행사정보 및 체육수업이 궁금하시다면?"
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
          배너 문구 <span className="font-normal text-[#8B7F75]">(메인)</span>
        </label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          placeholder="예) 위너키즈스포츠 홈페이지 방문하기 →"
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
          링크 URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={500}
          placeholder="예) https://naver.me/xTT6UAme"
          className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
          배너 이미지{" "}
          <span className="font-normal text-[#8B7F75]">(권장: 720 x 120px)</span>
        </label>
        <CoverImagePicker
          value={imageUrl}
          onChange={setImageUrl}
          bucket="preset-covers"
          pathPrefix="org-banners"
          hint="PNG / JPG / WEBP · 720 x 120px 권장"
          compact
        />
        <p className="mt-1 text-[10px] text-[#8B7F75]">
          이미지가 없으면 기본 그라데이션 배너로 표시됩니다.
        </p>
      </div>

      {/* ─── 배너 아래 푸터 (회사 정보) ─── */}
      <div className="rounded-2xl border-2 border-dashed border-[#D4E4BC] bg-[#FFF8F0]/40 p-3">
        <p className="mb-2 text-[11px] font-bold text-[#2D5A3D]">
          🏢 배너 아래 푸터 <span className="font-normal text-[#8B7F75]">(선택 — 회사 정보 등)</span>
        </p>
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
              브랜드 한 줄 <span className="font-normal text-[#8B7F75]">(UPPERCASE 강조)</span>
            </label>
            <input
              type="text"
              value={footerBrand}
              onChange={(e) => setFooterBrand(e.target.value)}
              maxLength={100}
              placeholder="예) WE ARE THE WINNER"
              className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
              본문 (여러 줄 가능)
            </label>
            <textarea
              value={footerMeta}
              onChange={(e) => setFooterMeta(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={"예)\n위너키즈스포츠 · 1800-7581\n(주) 위너그룹"}
              className="w-full rounded-xl border border-[#D4E4BC] bg-white px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#3A7A52] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
            />
            <p className="mt-1 text-[10px] text-[#8B7F75]">
              💡 줄바꿈이 그대로 표시됩니다.
            </p>
          </div>
        </div>
      </div>

      {previewBanner && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-[#6B6560]">
            👁 미리보기
          </p>
          <HomepageBannerDisplay banner={previewBanner} />
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#3A7A52] disabled:opacity-50"
        >
          {pending ? "저장 중..." : "💾 저장"}
        </button>
        {msg && (
          <span
            className={`text-xs ${
              msg.kind === "ok" ? "text-emerald-700" : "text-rose-700"
            }`}
            role={msg.kind === "err" ? "alert" : "status"}
          >
            {msg.kind === "ok" ? "✅" : "⚠"} {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}
