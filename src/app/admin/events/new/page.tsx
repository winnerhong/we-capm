import { getAllSchools, getExternalEvents } from "@/lib/school-db";
import { NewEventForm } from "./new-event-form";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const [schools, extEvents] = await Promise.all([getAllSchools(), getExternalEvents()]);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-[#2D5A3D] via-[#3A7A52] to-[#4A7C59] p-6 text-white shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <span>🌲</span>
          <span>새 숲길 행사 만들기</span>
        </h1>
        <p className="mt-1 text-sm text-white/80">도토리 탐험가들과 함께할 새로운 숲길을 열어봐요</p>
      </div>
      <NewEventForm
        schools={schools.map((s) => ({ id: s.id, name: s.name, username: s.username, phone: s.phone ?? "", district: s.district ?? "" }))}
        externalEvents={extEvents}
      />
    </div>
  );
}
