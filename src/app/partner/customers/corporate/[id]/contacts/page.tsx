import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartner } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  addContactAction,
  removeContactAction,
  updateContactAction,
  type ContactRole,
} from "../../actions";

export const dynamic = "force-dynamic";

type Contact = {
  id: string;
  company_id: string;
  role: ContactRole | null;
  name: string;
  phone: string | null;
  email: string | null;
  department: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
};

type CompanyLite = {
  id: string;
  partner_id: string;
  company_name: string;
};

const ROLES: Array<{ value: ContactRole; label: string; emoji: string; chip: string }> = [
  { value: "HR", label: "인사 (HR)", emoji: "👔", chip: "bg-sky-50 text-sky-800 border-sky-200" },
  { value: "ESG", label: "ESG", emoji: "🌱", chip: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { value: "FINANCE", label: "재무", emoji: "💰", chip: "bg-amber-50 text-amber-800 border-amber-200" },
  { value: "CEO", label: "대표", emoji: "👑", chip: "bg-violet-50 text-violet-800 border-violet-200" },
  { value: "MARKETING", label: "마케팅", emoji: "📢", chip: "bg-rose-50 text-rose-800 border-rose-200" },
  { value: "OTHER", label: "기타", emoji: "👤", chip: "bg-zinc-50 text-zinc-700 border-zinc-200" },
];

const ROLE_META_BY_VALUE = Object.fromEntries(ROLES.map((r) => [r.value, r])) as Record<
  ContactRole,
  (typeof ROLES)[number]
>;

function formatPhone(raw: string | null): string {
  if (!raw) return "-";
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

async function loadCompany(id: string): Promise<CompanyLite | null> {
  const supabase = await createClient();
  const { data } = await (
    supabase.from("partner_companies" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: CompanyLite | null }>;
        };
      };
    }
  )
    .select("id,partner_id,company_name")
    .eq("id", id)
    .maybeSingle();

  return data;
}

async function loadContacts(companyId: string): Promise<Contact[]> {
  const supabase = await createClient();
  const { data } = await (
    supabase.from("partner_company_contacts" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (k: string, o: { ascending: boolean }) => {
            order: (k: string, o: { ascending: boolean }) => Promise<{
              data: Contact[] | null;
            }>;
          };
        };
      };
    }
  )
    .select(
      "id,company_id,role,name,phone,email,department,is_primary,notes,created_at"
    )
    .eq("company_id", companyId)
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });

  return data ?? [];
}

export default async function ContactsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const partner = await requirePartner();
  const { id } = await params;

  const company = await loadCompany(id);
  if (!company || company.partner_id !== partner.id) notFound();

  const contacts = await loadContacts(id);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-xs text-[#8B7F75]">
        <Link href="/partner/dashboard" className="hover:text-[#2D5A3D]">
          대시보드
        </Link>
        <span className="mx-2">/</span>
        <Link
          href="/partner/customers/corporate"
          className="hover:text-[#1E3A5F]"
        >
          기업 고객
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/partner/customers/corporate/${company.id}`}
          className="hover:text-[#1E3A5F]"
        >
          {company.company_name}
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#1E3A5F]">담당자 관리</span>
      </nav>

      {/* Header */}
      <header className="rounded-3xl border border-[#1E3A5F]/20 bg-gradient-to-br from-[#E8F0E4] via-white to-[#DEE7F1] p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            👥
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#1E3A5F] md:text-2xl">
              담당자 관리
            </h1>
            <p className="mt-1 text-xs text-[#6B6560] md:text-sm">
              {company.company_name} · 여러 역할(인사·ESG·재무·대표·마케팅)의
              담당자를 등록하고 관리하세요.
            </p>
          </div>
        </div>
      </header>

      {/* 추가 폼 */}
      <section className="rounded-2xl border border-[#1E3A5F]/20 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1E3A5F]">
          <span aria-hidden>➕</span>
          <span>새 담당자 추가</span>
        </h2>
        <form
          action={async (formData: FormData) => {
            "use server";
            await addContactAction(company.id, formData);
          }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <div>
            <label
              htmlFor="new-name"
              className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
            >
              이름 <span className="text-rose-600">*</span>
            </label>
            <input
              id="new-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              placeholder="김담당"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
            />
          </div>

          <div>
            <label
              htmlFor="new-role"
              className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
            >
              역할
            </label>
            <select
              id="new-role"
              name="role"
              defaultValue="HR"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.emoji} {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="new-phone"
              className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
            >
              연락처
            </label>
            <input
              id="new-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="010-XXXX-XXXX"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
            />
          </div>

          <div>
            <label
              htmlFor="new-email"
              className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
            >
              이메일
            </label>
            <input
              id="new-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="contact@example.com"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
            />
          </div>

          <div>
            <label
              htmlFor="new-dept"
              className="mb-1 block text-xs font-semibold text-[#1E3A5F]"
            >
              부서
            </label>
            <input
              id="new-dept"
              name="department"
              type="text"
              autoComplete="off"
              placeholder="예) 인사팀, ESG기획팀"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
            />
          </div>

          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-[#1E3A5F]">
              메모
            </label>
            <input
              id="new-notes"
              name="notes"
              type="text"
              placeholder="비고"
              className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2.5 text-sm text-[#2C2C2C] focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#2C2C2C]">
              <input
                type="checkbox"
                name="is_primary"
                className="h-4 w-4 rounded border-[#D4E4BC] text-[#1E3A5F] focus:ring-[#1E3A5F]/30"
              />
              <span>⭐ 주담당자로 지정</span>
            </label>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#1E3A5F] to-[#2D5A3D] px-4 py-2.5 text-sm font-bold text-white shadow-md hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]/40"
            >
              <span aria-hidden>➕</span>
              <span>담당자 추가</span>
            </button>
          </div>
        </form>
      </section>

      {/* 목록 */}
      <section
        aria-label="담당자 목록"
        className="space-y-3"
      >
        {contacts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D4E4BC] bg-white p-10 text-center">
            <div className="text-5xl" aria-hidden>
              👥
            </div>
            <p className="mt-3 text-sm font-semibold text-[#1E3A5F]">
              등록된 담당자가 없어요
            </p>
            <p className="mt-1 text-xs text-[#6B6560]">
              위 폼에서 담당자를 추가해 주세요.
            </p>
          </div>
        ) : (
          contacts.map((c) => {
            const meta =
              (c.role && ROLE_META_BY_VALUE[c.role]) ?? ROLE_META_BY_VALUE.OTHER;
            return (
              <article
                key={c.id}
                className="rounded-2xl border border-[#1E3A5F]/20 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-[#1E3A5F] truncate">
                        {c.name}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}
                      >
                        {meta.emoji} {meta.label}
                      </span>
                      {c.is_primary && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[#1E3A5F] px-2 py-0.5 text-[10px] font-bold text-white">
                          ⭐ 주담당
                        </span>
                      )}
                    </div>
                    <dl className="mt-2 grid grid-cols-1 gap-1 text-xs text-[#6B6560] md:grid-cols-2">
                      {c.department && (
                        <div>
                          <dt className="inline font-semibold">🏛 부서: </dt>
                          <dd className="inline">{c.department}</dd>
                        </div>
                      )}
                      {c.phone && (
                        <div>
                          <dt className="inline font-semibold">📞 전화: </dt>
                          <dd className="inline">{formatPhone(c.phone)}</dd>
                        </div>
                      )}
                      {c.email && (
                        <div className="md:col-span-2 truncate">
                          <dt className="inline font-semibold">✉️ 이메일: </dt>
                          <dd className="inline">{c.email}</dd>
                        </div>
                      )}
                      {c.notes && (
                        <div className="md:col-span-2">
                          <dt className="inline font-semibold">📝 메모: </dt>
                          <dd className="inline">{c.notes}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {/* 편집 폼 */}
                  <details className="lg:w-[480px] lg:flex-shrink-0">
                    <summary className="cursor-pointer rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-1.5 text-xs font-semibold text-[#6B6560] hover:bg-[#F5F1E8] list-none text-center">
                      ✏️ 편집
                    </summary>
                    <form
                      action={async (formData: FormData) => {
                        "use server";
                        await updateContactAction(c.id, company.id, formData);
                      }}
                      className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2"
                    >
                      <input
                        name="name"
                        type="text"
                        required
                        defaultValue={c.name}
                        placeholder="이름"
                        aria-label="이름"
                        className="w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#1E3A5F] focus:outline-none"
                      />
                      <select
                        name="role"
                        defaultValue={c.role ?? "OTHER"}
                        aria-label="역할"
                        className="w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#1E3A5F] focus:outline-none"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.emoji} {r.label}
                          </option>
                        ))}
                      </select>
                      <input
                        name="phone"
                        type="tel"
                        defaultValue={c.phone ?? ""}
                        placeholder="연락처"
                        aria-label="연락처"
                        className="w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#1E3A5F] focus:outline-none"
                      />
                      <input
                        name="email"
                        type="email"
                        defaultValue={c.email ?? ""}
                        placeholder="이메일"
                        aria-label="이메일"
                        className="w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#1E3A5F] focus:outline-none"
                      />
                      <input
                        name="department"
                        type="text"
                        defaultValue={c.department ?? ""}
                        placeholder="부서"
                        aria-label="부서"
                        className="w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#1E3A5F] focus:outline-none"
                      />
                      <input
                        name="notes"
                        type="text"
                        defaultValue={c.notes ?? ""}
                        placeholder="메모"
                        aria-label="메모"
                        className="w-full rounded-lg border border-[#D4E4BC] bg-white px-3 py-2 text-sm focus:border-[#1E3A5F] focus:outline-none"
                      />
                      <label className="md:col-span-2 inline-flex items-center gap-2 text-xs text-[#2C2C2C]">
                        <input
                          type="checkbox"
                          name="is_primary"
                          defaultChecked={c.is_primary}
                          className="h-4 w-4 rounded border-[#D4E4BC] text-[#1E3A5F] focus:ring-[#1E3A5F]/30"
                        />
                        <span>주담당자</span>
                      </label>
                      <div className="md:col-span-2 flex justify-end">
                        <button
                          type="submit"
                          className="rounded-lg bg-[#1E3A5F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#152b47]"
                        >
                          저장
                        </button>
                      </div>
                    </form>
                  </details>

                  {/* 삭제 */}
                  <form
                    action={async () => {
                      "use server";
                      await removeContactAction(c.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                      aria-label={`${c.name} 담당자 삭제`}
                    >
                      🗑 삭제
                    </button>
                  </form>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
