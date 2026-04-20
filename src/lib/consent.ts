import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConsentState } from "@/components/consent-checkboxes";

export type ConsentInput = Partial<ConsentState> & {
  terms?: boolean;
  privacy?: boolean;
  marketing?: boolean;
  thirdParty?: boolean;
  ageConfirm?: boolean;
};

export async function recordConsent(
  supabase: SupabaseClient,
  params: {
    user_type: string;
    user_identifier: string;
    consent: ConsentInput;
    ip_address?: string;
    user_agent?: string;
  }
) {
  try {
    const sb = supabase as unknown as {
      from: (t: string) => { insert: (d: unknown) => Promise<unknown> };
    };
    await sb.from("user_consents").insert({
      user_type: params.user_type,
      user_identifier: params.user_identifier,
      terms_agreed: !!params.consent.terms,
      terms_version: "1.0",
      privacy_agreed: !!params.consent.privacy,
      privacy_version: "1.0",
      marketing_agreed: !!params.consent.marketing,
      third_party_agreed: !!params.consent.thirdParty,
      age_confirmed: !!params.consent.ageConfirm,
      ip_address: params.ip_address,
      user_agent: params.user_agent,
    });
  } catch (e) {
    console.error("[consent] Failed to record:", e);
  }
}
