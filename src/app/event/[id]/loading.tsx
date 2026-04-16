export default function EventLoading() {
  return (
    <main className="min-h-dvh bg-neutral-50 p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="h-4 w-20 animate-pulse rounded bg-neutral-200" />
        <div className="h-36 animate-pulse rounded-lg bg-violet-200" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 animate-pulse rounded-lg bg-neutral-200" />
          <div className="h-24 animate-pulse rounded-lg bg-neutral-200" />
          <div className="h-24 animate-pulse rounded-lg bg-neutral-200" />
          <div className="h-24 animate-pulse rounded-lg bg-neutral-200" />
        </div>
      </div>
    </main>
  );
}
