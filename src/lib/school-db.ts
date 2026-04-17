import { createClient } from "@supabase/supabase-js";

const SCHOOL_SUPABASE_URL = "https://yavjouolvxgkgaxaihkv.supabase.co";
const SCHOOL_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhdmpvdW9sdnhna2dheGFpaGt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM1MTgxMCwiZXhwIjoyMDg2OTI3ODEwfQ.RgVI6uo4KJWxm5kYog6g_09GOMpKscbsqBX45YRzT20";

let cached: ReturnType<typeof createClient> | null = null;

export function getSchoolClient() {
  if (!cached) {
    cached = createClient(SCHOOL_SUPABASE_URL, SCHOOL_SUPABASE_KEY);
  }
  return cached;
}

export interface School {
  id: number;
  name: string;
  username: string;
  password: string;
  phone: string;
  representative: string;
  district: string;
}

export async function getAllSchools(): Promise<School[]> {
  const supabase = getSchoolClient();
  const { data } = await supabase
    .from("schools")
    .select("id, name, username, password, phone, representative, district")
    .order("name");
  return (data ?? []) as School[];
}

export async function findSchoolByUsername(username: string): Promise<School | null> {
  const supabase = getSchoolClient();
  const { data } = await supabase
    .from("schools")
    .select("id, name, username, password, phone, representative, district")
    .eq("username", username)
    .limit(1);
  return (data?.[0] as unknown as School) ?? null;
}

export interface ExternalEvent {
  id: number;
  event_title: string;
  school_name: string;
  school_id: number;
  location_name: string;
  start_time: string;
  end_time: string;
  event_status: string;
  family_count: number | null;
  school_username: string;
  school_password: string;
}

export async function getExternalEvents(): Promise<ExternalEvent[]> {
  const supabase = getSchoolClient();

  type RawEvent = { id: number; event_title: string; school_id: number; location_id: number; start_time: string; end_time: string; event_status: string; family_count: number | null };

  const { data: raw } = await supabase
    .from("events")
    .select("id, event_title, school_id, location_id, start_time, end_time, event_status, family_count")
    .eq("is_deleted", false)
    .order("start_time", { ascending: false })
    .limit(100);

  const events = (raw ?? []) as unknown as RawEvent[];
  if (events.length === 0) return [];

  const schoolIds = [...new Set(events.map((e) => e.school_id).filter(Boolean))];
  const locationIds = [...new Set(events.map((e) => e.location_id).filter(Boolean))];

  const [{ data: schools }, { data: locations }] = await Promise.all([
    schoolIds.length ? supabase.from("schools").select("id, name, username, password").in("id", schoolIds) : { data: [] },
    locationIds.length ? supabase.from("locations").select("id, name").in("id", locationIds) : { data: [] },
  ]);

  const schoolMap = new Map((schools ?? []).map((s: Record<string, unknown>) => [s.id, s]));
  const locationMap = new Map((locations ?? []).map((l: Record<string, unknown>) => [l.id, l]));

  return events.map((e) => {
    const school = schoolMap.get(e.school_id) as Record<string, string> | undefined;
    const location = locationMap.get(e.location_id) as Record<string, string> | undefined;
    return {
      id: e.id,
      event_title: e.event_title ?? "",
      school_name: school?.name ?? "",
      school_id: e.school_id,
      location_name: location?.name ?? "",
      start_time: e.start_time ?? "",
      end_time: e.end_time ?? "",
      event_status: e.event_status ?? "",
      family_count: e.family_count,
      school_username: school?.username ?? "",
      school_password: school?.password ?? "1234",
    };
  });
}
