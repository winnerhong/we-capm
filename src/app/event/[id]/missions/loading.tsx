export default function MissionsLoading() {
  return (
    <main className="min-h-dvh bg-neutral-50 p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="h-28 animate-pulse rounded-lg bg-violet-200" />
        <ul className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-20 animate-pulse rounded-lg bg-neutral-200" />
          ))}
        </ul>
      </div>
    </main>
  );
}
