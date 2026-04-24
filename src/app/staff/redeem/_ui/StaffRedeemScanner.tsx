"use client";

import { useState, useTransition } from "react";
import { QrScanner } from "@/components/qr-scanner";
import { lookupRedemptionAction } from "../actions";

export function StaffRedeemScanner() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <QrScanner
        expectPrefix="fr_"
        buttonLabel={isPending ? "조회 중…" : "📷 보상 QR 스캔"}
        onScan={(token) => {
          setError(null);
          startTransition(async () => {
            try {
              await lookupRedemptionAction(token);
            } catch (e) {
              // redirect() throws NEXT_REDIRECT — 이건 정상 흐름이라 무시.
              // 실제 에러 메시지만 표면화.
              const msg = e instanceof Error ? e.message : String(e);
              if (!msg.includes("NEXT_REDIRECT")) {
                setError(msg);
              }
            }
          });
        }}
        onError={(msg) => setError(msg)}
      />

      {error && (
        <div
          role="alert"
          className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-800"
        >
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
