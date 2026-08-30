// 기관 상세 「기능」 탭 — 이 기관이 무엇을 쓰는지 지사가 정하는 곳.
//
// 여기 보이는 것은 **지사가 보유한 기능만**이다. 줄 수 없는 것을 스위치로
// 늘어놓아 봐야 눌러도 안 켜지는 칸이 될 뿐이다. 미보유는 아래에 회색 목록으로
// 따로 모아 "본사에 문의" 로 안내한다 — 있는지도 모르는 것보다는 낫다.
//
// 코어(EVENT_BASIC·PARTNER_DASHBOARD)는 아예 안 띄운다. codes.ts 의 ALWAYS_ON 참고.

import { listAllFeatures } from "@/lib/features/queries";
import { FEATURE_CATEGORY_META } from "@/lib/features/types";
import { loadOrgFeatureFlags } from "@/lib/features/org-switches";
import { isAlwaysOn } from "@/lib/features/codes";
import { FeatureSwitch } from "./feature-switch";

export async function FeaturesTab({ orgId }: { orgId: string }) {
  const [features, flags] = await Promise.all([
    listAllFeatures(),
    loadOrgFeatureFlags(orgId),
  ]);

  const catalog = features.filter(
    (f) =>
      !isAlwaysOn(f.code) &&
      f.status !== "DRAFT" &&
      f.status !== "DEPRECATED"
  );

  const owned = catalog.filter((f) => flags.byCode[f.code]?.partnerHas ?? true);
  const notOwned = catalog.filter(
    (f) => flags.loaded && !(flags.byCode[f.code]?.partnerHas ?? true)
  );

  const onCount = owned.filter(
    (f) => flags.byCode[f.code]?.available ?? true
  ).length;

  return (
    <div className="space-y-5">
      {/* 마이그레이션 전이면 조회가 실패한다 — 전부 켜진 것으로 보이므로 그 사실을 말한다. */}
      {!flags.loaded && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
          ⚠ 기능 스위치 테이블을 아직 읽지 못했어요. 지금은 모든 기능이 켜진 것으로
          동작합니다 — 스키마 업데이트(20260831000000)를 먼저 적용해 주세요.
        </p>
      )}

      <header className="rounded-2xl border border-[#D4E4BC] bg-[#F7FAF4] p-4">
        <h2 className="text-sm font-bold text-[#2D5A3D]">
          🎛 이 기관이 쓰는 기능
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[#6B6560]">
          끄면 이 기관의 담당자 화면에서 자물쇠로 바뀌고,{" "}
          <b>참가자 앱에서는 아예 보이지 않습니다.</b> 다시 켜면 그대로 돌아와요
          (만들어 둔 자료는 지워지지 않습니다).
        </p>
        <p className="mt-2 text-[11px] font-semibold text-[#2D5A3D]">
          켜짐 {onCount} / {owned.length}
        </p>
      </header>

      <ul className="grid gap-2 md:grid-cols-2">
        {owned.map((f) => {
          const flag = flags.byCode[f.code];
          return (
            <FeatureSwitch
              key={f.code}
              orgId={orgId}
              code={f.code}
              name={f.name}
              icon={f.icon ?? "🧩"}
              desc={f.short_desc}
              enabled={flag?.available ?? true}
              disabledReason={null}
            />
          );
        })}
      </ul>

      {notOwned.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-bold text-[#8B7F75]">
            🔒 지사가 아직 도입하지 않은 기능
          </h3>
          <ul className="grid gap-2 md:grid-cols-2">
            {notOwned.map((f) => (
              <FeatureSwitch
                key={f.code}
                orgId={orgId}
                code={f.code}
                name={f.name}
                icon={f.icon ?? "🧩"}
                desc={f.short_desc}
                enabled={false}
                disabledReason={`${FEATURE_CATEGORY_META[f.category]} · 본사에 문의해 도입하세요`}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
