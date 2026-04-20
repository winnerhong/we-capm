export function CardSkeleton() {
  return (
    <div
      className="rounded-2xl border border-[#D4E4BC] bg-white p-4 animate-pulse"
      role="status"
      aria-label="불러오는 중"
    >
      <div className="h-4 w-3/4 bg-[#E8F0E4] rounded mb-2"></div>
      <div className="h-3 w-1/2 bg-[#E8F0E4] rounded mb-4"></div>
      <div className="h-20 bg-[#E8F0E4] rounded"></div>
      <span className="sr-only">불러오는 중입니다</span>
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="목록 불러오는 중">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
      <span className="sr-only">목록을 불러오는 중입니다</span>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div
      className="rounded-2xl border border-[#D4E4BC] bg-white p-4 animate-pulse"
      role="status"
      aria-label="표 불러오는 중"
    >
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-10 bg-[#E8F0E4] rounded flex items-center px-3"
          >
            <div className="h-3 w-1/4 bg-white rounded"></div>
          </div>
        ))}
      </div>
      <span className="sr-only">표를 불러오는 중입니다</span>
    </div>
  );
}
