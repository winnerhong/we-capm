import Link from "next/link";
import { requireAppUser } from "@/lib/user-auth-guard";
import {
  isToritalkEnabled,
  loadDiscoverableRoomsForUser,
  loadRoomsForUser,
} from "@/lib/toritalk/queries";
import { fmtFullDateKst } from "@/lib/datetime/kst";
import { JoinRoomButton } from "./join-room-button";

export const dynamic = "force-dynamic";

export default async function ToriTalkHubPage() {
  const user = await requireAppUser();
  const enabled = await isToritalkEnabled(user.orgId);

  if (!enabled) {
    return (
      <div className="space-y-4">
        <Header />
        <section className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/70 p-8 text-center shadow-sm">
          <p className="text-4xl" aria-hidden>
            💤
          </p>
          <p className="mt-3 text-base font-bold text-[#2D5A3D]">
            토리톡이 아직 준비 중이에요
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[#6B6560]">
            기관에서 토리톡을 활성화하면 이 화면에서 채팅을 시작할 수 있어요.
          </p>
          <div className="mt-5">
            <Link
              href="/home"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#234a30]"
            >
              <span aria-hidden>🏠</span>
              <span>홈으로</span>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const [rooms, discoverable] = await Promise.all([
    loadRoomsForUser(user.id),
    loadDiscoverableRoomsForUser(user.id, user.orgId),
  ]);

  return (
    <div className="space-y-5">
      <Header />

      {/* 1) 참여 중인 방 */}
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-bold text-[#2D5A3D]">
          📌 참여 중인 방 ({rooms.length})
        </h2>
        {rooms.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-[#D4E4BC] bg-white/70 p-6 text-center shadow-sm">
            <p className="text-3xl" aria-hidden>
              🌱
            </p>
            <p className="mt-2 text-sm font-bold text-[#2D5A3D]">
              아직 참여 중인 방이 없어요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              아래 &quot;다른 방 둘러보기&quot; 에서 입장하거나 기관 초대를
              기다려주세요.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rooms.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/tori-talk/${r.id}`}
                  className="block rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition hover:border-[#2D5A3D] hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-[#2D5A3D]">
                        {r.name}
                      </p>
                      {r.description && (
                        <p className="mt-0.5 truncate text-xs text-[#8B7F75]">
                          {r.description}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-bold text-[#2D5A3D]">
                      {r.member_count}명
                    </span>
                  </div>
                  <div className="mt-3 rounded-xl bg-[#FFF8F0] px-3 py-2 text-xs text-[#6B6560]">
                    {r.last_message_preview ? (
                      <span className="line-clamp-1">
                        💬 {r.last_message_preview}
                      </span>
                    ) : (
                      <span>아직 대화가 없어요. 첫 메시지를 남겨보세요!</span>
                    )}
                  </div>
                  {r.last_message_at && (
                    <p className="mt-1 text-[10px] text-[#8B7F75]">
                      {fmtFullDateKst(r.last_message_at)}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2) 다른 방 둘러보기 — discoverable (listed=true 인 미참여 방) */}
      {discoverable.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-[#2D5A3D]">
            🔭 다른 방 둘러보기 ({discoverable.length})
          </h2>
          <ul className="space-y-2">
            {discoverable.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white/60 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#2D5A3D]">
                      {r.name}
                    </p>
                    {r.description && (
                      <p className="mt-0.5 truncate text-[11px] text-[#8B7F75]">
                        {r.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-[#FFF8F0] px-2 py-0.5 text-[10px] font-bold text-[#8B7F75]">
                    {r.member_count}/{r.max_members}명
                  </span>
                </div>

                {r.last_message_preview && (
                  <p className="mt-2 line-clamp-1 rounded-xl bg-[#FFF8F0] px-3 py-2 text-[11px] text-[#6B6560]">
                    💬 {r.last_message_preview}
                  </p>
                )}

                <div className="mt-3">
                  {r.allow_self_join ? (
                    r.member_count >= r.max_members ? (
                      <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                        ⚠ 정원이 가득 찼어요. 기관에 문의해 주세요.
                      </p>
                    ) : (
                      <JoinRoomButton roomId={r.id} roomName={r.name} />
                    )
                  ) : (
                    <p className="rounded-xl bg-[#FFF8F0] px-3 py-2 text-[11px] text-[#6B6560]">
                      🔑 초대 전용 방이에요. 기관 admin 이 추가해야 입장할 수
                      있어요.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Header() {
  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-5 text-white shadow-lg">
      <h1 className="text-xl font-bold">💬 토리톡</h1>
      <p className="mt-2 text-sm text-[#D4E4BC]">
        반별로 함께하는 우리들의 이야기
      </p>
    </section>
  );
}
