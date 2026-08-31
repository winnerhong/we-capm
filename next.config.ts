import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Turbopack이 상위 디렉토리로 올라가서 tailwindcss resolve 실패하는 문제 방지.
  // 빌드도 Turbopack 사용(package.json build 스크립트) — webpack 대비 메모리
  // 사용량이 훨씬 적어 Vercel 8GB 컨테이너 OOM 방지.
  turbopack: {
    root: path.resolve(__dirname),
  },

  async redirects() {
    return [
      // 없앤 「초대장」 화면 → 행사 목록.
      //
      // 이 주소가 카톡·북마크·지사 화면에 흩어져 있어 404 로 두면 막다른 길이
      // 된다. 페이지 안에서 redirect() 를 부르지 않고 여기 두는 이유: 스트리밍
      // 렌더 중의 redirect() 는 meta 태그를 심어 **클라이언트에서** 이동시키므로
      // 응답 자체는 200 이고, JS 가 없는 요청은 빈 껍데기를 받는다(직접 확인함).
      // config 리다이렉트는 proxy 보다도 먼저 검사돼 렌더 없이 진짜 307 을 준다.
      //
      // permanent: false — 308 은 브라우저가 영구 캐시한다. 되돌릴 일이 생기면
      // 캐시가 남은 사람만 계속 튕긴다. 내부 관리 화면이라 그 위험을 질 이유가 없다.
      //
      // :orgId 는 한 조각만 먹으므로 /invitations/templates 는 걸리지 않는다.
      // 템플릿은 기관 단위 자산이라 그대로 남아 있다.
      {
        source: "/org/:orgId/invitations",
        destination: "/org/:orgId/events",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
