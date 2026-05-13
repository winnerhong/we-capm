// 기관 "하단 홈페이지 배너" 표시 컴포넌트.
// - 참가자 토리로 사이트 푸터 / 초대장 페이지 푸터에서 사용.
// - 텍스트만 있어도 표시 가능. 이미지 있으면 배경으로.
// - 모든 값 비어있으면 null 반환 → 노출 X.

import type { OrgHomepageBanner } from "@/lib/org-banner/queries";

type Props = {
  banner: OrgHomepageBanner | null;
  /** 외부 페이지 영역에 자연스럽게 녹도록 추가 클래스. */
  className?: string;
};

export function HomepageBannerDisplay({ banner, className = "" }: Props) {
  if (!banner) return null;
  const hasBannerContent =
    Boolean(banner.subtitle || banner.text || banner.imageUrl || banner.url);
  const hasFooter = Boolean(banner.footerBrand || banner.footerMeta);
  if (!hasBannerContent && !hasFooter) return null;

  const hasImage = Boolean(banner.imageUrl);
  const subtitle = banner.subtitle?.trim() || null;
  const text = banner.text || "홈페이지 방문하기 →";
  const href = banner.url ?? null;
  const footerBrand = banner.footerBrand?.trim() || null;
  const footerMeta = banner.footerMeta?.trim() || null;

  // 클릭 가능하면 <a>, 아니면 <div>
  const Wrapper = href ? "a" : "div";
  const wrapperProps = href
    ? {
        href,
        target: "_blank" as const,
        rel: "noopener noreferrer" as const,
      }
    : {};

  return (
    <div className={`w-full ${className}`}>
      {hasBannerContent && (
        <Wrapper
          {...wrapperProps}
          aria-label={text}
          className="group block w-full overflow-hidden rounded-2xl shadow-md transition hover:shadow-lg"
          style={
            hasImage
              ? {
                  backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${banner.imageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div
            className={`relative flex min-h-[64px] flex-col items-center justify-center gap-0.5 px-4 py-3 text-center ${
              hasImage
                ? "text-white drop-shadow-md"
                : "bg-gradient-to-r from-[#3A7A52] via-[#4A7C59] to-[#2D5A3D] text-white"
            }`}
          >
            {subtitle && (
              <span className="text-[11px] font-medium leading-snug text-white/85 break-words">
                {subtitle}
              </span>
            )}
            <span className="break-words text-sm font-bold leading-snug">
              {text}
            </span>
          </div>
        </Wrapper>
      )}

      {/* ─── 푸터 (브랜드 강조 + 메타 멀티라인) ─── */}
      {(footerBrand || footerMeta) && (
        <div
          className={`text-center text-[#6B6560] ${
            hasBannerContent ? "mt-4 border-t border-[#E5E5E5] pt-4" : ""
          }`}
        >
          {footerBrand && (
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8B7F75]">
              {footerBrand}
            </p>
          )}
          {footerMeta && (
            <p
              className={`whitespace-pre-line text-[11px] leading-relaxed ${
                footerBrand ? "mt-1.5" : ""
              }`}
            >
              {footerMeta}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
