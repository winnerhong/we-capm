import { getAllSchools, getExternalEvents } from "@/lib/school-db";
import { createClient } from "@/lib/supabase/server";
import { NewEventForm } from "./new-event-form";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const supabase = await createClient();

  const [schools, extEvents, orgsRes] = await Promise.all([
    getAllSchools(),
    getExternalEvents(),
    (supabase.from("partner_orgs" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (c: string, o: { ascending: boolean }) => Promise<{
            data:
              | Array<{
                  id: string;
                  org_name: string;
                  auto_username: string | null;
                  representative_phone: string | null;
                  org_type: string | null;
                }>
              | null;
          }>;
        };
      };
    })
      .select("id, org_name, auto_username, representative_phone, org_type")
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false }),
  ]);

  const orgs = (orgsRes.data ?? [])
    .filter((o) => !!o.auto_username)
    .map((o) => ({
      id: o.id,
      org_name: o.org_name,
      auto_username: o.auto_username as string,
      representative_phone: o.representative_phone,
      org_type: o.org_type,
    }));

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <span>🌲</span>
          <span>새 숲길 행사 만들기</span>
        </h1>
        <p className="mt-1 text-sm text-white/80">도토리 탐험가들과 함께할 새로운 숲길을 열어봐요</p>
      </div>
      <NewEventForm
        schools={schools.map((s) => ({
          id: s.id,
          name: s.name,
          username: s.username,
          phone: s.phone ?? "",
          district: s.district ?? "",
        }))}
        orgs={orgs}
        externalEvents={extEvents}
      />
    </div>
  );
}
