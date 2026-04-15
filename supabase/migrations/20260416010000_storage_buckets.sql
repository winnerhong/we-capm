-- =====================================================================
-- Storage buckets for submissions + event assets
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('submission-photos', 'submission-photos', false, 5242880,
   array['image/jpeg','image/png','image/webp','image/heic']::text[]),
  ('submission-videos', 'submission-videos', false, 52428800,
   array['video/mp4','video/webm','video/quicktime']::text[]),
  ('event-assets', 'event-assets', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/svg+xml']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Helper: is user participant in event?
create or replace function public.is_event_participant(event_uuid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.participants
    where event_id = event_uuid and user_id = auth.uid()
  )
$$;

-- Path convention: {event_id}/{participant_id}/{submission_id}/{filename}
-- Participant can upload to their own participant_id folder within their event
create policy "submission-photos: participant upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'submission-photos'
    and (storage.foldername(name))[1]::uuid in (
      select event_id::text::uuid from public.participants where user_id = auth.uid()
    )
    and (storage.foldername(name))[2]::uuid in (
      select id from public.participants where user_id = auth.uid()
    )
  );

create policy "submission-photos: owner or staff read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'submission-photos'
    and (
      public.is_admin()
      or public.is_event_staff((storage.foldername(name))[1]::uuid)
      or (storage.foldername(name))[2]::uuid in (
        select id from public.participants where user_id = auth.uid()
      )
    )
  );

create policy "submission-videos: participant upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'submission-videos'
    and (storage.foldername(name))[1]::uuid in (
      select event_id::text::uuid from public.participants where user_id = auth.uid()
    )
    and (storage.foldername(name))[2]::uuid in (
      select id from public.participants where user_id = auth.uid()
    )
  );

create policy "submission-videos: owner or staff read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'submission-videos'
    and (
      public.is_admin()
      or public.is_event_staff((storage.foldername(name))[1]::uuid)
      or (storage.foldername(name))[2]::uuid in (
        select id from public.participants where user_id = auth.uid()
      )
    )
  );

create policy "event-assets: public read"
  on storage.objects for select to public
  using (bucket_id = 'event-assets');

create policy "event-assets: admin/staff write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-assets'
    and (public.is_admin() or public.is_event_staff((storage.foldername(name))[1]::uuid))
  );
