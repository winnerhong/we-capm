"use client";

// 기관 하단 홈페이지 배너 편집 폼.
// - 배너 문구, 링크 URL, 배너 이미지 (선택) 입력.
// - 모두 비어있어도 OK (그러면 배너 비노출).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateHomepageBannerAction } from "@/lib/org-banner/actions";
import { CoverImagePicker } from "@/components/cover-image-picker";
import { HomepageBannerDisplay } from "@/components/homepage-banner-display";

type Props = {
  orgId: string;
  initial: {
    text: string;
    url: string;
    imageUrl: string;
  };
};

export function HomepageBannerEditor({ orgId, initial }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initial.text);
  const [url, setUrl] = useState(initial.url);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData();
    fd.set("homepage_banner_text", text);
    fd.set("homepage_banner_url", url);
    fd.set("homepage_banner_image_url", imageUrl);
    startTransition(async () => {
      const r = await updateHomepageBannerAction(orgId, fd);
      if (r.ok) {
        setMsg({ kind: "ok", text: "저장됐어요" });
        router.refresh();
      } else {
        setMsg({ kind: "err", text: r.error ?? "저장 실패" });
      }
    });
  };

  const previewBanner =
    text.trim() || imageUrl.trim() || url.trim()
      ? {
          text: text.trim() || null,
          url: url.trim() || null,
          imageUrl: imageUrl.trim() || null,
        }
      : null;

  return (
    <section className="rounded-3xl border border-[#D4E4BC] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          🔗
        </span>
        <h2 className="text-base font-bold text-[#2D5A3D]">
          하단 홈페이지 배너
        </h2>
      </div>
      <p className="mb-4 text-[11px] text-[#8B7F75]">
        참가자가 보는 토리로 페이지(홈·일정·초대장 등) 하단에 외부 홈페이지로
        이동할 수 있는 배너가 표시돼요. 모든 필드 비워두면 노출되지 않습니다.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#2D5A3D]">
            배너 문구
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
            배너 이미지 <span className="font-normal text-[#8B7F75]">(권장: 720 x 120px)</span>
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

        {/* 미리보기 */}
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
    </section>
  );
}
