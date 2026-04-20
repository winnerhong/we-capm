export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:bg-[#2D5A3D] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
    >
      본문으로 건너뛰기
    </a>
  );
}
