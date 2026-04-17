import { createEventAction } from "../actions";

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">새 행사 만들기</h1>

      <form action={createEventAction} className="space-y-4 rounded-lg border bg-white p-6">
        <Field label="행사명" name="name" required placeholder="5월 가족 캠프닉" />

        <div>
          <label className="mb-1 block text-sm font-medium">행사 유형</label>
          <select
            name="type"
            defaultValue="FAMILY"
            className="w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="FAMILY">가족</option>
            <option value="CORPORATE">기업</option>
            <option value="CLUB">동호회</option>
            <option value="SCHOOL">학교</option>
            <option value="ETC">기타</option>
          </select>
        </div>

        <Field label="시작 시각" name="start_at" type="datetime-local" required />
        <Field label="종료 시각" name="end_at" type="datetime-local" required />
        <Field label="장소" name="location" required placeholder="가평 자라섬 캠핑장" />

        <div>
          <label className="mb-1 block text-sm font-medium">참가 단위</label>
          <select
            name="participation_type"
            defaultValue="BOTH"
            className="w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="BOTH">개인 + 팀</option>
            <option value="INDIVIDUAL">개인 전용</option>
            <option value="TEAM">팀 전용</option>
          </select>
        </div>

        <div className="border-t pt-4">
          <p className="mb-2 text-sm font-semibold">행사 기관 로그인 계정</p>
          <Field label="기관 아이디" name="manager_id" required placeholder="gapyeong2026" />
          <div className="mt-2">
            <Field label="기관 비밀번호" name="manager_password" required placeholder="camp1234" />
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700"
        >
          만들기
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-violet-500"
      />
    </div>
  );
}
