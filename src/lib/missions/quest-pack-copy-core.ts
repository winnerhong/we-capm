// 스탬프북 복제 — 순수 로직(서버/클라이언트 공용, DB 접근 없음).
//
// 왜 필요한가:
//   스탬프북·미션을 행사 안에서 관리하기로 하면서, 매년 같은 행사를 하는 기관이
//   매번 미션 10개를 손으로 다시 만들어야 하는 상황이 생겼다. 지난 행사에서
//   통째로 가져올 수 있어야 그 선택이 손해가 되지 않는다.
//
// 복제에서 조용히 깨지는 자리가 둘 있다 — 그래서 로직을 여기 모으고 테스트로 고정한다:
//
//   1) 잠금 연결(unlock_previous_id)
//      "이전 미션을 끝내야 열림" 이 **원본 미션 id** 를 그대로 가리키면, 새 행사의
//      참가자가 옛 행사 미션을 깨야 열리는 꼴이 된다. 화면에는 아무 티도 안 난다.
//      새 id 로 옮기고, 옮길 대상이 복제 범위 밖이면 잠금을 푼다(ALWAYS).
//
//   2) QR 토큰
//      QR_QUIZ 의 qr_token 을 그대로 복사하면 **작년에 뿌린 QR 로 올해 미션이
//      완료된다.** 토큰은 반드시 새로 뽑는다.
//
// 기간(starts_at/ends_at)도 지운다. 지난 행사의 날짜가 새 행사에 따라오면
// "왜 미션이 안 열리지" 가 된다.

export type CopyMissionInput = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  icon: string | null;
  acorns: number;
  config_json: Record<string, unknown> | null;
  display_order: number;
  unlock_rule: string;
  unlock_threshold: number | null;
  unlock_previous_id: string | null;
  approval_mode: string;
  geofence_lat: number | null;
  geofence_lng: number | null;
  geofence_radius_m: number | null;
};

export type CopiedMission = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  icon: string | null;
  acorns: number;
  config_json: Record<string, unknown>;
  display_order: number;
  unlock_rule: string;
  unlock_threshold: number | null;
  unlock_previous_id: string | null;
  approval_mode: string;
  geofence_lat: number | null;
  geofence_lng: number | null;
  geofence_radius_m: number | null;
  is_active: boolean;
};

export type CopyPlan = {
  missions: CopiedMission[];
  /** 잠금을 풀어야 했던 미션 제목 — 화면에서 "이건 확인해 주세요" 로 알린다. */
  unlockedTitles: string[];
  /** QR 을 새로 뽑은 미션 제목 — 예전 QR 은 못 쓴다는 걸 알려야 한다. */
  reissuedQrTitles: string[];
};

/**
 * 복제 계획 세우기.
 *
 * @param newIdFor 새 미션 id 생성기. 주입받는 이유는 테스트에서 결정적으로
 *   확인하기 위해서다(실제로는 crypto.randomUUID).
 * @param newQrToken 새 QR 토큰 생성기. 같은 이유.
 */
export function planQuestPackCopy(args: {
  missions: CopyMissionInput[];
  newIdFor: (oldId: string) => string;
  newQrToken: (oldId: string) => string;
}): CopyPlan {
  const { missions, newIdFor, newQrToken } = args;

  const idMap = new Map<string, string>();
  for (const m of missions) idMap.set(m.id, newIdFor(m.id));

  const unlockedTitles: string[] = [];
  const reissuedQrTitles: string[] = [];

  const copied = missions.map((m) => {
    const config: Record<string, unknown> = { ...(m.config_json ?? {}) };

    // QR 은 반드시 새로 — 작년 QR 로 올해 미션이 완료되면 되돌릴 방법이 없다.
    if (m.kind === "QR_QUIZ" && typeof config.qr_token === "string") {
      config.qr_token = newQrToken(m.id);
      reissuedQrTitles.push(m.title);
    }

    // 잠금 연결 옮기기. 대상이 복제 범위 밖이면 잠금을 푼다.
    let unlockRule = m.unlock_rule;
    let unlockPrev: string | null = null;
    if (m.unlock_previous_id) {
      const mapped = idMap.get(m.unlock_previous_id);
      if (mapped) {
        unlockPrev = mapped;
      } else {
        unlockRule = "ALWAYS";
        unlockedTitles.push(m.title);
      }
    }

    return {
      id: idMap.get(m.id) as string,
      kind: m.kind,
      title: m.title,
      description: m.description,
      icon: m.icon,
      acorns: m.acorns,
      config_json: config,
      display_order: m.display_order,
      unlock_rule: unlockRule,
      unlock_threshold: m.unlock_threshold,
      unlock_previous_id: unlockPrev,
      approval_mode: m.approval_mode,
      geofence_lat: m.geofence_lat,
      geofence_lng: m.geofence_lng,
      geofence_radius_m: m.geofence_radius_m,
      // 복제본은 켜진 채로 온다 — 끄려면 한 번 더 손대면 되지만, 꺼진 걸
      // 모르고 행사를 여는 쪽이 훨씬 나쁘다.
      is_active: true,
    };
  });

  return { missions: copied, unlockedTitles, reissuedQrTitles };
}

/** "한누리 스탬프북" → "한누리 스탬프북 (사본)" — 목록에서 원본과 구분되게. */
export function copiedPackName(name: string): string {
  const base = (name ?? "").trim() || "스탬프북";
  return base.endsWith("(사본)") ? base : `${base} (사본)`;
}
