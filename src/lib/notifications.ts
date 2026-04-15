import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type DBClient = SupabaseClient<Database>;

export async function notify(
  supabase: DBClient,
  userId: string,
  type: string,
  title: string,
  message: string
) {
  await supabase.from("notifications").insert({ user_id: userId, type, title, message });
}
