import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Turbopack이 상위 디렉토리로 올라가서 tailwindcss resolve 실패하는 문제 방지.
  // 빌드도 Turbopack 사용(package.json build 스크립트) — webpack 대비 메모리
  // 사용량이 훨씬 적어 Vercel 8GB 컨테이너 OOM 방지.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
