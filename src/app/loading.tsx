export default function RootLoading() {
  return (
    <main className="min-h-dvh bg-neutral-50 p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-3 w-16 animate-pulse rounded bg-neutral-200" />
            <div className="h-6 w-32 animate-pulse rounded bg-neutral-200" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-10 animate-pulse rounded-lg bg-neutral-200" />
            <div className="h-8 w-20 animate-pulse rounded-lg bg-neutral-200" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-16 animate-pulse rounded bg-neutral-200" />
          <div className="h-20 animate-pulse rounded-lg bg-neutral-200" />
        </div>
      </div>
    </main>
  );
}
