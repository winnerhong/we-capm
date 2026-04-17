import { getAllSchools, getExternalEvents } from "@/lib/school-db";
import { NewEventForm } from "./new-event-form";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const [schools, extEvents] = await Promise.all([getAllSchools(), getExternalEvents()]);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">새 행사 만들기</h1>
      <NewEventForm
        schools={schools.map((s) => ({ id: s.id, name: s.name, username: s.username, phone: s.phone ?? "", district: s.district ?? "" }))}
        externalEvents={extEvents}
      />
    </div>
  );
}
