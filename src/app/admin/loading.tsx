export default function AdminLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-32 animate-pulse rounded bg-neutral-200" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-neutral-200" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-neutral-200" />
    </div>
  );
}
