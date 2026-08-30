"use client";

// 지금 접속한 주소(https://toriro.app) — 공유 링크를 절대 주소로 만들 때 쓴다.
// 초대장·설문 등 "링크를 보내는" 화면이 모두 이 훅을 쓴다.
//
// 예전엔 두 컴포넌트가 각자 useEffect 로 setState 를 불렀다. 값이 바뀌는 일이
// 없는데도 마운트 직후 한 번 더 그려지고, react-hooks 규칙에도 걸린다
// ("Calling setState synchronously within an effect").
//
// useSyncExternalStore 는 이런 "서버엔 없고 클라이언트에만 있는 값" 을 위해
// 있는 훅이다. 구독할 게 없으니 구독 함수는 빈 정리 함수만 돌려준다.

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
const getClientOrigin = () => window.location.origin;
const getServerOrigin = () => "";

export function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    getClientOrigin,
    getServerOrigin
  );
}

/** origin 을 앞에 붙인 절대 주소. 서버 렌더 중에는 상대 경로 그대로. */
export function useAbsoluteUrl(path: string): string {
  const origin = useOrigin();
  return origin ? `${origin}${path}` : path;
}
