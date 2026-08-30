// 설문 결과 CSV — 순수 로직(DB 접근 없음).
//
// 엑셀에서 여는 파일이다. 두 가지를 지키지 않으면 열자마자 못 쓴다:
//   · UTF-8 BOM — 없으면 한글이 전부 깨진다.
//   · CRLF 줄바꿈 — 구버전 엑셀이 LF 만 있는 파일을 한 줄로 읽는다.
// 이 저장소의 다른 CSV(가족 명단)와 같은 규칙이다.

const BOM = "\uFEFF";

/** 쉼표·줄바꿈·따옴표가 든 값을 감싼다. */
function csvField(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function joinRow(cells: unknown[]): string {
  return cells.map(csvField).join(",");
}

export type SurveyCsvRow = {
  createdAt: string;
  /** "햇살반 홍길동" — 반 이름이 붙어 있으면 앞에서 떼어 따로 적는다. */
  name: string;
  rating: number;
  bestMissionTitle: string | null;
  comment: string | null;
};

/**
 * 파일명에 쓸 수 없는 글자를 걷어낸다.
 *
 * 행사 이름에 따옴표나 슬래시가 들어가는 일이 실제로 있다(`" 다같이 돌자 "`).
 * Content-Disposition 에 그대로 넣으면 헤더가 깨져 다운로드가 실패한다.
 */
export function safeFileStem(raw: string, fallback = "설문"): string {
  const s = (raw ?? "")
    .replace(/["'\/:*?<>|\r\n\t]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return s || fallback;
}

/**
 * 응답 한 건이 한 줄. 요약은 넣지 않는다 — 표 위에 요약 줄이 붙으면 엑셀의
 * 정렬·필터가 그 줄까지 끌고 다닌다. 요약은 화면에서 본다.
 */
export function buildSurveyCsv(rows: SurveyCsvRow[]): string {
  const lines: string[] = [
    joinRow(["제출시각", "가족", "별점", "가장 좋았던 것", "한 줄 의견"]),
  ];

  for (const r of rows) {
    lines.push(
      joinRow([
        r.createdAt,
        r.name,
        r.rating,
        r.bestMissionTitle ?? "",
        // 여러 줄 의견은 셀 안에서 줄바꿈으로 남는다(csvField 가 감싼다).
        r.comment ?? "",
      ])
    );
  }

  return BOM + lines.join("\r\n");
}
