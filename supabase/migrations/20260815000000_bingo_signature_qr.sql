-- 토리 빙고 — ✍️ 싸인 받기 입력 방식 (숫자코드 ↔ QR 짝꿍).
--   signature_method = 'CODE' : 사진 주인의 4자리 인증번호를 직접 입력
--   signature_method = 'QR'   : 짝꿍(사진 주인)의 QR을 카메라로 찍어 인증
--   (QR 은 같은 signature_code 를 인코딩 — 백엔드 검증 로직 동일)

ALTER TABLE org_bingo_boards
  ADD COLUMN IF NOT EXISTS signature_method text NOT NULL DEFAULT 'CODE'
  CHECK (signature_method IN ('CODE', 'QR'));

COMMENT ON COLUMN org_bingo_boards.signature_method IS
  '싸인 인증 방식. CODE=4자리 숫자 입력, QR=짝꿍 QR 스캔. signature_mode 가 true 일 때만 의미.';
