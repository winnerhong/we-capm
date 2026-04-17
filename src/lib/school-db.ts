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
