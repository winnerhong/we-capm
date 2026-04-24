import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Turbopack이 상위 디렉토리로 올라가서 tailwindcss resolve 실패하는 문제 방지
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
