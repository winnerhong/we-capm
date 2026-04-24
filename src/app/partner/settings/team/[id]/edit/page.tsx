import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartnerWithRole } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  ROLE_META,
  ROLE_OPTIONS,
  STATUS_META,
  type TeamMemberRow,
  type TeamRole,
} from "@/lib/team/types";
import {
  updateTeamMemberAction,
  suspendTeamMemberAction,
  reactivateTeamMemberAction,
  deleteTeamMemberAction,
  regenerateTeamMemberPasswordAction,
} from "../../actions";
import { ConfirmForm } from "../../confirm-form";

export const dynamic = "force-dynamic";

async function loadMember(
  id: string,
  partnerId: string
): Promise<TeamMemberRow | null> {
  const supabase = await createClient();
  try {
    const { data } = await (
      supabase.from("partner_team_members") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              maybeSingle: () => Promise<{ data: TeamMemberRow | null }>;
            };
          };
        };
      }
    )
      .select(
        "id,partner_id,name,email,phone,username,role,status,invited_by,invited_at,activated_at,last_login_at,suspended_at,memo,created_at,updated_at"
      )
      .eq("id", id)
      .eq("partner_id", partnerId)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default async function EditTeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let session;
  try {
    session = await requirePartnerWithRole(["OWNER"]);
  } catch {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
        <div className="mb-2 text-3xl" aria-hidden>
          🔒
        </div>
        <h1 className="text-lg font-bold text-rose-900">
          이 페이지는 OWNER만 접근할 수 있어요
        </h1>
        <Link
          href="/partner/dashboard"
          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100"
        >
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  const { id } = await params;
  const member = await loadMember(id, session.id);
  if (!member) notFound();

  const isOwner = member.role === "OWNER";
  const roleMeta = ROLE_META[member.role];
  const statusMeta = STATUS_META[member.status];
  const isActive = member.status === "ACTIVE";
  const isSuspended = member.status === "SUSPENDED";
  const update = updateTeamMemberAction.bind(null, member.id);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link href="/partner/settings" className="hover:text-[#2D5A3D]">
          설정
        </Link>
        <span className="mx-2">/</span>
        <Link
          href="/partner/settings/team"
          className="hover:text-[#2D5A3D]"
        >
          팀 관리
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#2D5A3D]">팀원 수정</span>
      </nav>

      {/* 헤더 */}
      <header className="rounded-3xl border border-[#D4E4BC] bg-gradient-to-br from-[#E8F0E4] via-white to-[#FAE7D0] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            ✏️
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#2D5A3D] md:text-2xl">
              팀원 수정
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6B6560]">
              <span className="truncate font-semibold text-[#2D5A3D]">
                {member.name}
              </span>
              <span className="font-mono">@{member.username}</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${roleMeta.color}`}
              >
                <span aria-hidden>{roleMeta.icon}</span>
                <span>{roleMeta.label}</span>
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.color}`}
              >
                <span aria-hidden>{statusMeta.icon}</span>
                <span>{statusMeta.label}</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 편집 폼 */}
      <form
        action={update}
        className="space-y-5 rounded-2xl border border-[#D4E4BC] bg-white p-5 shadow-sm md:p-6"
      >
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span aria-hidden>🌿</span>
            <span>기본 정보</span>
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                이름 <span className="text-rose-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                defaultValue={member.name}
                required
                autoComplete="name"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={member.email ?? ""}
                autoComplete="email"
                inputMode="email"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                휴대폰
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={member.phone ?? ""}
                autoComplete="tel"
                inputMode="tel"
                placeholder="010-0000-0000"
                className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
            </div>

          </div>
        </section>

        {/* 🔐 로그인 계정 */}
        <section className="space-y-3 rounded-2xl border border-[#D4A15A] bg-[#FFF8F0] p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#8B6B3F]">
            <span aria-hidden>🔐</span>
            <span>로그인 계정</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label
                htmlFor="username"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                아이디
              </label>
              <input
                id="username"
                name="username"
                type="text"
                defaultValue={member.username}
                autoComplete="off"
                className="w-full rounded-xl border border-[#D4A15A] bg-white px-3 py-2.5 font-mono text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                변경 시 팀원에게 새 아이디를 전달하세요 (숫자만 저장)
              </p>
            </div>

            <div>
              <label
                htmlFor="new_password"
                className="mb-1 block text-xs font-semibold text-[#6B6560]"
              >
                새 비밀번호
              </label>
              <input
                id="new_password"
                name="new_password"
                type="text"
                autoComplete="new-password"
                placeholder="비워두면 변경 안 됨 · 4자 이상"
                className="w-full rounded-xl border border-[#D4A15A] bg-white px-3 py-2.5 font-mono text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
              />
              <p className="mt-1 text-[11px] text-[#8B7F75]">
                🔑 입력한 값이 즉시 적용됩니다 · 팀원에게 전달 필수
              </p>
            </div>
          </div>
        </section>

        {/* 역할 */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]">
            <span aria-hidden>🎯</span>
            <span>역할</span>
          </h2>

          {isOwner ? (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
              <span aria-hidden className="mr-1">
                👑
              </span>
              OWNER 권한은 이 화면에서 변경할 수 없어요. 별도의 이전 절차가
              필요합니다.
            </div>
          ) : (
            <fieldset
              className="grid gap-3 md:grid-cols-2"
              aria-label="역할 선택"
            >
              {ROLE_OPTIONS.map((role) => {
                const meta = ROLE_META[role];
                return (
                  <label
                    key={role}
                    className="group cursor-pointer rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm transition-all has-[:checked]:border-violet-400 has-[:checked]:bg-violet-50 has-[:checked]:ring-2 has-[:checked]:ring-violet-300/50 hover:border-[#4A7C59]"
                  >
                    <input
                      type="radio"
                      name="role"
                      value={role}
                      defaultChecked={member.role === role}
                      required
                      className="sr-only"
                    />
                    <div className="flex items-start gap-3">
                      <span aria-hidden className="text-2xl">
                        {meta.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#2D5A3D]">
                            {meta.label}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}
                          >
                            {role}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-[#6B6560]">
                          {meta.desc}
                        </p>
                      </div>
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#D4E4BC] bg-white text-[11px] text-transparent transition-colors group-has-[:checked]:border-violet-600 group-has-[:checked]:bg-violet-600 group-has-[:checked]:text-white"
                      >
                        ✓
                      </span>
                    </div>
                  </label>
                );
              })}
            </fieldset>
          )}
        </section>

        {/* 메모 */}
        <section className="space-y-2">
          <label
            htmlFor="memo"
            className="flex items-center gap-2 text-base font-bold text-[#2D5A3D]"
          >
            <span aria-hidden>📝</span>
            <span>메모</span>
          </label>
          <textarea
            id="memo"
            name="memo"
            rows={3}
            defaultValue={member.memo ?? ""}
            placeholder="이 팀원에 대한 메모"
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </section>

        {/* 메타 */}
        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] p-3 text-[11px] md:grid-cols-4">
          <div>
            <dt className="font-semibold text-[#6B6560]">초대일</dt>
            <dd className="mt-0.5 text-[#2D5A3D]">
              {formatDateTime(member.invited_at)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#6B6560]">활성화</dt>
            <dd className="mt-0.5 text-[#2D5A3D]">
              {formatDateTime(member.activated_at)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#6B6560]">마지막 로그인</dt>
            <dd className="mt-0.5 text-[#2D5A3D]">
              {formatDateTime(member.last_login_at)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#6B6560]">수정일</dt>
            <dd className="mt-0.5 text-[#2D5A3D]">
              {formatDateTime(member.updated_at)}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2 md:flex-row md:justify-end">
          <Link
            href="/partner/settings/team"
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#D4E4BC] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
          >
            취소
          </Link>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D5A3D] to-[#3A7A52] px-4 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#234a30] hover:to-[#2D5A3D]"
          >
            💾 변경사항 저장
          </button>
        </div>
      </form>

      {/* 위험 액션 (OWNER 대상일 때는 숨김) */}
      {!isOwner && (
        <section className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-5 shadow-sm md:p-6">
          <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-amber-900">
            <span aria-hidden>⚠️</span>
            <span>위험 액션</span>
          </h2>
          <p className="mb-4 text-xs text-amber-800">
            아래 작업은 즉시 반영돼요. 실수하지 않도록 신중히 선택해 주세요.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            {/* 상태별 토글 */}
            {isActive && (
              <DangerAction
                icon="🚫"
                title="계정 정지"
                desc="로그인이 차단되고 모든 세션이 해제돼요. 언제든 재활성화할 수 있어요."
                action={suspendTeamMemberAction.bind(null, member.id)}
                buttonLabel="정지하기"
                tone="amber"
              />
            )}
            {isSuspended && (
              <DangerAction
                icon="✅"
                title="재활성화"
                desc="정지를 해제하고 로그인을 다시 허용합니다."
                action={reactivateTeamMemberAction.bind(null, member.id)}
                buttonLabel="재활성화"
                tone="emerald"
              />
            )}

            <DangerAction
              icon="🔑"
              title="비밀번호 재발급"
              desc="새 임시 비밀번호가 발급되고 기존 비번은 무효화돼요. 발급 즉시 복사해 전달하세요."
              action={regenerateTeamMemberPasswordAction.bind(null, member.id)}
              buttonLabel="재발급"
              tone="sky"
            />

            <DangerAction
              icon="🗑"
              title="팀원 삭제"
              desc="해당 팀원을 목록에서 제거해요. (소프트 삭제 · 감사 로그는 보존)"
              action={deleteTeamMemberAction.bind(null, member.id)}
              buttonLabel="삭제하기"
              tone="rose"
              confirm="정말 이 팀원을 삭제할까요? 되돌릴 수 없어요."
            />
          </div>
        </section>
      )}
    </div>
  );
}

function DangerAction({
  icon,
  title,
  desc,
  action,
  buttonLabel,
  tone,
  confirm,
}: {
  icon: string;
  title: string;
  desc: string;
  action: (formData: FormData) => void | Promise<void>;
  buttonLabel: string;
  tone: "amber" | "emerald" | "sky" | "rose";
  confirm?: string;
}) {
  const toneMap = {
    amber:
      "border-amber-300 bg-white text-amber-900 hover:bg-amber-100 focus-visible:ring-amber-400/50",
    emerald:
      "border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100 focus-visible:ring-emerald-400/50",
    sky: "border-sky-300 bg-white text-sky-900 hover:bg-sky-100 focus-visible:ring-sky-400/50",
    rose: "border-rose-300 bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-400/50",
  } as const;

  const btnClass = toneMap[tone];

  return (
    <div className="rounded-xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#2D5A3D]">
        <span aria-hidden>{icon}</span>
        <span>{title}</span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-[#6B6560]">{desc}</p>
      <ConfirmForm action={action} confirm={confirm}>
        <button
          type="submit"
          className={`inline-flex w-full items-center justify-center gap-1 rounded-xl border-2 px-3 py-2 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 ${btnClass}`}
        >
          {icon} {buttonLabel}
        </button>
      </ConfirmForm>
    </div>
  );
}
