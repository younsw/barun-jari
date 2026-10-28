-- 007: 오류 신고 현장 사진 (앱 내 카메라 촬영본만)
-- 사진은 비공개 Storage 버킷 report-photos/{user_id}/{파일}.jpg 에 저장하고,
-- reports.photo_path에 그 경로를 남깁니다.
-- 갤러리 업로드 금지는 화면(CameraCapture.tsx)에서 막습니다. 서버는 파일 형식·크기·본인 폴더만 검사합니다.

alter table public.reports add column photo_path text;

-- 다른 사람 폴더의 사진을 내 신고에 붙일 수 없게
alter table public.reports add constraint reports_photo_path_owner
  check (photo_path is null or photo_path like user_id::text || '/%');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 5242880, array['image/jpeg']);

-- 성인 인증 회원만 내 폴더에 올리기
create policy "report-photos: 인증 회원 내 폴더 업로드" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.users where id = auth.uid() and is_adult_verified)
  );

-- 내 사진 또는 관리자만 보기
create policy "report-photos: 내 사진 또는 관리자 보기" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'report-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- 신고 저장에 실패했을 때 방금 올린 내 사진 지우기
create policy "report-photos: 내 사진 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'report-photos' and (storage.foldername(name))[1] = auth.uid()::text);
