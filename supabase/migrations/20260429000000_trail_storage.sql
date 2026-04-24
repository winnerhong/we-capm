-- ============================================================
-- Partner Trail 커버 이미지 업로드 허용 정책
-- event-assets 버킷의 trails/ 경로에 누구나 insert 가능
-- (앱 레이어에서 requirePartner로 인증 체크함)
-- ============================================================

DROP POLICY IF EXISTS "event-assets: trail uploads" ON storage.objects;
CREATE POLICY "event-assets: trail uploads" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'event-assets'
  AND (storage.foldername(name))[1] = 'trails'
);

DROP POLICY IF EXISTS "event-assets: trail updates" ON storage.objects;
CREATE POLICY "event-assets: trail updates" ON storage.objects
FOR UPDATE TO anon, authenticated
USING (
  bucket_id = 'event-assets'
  AND (storage.foldername(name))[1] = 'trails'
);
