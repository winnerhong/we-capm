import { describe, expect, it } from "vitest";
import {
  copiedPackName,
  planQuestPackCopy,
  type CopyMissionInput,
} from "./quest-pack-copy-core";

const mission = (over: Partial<CopyMissionInput>): CopyMissionInput => ({
  id: "m1",
  kind: "PHOTO",
  title: "가족 사진",
  description: null,
  icon: "📸",
  acorns: 3,
  config_json: {},
  display_order: 0,
  unlock_rule: "ALWAYS",
  unlock_threshold: null,
  unlock_previous_id: null,
  approval_mode: "AUTO",
  geofence_lat: null,
  geofence_lng: null,
  geofence_radius_m: null,
  ...over,
});

const plan = (missions: CopyMissionInput[]) =>
  planQuestPackCopy({
    missions,
    newIdFor: (old) => `new-${old}`,
    newQrToken: (old) => `token-${old}`,
  });

describe("planQuestPackCopy", () => {
  it("내용은 그대로 옮긴다", () => {
    const r = plan([mission({ title: "숲길 걷기", acorns: 5 })]);
    expect(r.missions).toHaveLength(1);
    expect(r.missions[0]).toMatchObject({
      id: "new-m1",
      title: "숲길 걷기",
      acorns: 5,
      icon: "📸",
      is_active: true,
    });
  });

  it("잠금 연결을 새 미션으로 옮긴다 — 안 옮기면 새 행사가 옛 미션을 가리킨다", () => {
    const r = plan([
      mission({ id: "a", title: "1번" }),
      mission({
        id: "b",
        title: "2번",
        unlock_rule: "SEQUENTIAL",
        unlock_previous_id: "a",
      }),
    ]);
    const b = r.missions.find((m) => m.title === "2번");
    expect(b?.unlock_previous_id).toBe("new-a");
    expect(b?.unlock_rule).toBe("SEQUENTIAL");
    expect(r.unlockedTitles).toEqual([]);
  });

  it("복제 범위 밖을 가리키면 잠금을 푼다 — 영영 안 열리는 미션이 생기면 안 된다", () => {
    const r = plan([
      mission({
        id: "b",
        title: "2번",
        unlock_rule: "SEQUENTIAL",
        unlock_previous_id: "없는-미션",
      }),
    ]);
    expect(r.missions[0].unlock_previous_id).toBeNull();
    expect(r.missions[0].unlock_rule).toBe("ALWAYS");
    expect(r.unlockedTitles).toEqual(["2번"]);
  });

  it("QR 토큰은 새로 뽑는다 — 작년 QR 로 올해 미션이 완료되면 되돌릴 수 없다", () => {
    const r = plan([
      mission({
        id: "q",
        kind: "QR_QUIZ",
        title: "QR 퀴즈",
        config_json: { qr_token: "OLD-TOKEN", quiz_type: "MCQ" },
      }),
    ]);
    expect(r.missions[0].config_json.qr_token).toBe("token-q");
    // 나머지 설정은 그대로여야 한다.
    expect(r.missions[0].config_json.quiz_type).toBe("MCQ");
    expect(r.reissuedQrTitles).toEqual(["QR 퀴즈"]);
  });

  it("QR 미션이 아니면 토큰을 건드리지 않는다", () => {
    const r = plan([
      mission({ kind: "PHOTO", config_json: { qr_token: "SHOULD-STAY" } }),
    ]);
    expect(r.missions[0].config_json.qr_token).toBe("SHOULD-STAY");
    expect(r.reissuedQrTitles).toEqual([]);
  });

  it("원본 config 를 건드리지 않는다 — 복사본을 고쳤더니 원본이 바뀌면 안 된다", () => {
    const src = mission({
      kind: "QR_QUIZ",
      config_json: { qr_token: "OLD" },
    });
    plan([src]);
    expect(src.config_json?.qr_token).toBe("OLD");
  });

  it("순서와 승인 방식·지오펜스를 유지한다", () => {
    const r = plan([
      mission({
        display_order: 7,
        approval_mode: "MANUAL_TEACHER",
        geofence_lat: 37.5,
        geofence_lng: 127.1,
        geofence_radius_m: 50,
      }),
    ]);
    expect(r.missions[0]).toMatchObject({
      display_order: 7,
      approval_mode: "MANUAL_TEACHER",
      geofence_lat: 37.5,
      geofence_radius_m: 50,
    });
  });

  it("config 가 없어도 빈 객체로 만든다", () => {
    const r = plan([mission({ config_json: null })]);
    expect(r.missions[0].config_json).toEqual({});
  });

  it("빈 목록도 안전하다", () => {
    expect(plan([]).missions).toEqual([]);
  });

  it("서로 잠금이 물린 여러 미션도 전부 새 id 로 이어진다", () => {
    const r = plan([
      mission({ id: "a", title: "A" }),
      mission({ id: "b", title: "B", unlock_previous_id: "a" }),
      mission({ id: "c", title: "C", unlock_previous_id: "b" }),
    ]);
    const byTitle = Object.fromEntries(r.missions.map((m) => [m.title, m]));
    expect(byTitle.B.unlock_previous_id).toBe("new-a");
    expect(byTitle.C.unlock_previous_id).toBe("new-b");
  });
});

describe("copiedPackName", () => {
  it("(사본) 을 붙인다", () => {
    expect(copiedPackName("한누리 스탬프북")).toBe("한누리 스탬프북 (사본)");
  });

  it("이미 사본이면 겹쳐 붙이지 않는다", () => {
    expect(copiedPackName("한누리 스탬프북 (사본)")).toBe(
      "한누리 스탬프북 (사본)"
    );
  });

  it("이름이 비어도 부를 이름을 준다", () => {
    expect(copiedPackName("   ")).toBe("스탬프북 (사본)");
  });
});
