import { describe, expect, it } from "vitest";
import { buildSurveyReport, reportLine } from "./survey-report";
import { buildSurveyCsv, safeFileStem } from "./survey-csv";

const r = (
  rating: number,
  mission?: [string, string] | null,
  comment?: string
) => ({
  rating,
  bestMissionId: mission?.[0] ?? null,
  bestMissionTitle: mission?.[1] ?? null,
  comment: comment ?? null,
});

const QR: [string, string] = ["m1", "QR보물찾기"];
const PHOTO: [string, string] = ["m2", "가족 사진 찍기"];
const BUG: [string, string] = ["m3", "곤충과 사진찍기"];

describe("평균은 분포를 지운다", () => {
  it("같은 평균 4.0 이라도 분포가 다르면 다른 이야기다", () => {
    const flat = buildSurveyReport([r(4), r(4), r(4), r(4)], 0);
    const split = buildSurveyReport([r(5), r(5), r(5), r(1)], 0);
    expect(flat.avgRating).toBe(4);
    expect(split.avgRating).toBe(4);

    expect(flat.distribution.find((d) => d.rating === 1)!.count).toBe(0);
    expect(split.distribution.find((d) => d.rating === 1)!.count).toBe(1);
  });

  it("0건인 칸도 남긴다 — 빈 칸이 있어야 분포가 분포로 보인다", () => {
    const rep = buildSurveyReport([r(5), r(5)], 0);
    expect(rep.distribution.map((d) => d.rating)).toEqual([5, 4, 3, 2, 1]);
    expect(rep.distribution.map((d) => d.count)).toEqual([2, 0, 0, 0, 0]);
  });

  it("퍼센트는 별점을 낸 응답 기준", () => {
    const rep = buildSurveyReport([r(5), r(5), r(4), r(1)], 0);
    expect(rep.distribution.find((d) => d.rating === 5)!.percent).toBe(50);
    expect(rep.distribution.find((d) => d.rating === 4)!.percent).toBe(25);
  });
});

describe("응답률", () => {
  it("참가자 수를 알면 비율을 낸다", () => {
    const rep = buildSurveyReport([r(5), r(4)], 8);
    expect(rep.responseRate).toBe(25);
  });

  it("참가자 수를 모르면 null — 0% 라고 쓰면 거짓말이다", () => {
    expect(buildSurveyReport([r(5)], 0).responseRate).toBeNull();
  });

  it("한 줄 요약에 응답률까지 넣는다", () => {
    const rep = buildSurveyReport([r(5), r(4), r(4)], 12);
    expect(reportLine(rep)).toBe("4.3점 · 3명 응답 (25%)");
  });

  it("참가자 수를 모르면 한 줄 요약에 비율을 쓰지 않는다", () => {
    expect(reportLine(buildSurveyReport([r(5)], 0))).toBe("5.0점 · 1명 응답");
  });

  it("응답이 하나도 없으면 평균은 null 이다 — 0점이 아니다", () => {
    const rep = buildSurveyReport([], 100);
    expect(rep.avgRating).toBeNull();
    expect(rep.responseRate).toBe(0);
    expect(reportLine(rep)).toBe("아직 응답이 없어요");
  });
});

describe("가장 좋았던 것 — 내년에 뭘 남길지", () => {
  it("많이 뽑힌 순으로 줄 세운다", () => {
    const rep = buildSurveyReport(
      [r(5, QR), r(4, QR), r(5, PHOTO), r(3, QR), r(5, BUG), r(4, PHOTO)],
      0
    );
    expect(rep.missions.map((m) => [m.title, m.count])).toEqual([
      ["QR보물찾기", 3],
      ["가족 사진 찍기", 2],
      ["곤충과 사진찍기", 1],
    ]);
  });

  it("동점이면 이름순으로 고정한다 — 새로고침마다 순서가 바뀌면 안 된다", () => {
    const a = buildSurveyReport([r(5, QR), r(5, PHOTO)], 0);
    const b = buildSurveyReport([r(5, PHOTO), r(5, QR)], 0);
    expect(a.missions.map((m) => m.title)).toEqual(b.missions.map((m) => m.title));
  });

  it("안 고른 응답은 순위에 끼지 않는다", () => {
    const rep = buildSurveyReport([r(5, QR), r(5), r(5)], 0);
    expect(rep.missions).toHaveLength(1);
    expect(rep.missions[0].percent).toBe(33);
  });

  it("지워진 미션도 표에서 사라지지 않는다 — 표가 응답 수와 안 맞으면 못 믿는다", () => {
    const rep = buildSurveyReport([{ ...r(5), bestMissionId: "gone" }], 0);
    expect(rep.missions[0].title).toBe("(지워진 미션)");
  });
});

describe("의견 세기", () => {
  it("공백만 적힌 건 의견이 아니다", () => {
    const rep = buildSurveyReport([r(5, null, "좋았어요"), r(4, null, "   ")], 0);
    expect(rep.commentCount).toBe(1);
  });
});

describe("망가진 값 방어", () => {
  it("범위를 벗어난 별점은 평균에도 분포에도 안 넣는다", () => {
    const rep = buildSurveyReport([r(5), r(99), r(0)], 0);
    expect(rep.avgRating).toBe(5);
    expect(rep.distribution.reduce((a, d) => a + d.count, 0)).toBe(1);
    // 응답 수는 그대로 3 — 받은 건 받은 것이다.
    expect(rep.responseCount).toBe(3);
  });
});

describe("CSV — 엑셀에서 열려야 쓸모가 있다", () => {
  const rows = [
    {
      createdAt: "2026-05-16 13:20",
      name: "햇살반 홍길동",
      rating: 5,
      bestMissionTitle: "QR보물찾기",
      comment: "아이가 좋아했어요",
    },
  ];

  it("BOM 으로 시작한다 — 없으면 엑셀에서 한글이 깨진다", () => {
    expect(buildSurveyCsv(rows).startsWith("\uFEFF")).toBe(true);
  });

  it("CRLF 로 줄을 나눈다", () => {
    expect(buildSurveyCsv(rows)).toContain("\r\n");
  });

  it("헤더 + 응답 한 건이 한 줄", () => {
    const lines = buildSurveyCsv(rows).split("\r\n");
    expect(lines[0]).toContain("제출시각");
    expect(lines).toHaveLength(2);
  });

  it("쉼표·따옴표·줄바꿈이 든 의견을 감싼다", () => {
    const csv = buildSurveyCsv([
      { ...rows[0], comment: '정말, 좋았고 "최고"\n또 올게요' },
    ]);
    expect(csv).toContain('"정말, 좋았고 ""최고""\n또 올게요"');
  });

  it("빈 값은 빈 칸으로 — 'null' 이 찍히면 안 된다", () => {
    const csv = buildSurveyCsv([
      { ...rows[0], bestMissionTitle: null, comment: null },
    ]);
    expect(csv).not.toContain("null");
    expect(csv.split("\r\n")[1].endsWith(",,")).toBe(true);
  });
});

describe("파일 이름", () => {
  it("헤더를 깨뜨리는 글자를 걷어낸다", () => {
    expect(safeFileStem('" 다같이 돌자, 자연 한바퀴! "')).toBe(
      "다같이 돌자, 자연 한바퀴!"
    );
    expect(safeFileStem("a/b\c:d*e?f")).toBe("abcdef");
  });

  it("다 걷어내고 나면 대체 이름을 쓴다", () => {
    expect(safeFileStem('"""')).toBe("설문");
  });
});
