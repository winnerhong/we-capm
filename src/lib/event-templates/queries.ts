import { createClient } from "@/lib/supabase/server";
import type {
  PartnerEventTemplate,
  PartnerEventTemplateItem,
  PartnerEventTemplateTimetableSlot,
} from "./types";

type AnyDB = {
  from: (t: string) => unknown;
};

export async function listPartnerTemplates(
  partnerId: string
): Promise<PartnerEventTemplate[]> {
  const supabase = await createClient();
  const { data } = await (
    (supabase as unknown as AnyDB).from("partner_event_templates") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: boolean) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<{
              data: PartnerEventTemplate[] | null;
              error: unknown;
            }>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("partner_id", partnerId)
    .eq("is_deleted", false)
    .order("updated_at", { ascending: false });
  return data ?? [];
}

export async function getTemplateById(
  templateId: string
): Promise<PartnerEventTemplate | null> {
  const supabase = await createClient();
  const { data } = await (
    (supabase as unknown as AnyDB).from("partner_event_templates") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: PartnerEventTemplate | null;
            error: unknown;
          }>;
        };
      };
    }
  )
    .select("*")
    .eq("id", templateId)
    .maybeSingle();
  return data;
}

export async function listTemplateTimetable(
  templateId: string
): Promise<PartnerEventTemplateTimetableSlot[]> {
  const supabase = await createClient();
  const { data } = await (
    (supabase as unknown as AnyDB).from(
      "partner_event_template_timetable_slots"
    ) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<{
              data: PartnerEventTemplateTimetableSlot[] | null;
              error: unknown;
            }>;
          };
        };
      };
    }
  )
    .select("*")
    .eq("template_id", templateId)
    .order("offset_min", { ascending: true })
    .order("display_order", { ascending: true });
  return data ?? [];
}

export async function listTemplateItems(
  templateId: string
): Promise<PartnerEventTemplateItem[]> {
  const supabase = await createClient();
  const { data } = await (
    (supabase as unknown as AnyDB).from("partner_event_template_items") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{
            data: PartnerEventTemplateItem[] | null;
            error: unknown;
          }>;
        };
      };
    }
  )
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function listAssignmentsForTemplate(
  templateId: string
): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await (
    (supabase as unknown as AnyDB).from(
      "partner_event_template_assignments"
    ) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{
          data: { org_id: string }[] | null;
          error: unknown;
        }>;
      };
    }
  )
    .select("org_id")
    .eq("template_id", templateId);
  return (data ?? []).map((r) => r.org_id);
}

/**
 * 기관(org)이 카탈로그에서 볼 수 있는 templates (PUBLISHED only):
 *   visibility=ALL  OR (visibility=SELECTED AND assignments.org_id=?)
 */
export async function listAvailableTemplatesForOrg(
  orgId: string
): Promise<PartnerEventTemplate[]> {
  const supabase = await createClient();

  const allBuilder = (supabase as unknown as AnyDB).from(
    "partner_event_templates"
  ) as unknown as {
    select: (c: string) => unknown;
  };
  const { data: all } = (await (allBuilder.select("*") as unknown as {
    eq: (k: string, v: unknown) => {
      eq: (k: string, v: unknown) => {
        eq: (k: string, v: unknown) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => Promise<{
            data: PartnerEventTemplate[] | null;
            error: unknown;
          }>;
        };
      };
    };
  })
    .eq("is_deleted", false)
    .eq("status", "PUBLISHED")
    .eq("visibility", "ALL")
    .order("updated_at", { ascending: false })) as {
    data: PartnerEventTemplate[] | null;
    error: unknown;
  };

  const { data: assigned } = await (
    (supabase as unknown as AnyDB).from(
      "partner_event_template_assignments"
    ) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{
          data: { template_id: string }[] | null;
          error: unknown;
        }>;
      };
    }
  )
    .select("template_id")
    .eq("org_id", orgId);

  const assignedIds = (assigned ?? []).map((r) => r.template_id);
  let assignedTemplates: PartnerEventTemplate[] = [];
  if (assignedIds.length > 0) {
    const atBuilder = (supabase as unknown as AnyDB).from(
      "partner_event_templates"
    ) as unknown as {
      select: (c: string) => unknown;
    };
    const { data: at } = (await (atBuilder.select("*") as unknown as {
      eq: (k: string, v: unknown) => {
        eq: (k: string, v: unknown) => {
          eq: (k: string, v: unknown) => {
            in: (k: string, v: string[]) => Promise<{
              data: PartnerEventTemplate[] | null;
              error: unknown;
            }>;
          };
        };
      };
    })
      .eq("is_deleted", false)
      .eq("status", "PUBLISHED")
      .eq("visibility", "SELECTED")
      .in("id", assignedIds)) as {
      data: PartnerEventTemplate[] | null;
      error: unknown;
    };
    assignedTemplates = at ?? [];
  }

  // dedupe by id
  const map = new Map<string, PartnerEventTemplate>();
  for (const t of all ?? []) map.set(t.id, t);
  for (const t of assignedTemplates) map.set(t.id, t);
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}
