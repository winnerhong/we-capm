export type MissionTemplateCategory =
  | "FAMILY"
  | "TEAM"
  | "CHILD"
  | "NATURE"
  | "ART"
  | "FOOD"
  | "QUIZ"
  | "FITNESS";

export type MissionTemplate = {
  id: string;
  category: MissionTemplateCategory;
  icon: string;
  title: string;
  description: string;
  instruction: string;
  template_type: "PHOTO" | "QUIZ" | "LOCATION" | "VIDEO" | "TIMEATTACK";
  points: number;
  auto_approve: boolean;
  config: Record<string, unknown>;
  tags: string[];
  popular?: boolean;
};

export const MISSION_TEMPLATES: MissionTemplate[] = [
  // 가족 (FAMILY)
  {
    id: "family_photo",
    category: "FAMILY",
    icon: "👨‍👩‍👧",
    title: "가족 사진 찍기",
    description: "온 가족이 함께 나온 사진 한 장",
    instruction: "가족 모두의 얼굴이 보이도록 찍어주세요",
    template_type: "PHOTO",
    points: 10,
    auto_approve: false,
    config: {},
    tags: ["가족", "사진", "추억"],
    popular: true,
  },
  {
    id: "family_highfive",
    category: "FAMILY",
    icon: "🙌",
    title: "가족 하이파이브",
    description: "가족 모두 손 모은 사진",
    instruction: "모든 가족의 손이 모인 순간을 포착해주세요",
    template_type: "PHOTO",
    points: 10,
    auto_approve: false,
    config: {},
    tags: ["가족", "협동"],
  },
  {
    id: "family_letter",
    category: "FAMILY",
    icon: "💌",
    title: "가족에게 편지",
    description: "가족 중 한 명에게 감사 편지 쓰기",
    instruction: "짧아도 좋아요, 진심을 담아서",
    template_type: "PHOTO",
    points: 15,
    auto_approve: false,
    config: {},
    tags: ["가족", "감사"],
  },

  // 자연 (NATURE)
  {
    id: "nature_acorn",
    category: "NATURE",
    icon: "🌰",
    title: "도토리 찾기",
    description: "숲에서 도토리 3개 찾아 인증",
    instruction: "도토리를 손에 올린 사진을 찍어주세요 (자연에 다시 돌려놓기!)",
    template_type: "PHOTO",
    points: 15,
    auto_approve: false,
    config: {},
    tags: ["자연", "숲"],
    popular: true,
  },
  {
    id: "nature_leaves",
    category: "NATURE",
    icon: "🍁",
    title: "나뭇잎 컬렉션",
    description: "서로 다른 5종류의 나뭇잎 수집",
    instruction: "다양한 모양의 잎을 나란히 놓고 사진 찍어주세요",
    template_type: "PHOTO",
    points: 20,
    auto_approve: false,
    config: {},
    tags: ["자연", "탐험"],
  },
  {
    id: "nature_tree_hug",
    category: "NATURE",
    icon: "🌲",
    title: "나무 안아주기",
    description: "가장 큰 나무를 찾아 안아보기",
    instruction: "나무를 안고 있는 모습을 찍어주세요",
    template_type: "PHOTO",
    points: 10,
    auto_approve: true,
    config: {},
    tags: ["자연", "힐링"],
  },
  {
    id: "nature_sound",
    category: "NATURE",
    icon: "🦜",
    title: "자연의 소리",
    description: "새소리, 바람소리 녹음",
    instruction: "10~30초짜리 자연의 소리를 녹음해주세요",
    template_type: "VIDEO",
    points: 15,
    auto_approve: false,
    config: { video_max_duration: 30 },
    tags: ["자연", "음성"],
  },

  // 아이 (CHILD)
  {
    id: "child_dance",
    category: "CHILD",
    icon: "💃",
    title: "아이 춤추는 모습",
    description: "자유롭게 춤추는 아이 영상",
    instruction: "10초 이상 영상으로 찍어주세요",
    template_type: "VIDEO",
    points: 15,
    auto_approve: false,
    config: { video_max_duration: 30 },
    tags: ["아이", "영상"],
  },
  {
    id: "child_face",
    category: "CHILD",
    icon: "😄",
    title: "행복한 순간 포착",
    description: "아이의 가장 즐거운 순간",
    instruction: "웃는 얼굴을 클로즈업으로",
    template_type: "PHOTO",
    points: 10,
    auto_approve: false,
    config: {},
    tags: ["아이", "감정"],
  },

  // 퀴즈 (QUIZ)
  {
    id: "quiz_tree",
    category: "QUIZ",
    icon: "🌳",
    title: "나무 퀴즈",
    description: "이 나무의 이름은?",
    instruction: "힌트: 잎이 바늘 모양이에요",
    template_type: "QUIZ",
    points: 5,
    auto_approve: true,
    config: {
      quiz_question: "이 나무의 이름은? (힌트: 잎이 바늘 모양)",
      quiz_answer: "소나무",
    },
    tags: ["퀴즈", "상식"],
  },
  {
    id: "quiz_ox_forest",
    category: "QUIZ",
    icon: "✅",
    title: "숲 상식 OX",
    description: "숲에 대한 OX 퀴즈",
    instruction: "O 또는 X를 입력해주세요",
    template_type: "QUIZ",
    points: 5,
    auto_approve: true,
    config: { quiz_question: "소나무는 활엽수이다? (O/X)", quiz_answer: "X" },
    tags: ["퀴즈", "OX"],
  },
  {
    id: "quiz_ecology",
    category: "QUIZ",
    icon: "🌱",
    title: "생태 퀴즈",
    description: "도토리는 어떤 나무의 열매?",
    instruction: "정답을 입력해주세요",
    template_type: "QUIZ",
    points: 5,
    auto_approve: true,
    config: { quiz_question: "도토리는 어떤 나무의 열매?", quiz_answer: "참나무" },
    tags: ["퀴즈", "생태"],
  },

  // 예술 (ART)
  {
    id: "art_leaf_art",
    category: "ART",
    icon: "🎨",
    title: "자연물 작품 만들기",
    description: "주변 자연물로 그림/작품 만들기",
    instruction: "잎, 돌, 가지 등으로 작품 완성 후 사진",
    template_type: "PHOTO",
    points: 20,
    auto_approve: false,
    config: {},
    tags: ["예술", "창작"],
    popular: true,
  },
  {
    id: "art_draw",
    category: "ART",
    icon: "✏️",
    title: "숲 그림 그리기",
    description: "눈앞의 풍경을 그림으로",
    instruction: "간단한 스케치도 좋아요!",
    template_type: "PHOTO",
    points: 15,
    auto_approve: false,
    config: {},
    tags: ["예술", "그림"],
  },

  // 음식 (FOOD)
  {
    id: "food_snack",
    category: "FOOD",
    icon: "🍪",
    title: "간식 타임 인증",
    description: "가족과 함께 먹는 간식",
    instruction: "맛있게 먹는 모습을 찍어주세요",
    template_type: "PHOTO",
    points: 10,
    auto_approve: true,
    config: {},
    tags: ["음식", "즐거움"],
  },
  {
    id: "food_cooking",
    category: "FOOD",
    icon: "🍳",
    title: "캠프 요리",
    description: "간단한 요리 만들기",
    instruction: "준비 → 완성 과정 모두 찍어주세요",
    template_type: "PHOTO",
    points: 25,
    auto_approve: false,
    config: { photo_min: 2 },
    tags: ["음식", "요리"],
  },

  // 운동 (FITNESS)
  {
    id: "fitness_run",
    category: "FITNESS",
    icon: "🏃",
    title: "숲길 달리기",
    description: "1분 달리기 챌린지",
    instruction: "1분간 달리는 모습을 영상으로",
    template_type: "TIMEATTACK",
    points: 15,
    auto_approve: true,
    config: { time_limit: 60 },
    tags: ["운동", "챌린지"],
  },
  {
    id: "fitness_yoga",
    category: "FITNESS",
    icon: "🧘",
    title: "숲속 요가",
    description: "가족 요가 포즈",
    instruction: "3가지 포즈를 함께 해보세요",
    template_type: "PHOTO",
    points: 20,
    auto_approve: false,
    config: {},
    tags: ["운동", "힐링"],
  },

  // 팀 (TEAM)
  {
    id: "team_relay",
    category: "TEAM",
    icon: "🏁",
    title: "팀 릴레이",
    description: "팀원 모두가 미션 완료",
    instruction: "릴레이로 미션을 완수하는 영상",
    template_type: "VIDEO",
    points: 30,
    auto_approve: false,
    config: { video_max_duration: 60 },
    tags: ["팀", "협동"],
  },
  {
    id: "team_cheer",
    category: "TEAM",
    icon: "📣",
    title: "팀 응원 영상",
    description: "팀원들과 응원 구호 외치기",
    instruction: "팀 이름을 넣은 구호!",
    template_type: "VIDEO",
    points: 15,
    auto_approve: false,
    config: { video_max_duration: 15 },
    tags: ["팀", "에너지"],
  },
];

export const CATEGORIES: {
  id: MissionTemplateCategory;
  label: string;
  icon: string;
}[] = [
  { id: "FAMILY", label: "가족", icon: "👨‍👩‍👧" },
  { id: "NATURE", label: "자연", icon: "🌲" },
  { id: "CHILD", label: "아이", icon: "👶" },
  { id: "QUIZ", label: "퀴즈", icon: "✍️" },
  { id: "ART", label: "예술", icon: "🎨" },
  { id: "FOOD", label: "음식", icon: "🍽️" },
  { id: "FITNESS", label: "운동", icon: "🏃" },
  { id: "TEAM", label: "팀", icon: "🤝" },
];

// Category-specific tailwind color accent classes (used by cards/badges).
export const CATEGORY_COLORS: Record<
  MissionTemplateCategory,
  { badge: string; accent: string; ring: string }
> = {
  FAMILY: { badge: "bg-pink-100 text-pink-700", accent: "border-t-pink-400", ring: "ring-pink-200" },
  NATURE: {
    badge: "bg-green-100 text-green-700",
    accent: "border-t-green-500",
    ring: "ring-green-200",
  },
  CHILD: {
    badge: "bg-yellow-100 text-yellow-700",
    accent: "border-t-yellow-400",
    ring: "ring-yellow-200",
  },
  QUIZ: { badge: "bg-blue-100 text-blue-700", accent: "border-t-blue-500", ring: "ring-blue-200" },
  ART: {
    badge: "bg-fuchsia-100 text-fuchsia-700",
    accent: "border-t-fuchsia-500",
    ring: "ring-fuchsia-200",
  },
  FOOD: {
    badge: "bg-orange-100 text-orange-700",
    accent: "border-t-orange-500",
    ring: "ring-orange-200",
  },
  FITNESS: { badge: "bg-red-100 text-red-700", accent: "border-t-red-500", ring: "ring-red-200" },
  TEAM: {
    badge: "bg-violet-100 text-violet-700",
    accent: "border-t-violet-500",
    ring: "ring-violet-200",
  },
};

export const TEMPLATE_TYPE_LABEL: Record<MissionTemplate["template_type"], string> = {
  PHOTO: "📸 사진",
  QUIZ: "✍️ 퀴즈",
  LOCATION: "📍 위치",
  VIDEO: "🎥 영상",
  TIMEATTACK: "🏃 타임어택",
};

export function getTemplateById(id: string): MissionTemplate | undefined {
  return MISSION_TEMPLATES.find((t) => t.id === id);
}
