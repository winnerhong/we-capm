import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Turbopack이 상위 디렉토리로 올라가서 tailwindcss resolve 실패하는 문제 방지
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Vercel 빌드 컨테이너(8GB) OOM(SIGKILL) 방지 — webpack 빌드 최대 메모리
  // 사용량을 줄이는 공식 옵션 (Next 15+, low-risk). 빌드 시간만 약간 늘어남.
  experimental: {
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
