export function getOrgTemplate(): string {
  const BOM = "\ufeff";
  const headers = [
    "기관명*",
    "기관유형",
    "기관전화*",
    "대표자*",
    "대표전화*",
    "이메일",
    "주소",
    "아동수",
    "학급수",
    "사업자등록번호",
  ];
  const sample = [
    "해바라기어린이집",
    "DAYCARE",
    "02-123-4567",
    "김영희",
    "010-1234-5678",
    "hello@daycare.com",
    "서울시 강남구",
    "47",
    "4",
    "123-45-67890",
  ];
  return BOM + headers.join(",") + "\n" + sample.map(v => `"${v}"`).join(",") + "\n";
}

export function getCustomerTemplate(): string {
  const BOM = "\ufeff";
  const headers = [
    "보호자이름*",
    "보호자전화*",
    "이메일",
    "주소",
    "아이이름",
    "아이나이",
    "관심사",
  ];
  const sample = [
    "김철수",
    "010-1111-2222",
    "kim@example.com",
    "서울시",
    "김민준",
    "8",
    "숲체험,캠핑",
  ];
  return BOM + headers.join(",") + "\n" + sample.map(v => `"${v}"`).join(",") + "\n";
}

export function getCompanyTemplate(): string {
  const BOM = "\ufeff";
  const headers = [
    "회사명*",
    "사업자등록번호*",
    "대표자*",
    "대표전화",
    "회사이메일",
    "업종",
    "직원수",
    "담당자이름",
    "담당자연락처",
  ];
  const sample = [
    "(주)에이그룹",
    "123-45-67890",
    "이영수",
    "02-1234-5678",
    "contact@agroup.com",
    "IT/서비스업",
    "250",
    "박철수",
    "010-9999-8888",
  ];
  return BOM + headers.join(",") + "\n" + sample.map(v => `"${v}"`).join(",") + "\n";
}
