import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateEventAction } from "../../actions";

export const dynamic = "force-dynamic";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("*").eq("id", id).single();
  if (!event) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href={`/admin/events/${id}`} className="text-sm text-neutral-500 hover:underline">
        ← {event.name}
      </Link>
      <h1 className="text-2xl font-bold">행사 편집</h1>

      <form
        action={updateEventAction.bind(null, id)}
        className="space-y-4 rounded-lg border bg-white p-6"
      >
        <Field label="행사명" name="name" required defaultValue={event.name} />

        <div>
          <label className="mb-1 block text-sm font-medium">행사 유형</label>
          <select
            name="type"
            defaultValue={event.type}
            className="w-full rounded-lg border px-3 py-2"
          >
            <option value="FAMILY">가족</option>
            <option value="CORPORATE">기업</option>
            <option value="CLUB">동호회</option>
            <option value="SCHOOL">학교</option>
            <option value="ETC">기타</option>
          </select>
        </div>

        <Field
          label="시작 시각"
          name="start_at"
          type="datetime-local"
          required
          defaultValue={toLocalInput(event.start_at)}
        />
        <Field
          label="종료 시각"
          name="end_at"
          type="datetime-local"
          required
          defaultValue={toLocalInput(event.end_at)}
        />
        <Field label="장소" name="location" required defaultValue={event.location} />

        <div>
          <label className="mb-1 block text-sm font-medium">참가 단위</label>
          <select
            name="participation_type"
            defaultValue={event.participation_type}
            className="w-full rounded-lg border px-3 py-2"
          >
            <option value="BOTH">개인 + 팀</option>
            <option value="INDIVIDUAL">개인 전용</option>
            <option value="TEAM">팀 전용</option>
          </select>
        </div>

        <Field
          label="팀 최대 인원"
          name="max_team_size"
          type="number"
          defaultValue={String(event.max_team_size)}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="show_leaderboard"
            defaultChecked={event.show_leaderboard}
          />
          리더보드 공개
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="show_other_scores"
            defaultChecked={event.show_other_scores}
          />
          다른 참가자 점수 공개
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700"
        >
          저장
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
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
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
        defaultValue={defaultValue}
        className="w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-violet-500"
      />
    </div>
  );
}
