// 관제실 데이터 로더 — backend `@/lib/control-room/queries` 의
// `loadControlRoomSnapshot` 을 그대로 re-export.
// 이전 mock fallback 은 backend 완성 시점에 삭제됨.

export { loadControlRoomSnapshot as loadSnapshotSafe } from "@/lib/control-room/queries";
