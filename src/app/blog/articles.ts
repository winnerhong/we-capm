export type ArticleCategory =
  | "운영 노하우"
  | "교육 팁"
  | "참가자 후기"
  | "공지사항"
  | "제품 소식";

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  date: string; // ISO
  category: ArticleCategory;
  author: string;
  authorEmoji: string;
  coverEmoji: string;
  coverGradient: string; // tailwind gradient classes
  readMinutes: number;
  paragraphs: {
    heading?: string;
    body: string;
  }[];
};

export const ARTICLE_CATEGORIES: ArticleCategory[] = [
  "운영 노하우",
  "교육 팁",
  "참가자 후기",
  "공지사항",
  "제품 소식",
];

export const ARTICLES: Article[] = [
  {
    slug: "why-we-started-toriro",
    title: "토리로를 시작한 이유",
    excerpt:
      "아이와 함께 숲을 걷던 평범한 주말, 우리는 '이 순간을 모두와 나누고 싶다'고 생각했습니다. 창업자가 들려주는 토리로의 시작 이야기.",
    date: "2026-02-14",
    category: "공지사항",
    author: "홍보광",
    authorEmoji: "🌲",
    coverEmoji: "🌻",
    coverGradient: "from-[#2D5A3D] via-[#4A7C59] to-[#8FB98A]",
    readMinutes: 4,
    paragraphs: [
      {
        heading: "평범했던 어느 토요일 오전",
        body: "여섯 살 아이의 손을 잡고 동네 뒷산을 오르던 날이었습니다. 아이는 도토리 하나를 주워 들고 한참을 들여다 보더니 '아빠, 이 안에 나무가 들어있대'라고 말했습니다. 그 짧은 문장이 마음에 오래 남았습니다.",
      },
      {
        heading: "우리가 발견한 문제",
        body: "주말마다 아이와 어디를 가야 할지 고민하는 부모가 많습니다. 키즈카페는 붐비고, 테마파크는 비싸고, 산책은 금세 지루해집니다. 동시에 전국의 숲해설가·체험농장 운영자들은 '좋은 콘텐츠가 있어도 가족 고객을 만나기 어렵다'는 어려움을 겪고 있었습니다.",
      },
      {
        heading: "숲길 + 미션 + 리워드",
        body: "토리로는 이 두 가지 문제를 연결합니다. 지역의 숲지기가 자신만의 숲길 프로그램을 등록하면, 가족들은 미션을 따라 걷고 도토리(포인트)를 모읍니다. 도토리는 지역 카페, 빵집, 문구점에서 사용할 수 있어 방문이 다시 지역 경제로 돌아갑니다.",
      },
      {
        heading: "작은 도토리 하나에서 시작된 숲",
        body: "처음 3명이 모여 프로토타입을 만들던 날로부터 약 1년이 지났습니다. 지금은 전국 120개 이상의 숲길이 토리로에 등록되어 있고, 매주 새로운 가족을 만납니다. 여전히 작지만, 작은 도토리 하나가 숲이 되는 시간을 우리는 믿습니다.",
      },
    ],
  },
  {
    slug: "family-stories-from-the-forest",
    title: "숲속에서 만난 가족들의 이야기",
    excerpt:
      "토리로에서 만난 세 가족의 실제 이야기. 스마트폰 없이 보낸 반나절이 가족에게 남긴 것은 무엇이었을까요?",
    date: "2026-03-02",
    category: "참가자 후기",
    author: "이수민 에디터",
    authorEmoji: "✍️",
    coverEmoji: "👨‍👩‍👧‍👦",
    coverGradient: "from-[#8B6F47] via-[#B5936C] to-[#D4B896]",
    readMinutes: 5,
    paragraphs: [
      {
        heading: "사춘기 아들과 다시 손잡은 아빠",
        body: "중학생 아들을 둔 김 아버님은 '어떻게 해도 대화가 안 되던 아이'라고 했습니다. 토리로 미션 중 '함께 들리는 소리 3가지 적기'를 하던 순간, 아이가 먼저 '이거 재미있네' 한 마디를 건넸다고 합니다. 별것 아닌 듯한 그 한마디가 집에 돌아오는 길 내내 두 사람을 웃게 했습니다.",
      },
      {
        heading: "엄마의 체력을 되찾아 준 숲",
        body: "다섯 살·일곱 살 두 아이를 키우는 박 어머님은 '주말이면 방전된 채로 월요일을 맞았다'고 했습니다. 숲길을 걷는 동안에는 아이들이 스스로 뛰어다니며 도토리를 찾아다녀, 오랜만에 편하게 커피 한 모금을 마실 수 있었다고 합니다.",
      },
      {
        heading: "할머니와 손녀의 도토리 모으기",
        body: "일곱 살 손녀와 함께 참여한 할머니는 미션판을 손녀에게 읽어달라고 하셨습니다. 글자를 막 뗀 손녀가 한 자 한 자 소리 내어 읽는 동안, 할머니는 '이 애가 이렇게 컸구나'를 실감하셨다고 합니다.",
      },
      {
        heading: "이야기는 계속됩니다",
        body: "토리로가 만드는 것은 이벤트가 아니라, 가족 사이에 남는 '공통의 기억'입니다. 여러분의 이야기도 들려주세요. 블로그 상단의 후기 보내기 버튼을 통해 참여하실 수 있습니다.",
      },
    ],
  },
  {
    slug: "5-nature-play-ideas",
    title: "아이들의 창의력을 깨우는 자연 놀이 5가지",
    excerpt:
      "값비싼 장난감 없이도 충분합니다. 숲해설가가 추천하는, 5분이면 시작할 수 있는 자연 놀이 다섯 가지를 소개합니다.",
    date: "2026-03-10",
    category: "교육 팁",
    author: "정하늘 숲해설가",
    authorEmoji: "🌿",
    coverEmoji: "🎨",
    coverGradient: "from-[#4A7C59] via-[#8FB98A] to-[#D4E4BC]",
    readMinutes: 6,
    paragraphs: [
      {
        heading: "① 색깔 도감 만들기",
        body: "A4 종이 한 장을 반으로 접어 색 칸을 그립니다. 아이가 숲에서 같은 색깔의 잎·열매·돌을 찾아 칸을 채우게 합니다. 초록이 몇 가지 색깔로 나뉘는지 발견하는 순간, 관찰력이 확 자랍니다.",
      },
      {
        heading: "② 나무 청진기",
        body: "나무에 귀를 대고 10초간 눈을 감아봅니다. 바람, 곤충, 물 오르는 소리가 들립니다. 아이에게 '나무가 무엇이라고 말하는 것 같아?' 질문해 보세요. 놀라운 상상력이 튀어나옵니다.",
      },
      {
        heading: "③ 냄새 빙고",
        body: "솔잎, 흙, 꽃, 젖은 돌, 오래된 낙엽. 다섯 가지 냄새를 맞춰 빙고를 완성합니다. 후각은 기억과 가장 강하게 연결된 감각이라, 이 체험은 오래 남습니다.",
      },
      {
        heading: "④ 걷기 박자 바꾸기",
        body: "호랑이처럼·토끼처럼·거북이처럼. 동물 이름을 외치면 그 동물처럼 걷는 놀이입니다. 지루해하던 5살 아이도 10분은 거뜬히 더 걷습니다.",
      },
      {
        heading: "⑤ 돌 탑 인사",
        body: "마지막으로 작은 돌을 모아 탑을 쌓고, 다음에 올 가족을 위해 두고 옵니다. '우리가 여기 왔었다'는 감각을 아이에게 심어주는 의식입니다.",
      },
    ],
  },
  {
    slug: "why-acorn-challenge-works",
    title: "도토리 모으기 챌린지가 인기인 이유",
    excerpt:
      "단순한 포인트 적립이 왜 가족들의 행동을 바꿀까요? 게이미피케이션 설계자가 말하는 도토리 시스템의 설계 원리.",
    date: "2026-03-18",
    category: "운영 노하우",
    author: "민지호 프로덕트 리드",
    authorEmoji: "🎯",
    coverEmoji: "🏆",
    coverGradient: "from-[#B8860B] via-[#D4A853] to-[#FFF6D9]",
    readMinutes: 5,
    paragraphs: [
      {
        heading: "행동을 만드는 건 '다음 한 걸음'입니다",
        body: "리서치에서 반복해서 나온 키워드는 '귀찮다'였습니다. 도토리 시스템은 이 귀찮음을 '작은 다음 한 걸음'으로 쪼갭니다. 지금 5개, 다음 미션에서 3개, 집에 가면 보너스 2개. 멈출 타이밍을 일부러 애매하게 두었습니다.",
      },
      {
        heading: "가족 공동 지갑이라는 설계",
        body: "도토리는 개인이 아닌 '우리 가족' 지갑에 쌓입니다. 그래서 아이는 '이 미션 내가 할게'라고 자발적으로 나섭니다. 이 작은 사회성 실험이, 실제로는 가장 강력한 기믹입니다.",
      },
      {
        heading: "현금이 아니라 이야기로 바꿔준다",
        body: "도토리는 1도토리 = 50원이지만, 결제창에 '오늘 쌓은 도토리 42개'라고 써 있으면 부모는 그걸 '우리가 같이 걸은 시간'으로 읽습니다. 환금이 아니라 의미가 되는 순간입니다.",
      },
      {
        heading: "숫자보다 속도를 본다",
        body: "우리가 가장 오래 본 지표는 '두 번째 방문까지 걸리는 시간'입니다. 도토리 UI를 세 번 개편하면서 이 시간이 21일에서 11일로 줄었습니다. 인기는 결과일 뿐, 설계의 목표는 '다시 오는 가족'입니다.",
      },
    ],
  },
  {
    slug: "operator-trail-design-guide",
    title: "기관 운영자를 위한 숲길 기획 가이드",
    excerpt:
      "처음 숲길 프로그램을 만드는 기관 담당자를 위한 체크리스트. 동선·안전·미션 난이도까지, 현장에서 배운 실전 팁만 모았습니다.",
    date: "2026-03-25",
    category: "운영 노하우",
    author: "조현수 운영 매니저",
    authorEmoji: "🏕️",
    coverEmoji: "🗺️",
    coverGradient: "from-[#2D5A3D] via-[#4A7C59] to-[#D4E4BC]",
    readMinutes: 7,
    paragraphs: [
      {
        heading: "시작은 '한 바퀴 걸어보기'",
        body: "기획서부터 쓰지 마세요. 준비된 코스를 천천히 혼자 걸으며, 막히는 지점·심심한 지점·위험한 지점을 메모합니다. 코스의 리듬감은 머리가 아니라 발이 압니다.",
      },
      {
        heading: "90분이 마법의 숫자",
        body: "7세 전후 아이 기준으로 90분이 집중 한계입니다. 120분을 넘기면 반드시 중간 휴식 포인트가 필요하고, 그 휴식 포인트에는 간식 혹은 미션 변화가 있어야 합니다.",
      },
      {
        heading: "미션은 쉬움-쉬움-어려움",
        body: "초반 두 개의 미션은 누구나 성공하게 만드세요. 첫 도토리를 획득한 아이는 다음 미션의 난도를 훨씬 잘 견딥니다. 실패가 먼저 오면 나머지 체험 전체가 흔들립니다.",
      },
      {
        heading: "안전은 스태프의 표정이 결정합니다",
        body: "로프보다 강력한 것은 안내 스태프의 여유로운 표정입니다. 불안한 부모는 아이의 불안을 두 배로 키웁니다. 스태프 사전 교육에 '시선·말투·속도' 세 가지를 꼭 포함하세요.",
      },
    ],
  },
  {
    slug: "2026-spring-open",
    title: "2026 봄 시즌 오픈 소식",
    excerpt:
      "3월 22일부터 전국 42개 숲길의 봄 시즌이 열립니다. 신규 코스·할인·이벤트까지 한 번에 정리했습니다.",
    date: "2026-03-22",
    category: "공지사항",
    author: "토리로 공식",
    authorEmoji: "📣",
    coverEmoji: "🌸",
    coverGradient: "from-[#F8B4D9] via-[#F4CCCC] to-[#FFF8F0]",
    readMinutes: 3,
    paragraphs: [
      {
        heading: "42개 숲길이 동시에 오픈됩니다",
        body: "수도권 18개, 충청·강원 11개, 영남 8개, 호남·제주 5개 숲길이 3월 22일 동시에 봄 시즌을 시작합니다. 모든 코스는 앱 메인에서 '봄 시즌' 필터로 확인할 수 있습니다.",
      },
      {
        heading: "신규 코스 7선",
        body: "파주 벚꽃 숲길, 양평 두물머리 코스, 공주 금강 둘레길 등 일곱 개의 신규 코스가 추가되었습니다. 각 코스는 오픈 첫 2주간 입장료가 30% 할인됩니다.",
      },
      {
        heading: "가족 릴레이 이벤트",
        body: "3월 22일부터 4월 30일까지, 두 가족 이상이 같은 숲길을 방문하면 양쪽 가족 모두에게 도토리 50개를 드립니다. 친구 가족에게 초대 코드를 보내보세요.",
      },
    ],
  },
  {
    slug: "esg-meets-family-experience",
    title: "ESG와 가족 체험의 만남",
    excerpt:
      "임직원 만족도와 지역 사회 기여를 동시에 해결하는 새로운 ESG 포맷. 토리로가 제안하는 기업 가족 프로그램의 현재.",
    date: "2026-04-04",
    category: "운영 노하우",
    author: "김민재 비즈 리드",
    authorEmoji: "🏢",
    coverEmoji: "♻️",
    coverGradient: "from-[#1F3D2B] via-[#2D5A3D] to-[#4A7C59]",
    readMinutes: 5,
    paragraphs: [
      {
        heading: "ESG는 '보고서용'에서 '일상용'으로",
        body: "이전의 ESG는 결산 시점의 리포트에 가까웠습니다. 이제 기업은 임직원이 '체감할 수 있는 ESG'를 요구합니다. 가족 숲길 체험은 자녀와 함께 참여할 수 있어, 참여율이 일반 CSR 대비 평균 2.3배 높습니다.",
      },
      {
        heading: "지역 상권과의 연결",
        body: "기업이 구매한 도토리는 현장에서 가족이 사용하고, 결국 지역 카페·베이커리·서점의 매출로 이어집니다. 2025년 기준 파트너 기업 한 곳당 평균 830만 원이 지역 경제로 돌아갔습니다.",
      },
      {
        heading: "탄소·사회 지표 자동 리포트",
        body: "체험 종료 후 72시간 내에 탄소 저감량, 지역 경제 기여액, 참여 가족 수가 포함된 임팩트 리포트가 자동 생성됩니다. 지속가능경영보고서에 바로 인용 가능한 수치로 제공됩니다.",
      },
      {
        heading: "다음 스텝",
        body: "현재 12개 기업과 연간 계약이 진행 중이며, 2026년 하반기에는 국내 30대 그룹 중 8개사와의 ESG 공동 프로젝트가 예정되어 있습니다. 관심 있는 HR·ESG 담당자는 기업 문의 페이지를 참고해 주세요.",
      },
    ],
  },
  {
    slug: "toriro-app-v2-update",
    title: "토리로 앱 v2.0 업데이트",
    excerpt:
      "오프라인 모드, 가족 채팅방, 도토리 적립 속도 개선까지. 4월 대규모 업데이트에서 달라지는 것들을 미리 확인하세요.",
    date: "2026-04-18",
    category: "제품 소식",
    author: "토리로 제품팀",
    authorEmoji: "⚙️",
    coverEmoji: "📱",
    coverGradient: "from-[#7B4FAE] via-[#9D7BC7] to-[#D4C4E8]",
    readMinutes: 4,
    paragraphs: [
      {
        heading: "오프라인 모드",
        body: "산속에서도 미션판이 사라지지 않습니다. 체험 시작 전 한 번 다운로드하면, 데이터 없이도 미션 수행·사진 업로드·도토리 적립이 가능합니다. 통신 복귀 시 자동 동기화됩니다.",
      },
      {
        heading: "가족 채팅방",
        body: "부모 두 분, 조부모, 형제자매 등 최대 6명이 한 채팅방에 모여 미션 진행 상황을 공유할 수 있습니다. 현장 사진은 자동으로 앨범에 정리됩니다.",
      },
      {
        heading: "도토리 적립 속도 3배 개선",
        body: "서버 처리 구조 개편으로, 미션 승인부터 도토리 적립까지 평균 12초에서 4초로 단축되었습니다. 현장에서 즉시 사용 가능한 경험에 한층 가까워졌습니다.",
      },
      {
        heading: "업데이트 일정",
        body: "iOS 먼저 4월 25일 강제 업데이트가 배포되며, 안드로이드는 4월 28일입니다. 구버전에서는 일부 신규 코스가 표시되지 않을 수 있으니, 방문 전 반드시 업데이트해 주세요.",
      },
    ],
  },
];

export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function getRelatedArticles(slug: string, limit = 3): Article[] {
  const current = getArticleBySlug(slug);
  if (!current) return ARTICLES.slice(0, limit);
  // prefer same category
  const sameCat = ARTICLES.filter(
    (a) => a.slug !== slug && a.category === current.category,
  );
  const others = ARTICLES.filter(
    (a) => a.slug !== slug && a.category !== current.category,
  );
  return [...sameCat, ...others].slice(0, limit);
}
