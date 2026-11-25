-- 017: 보안 강화 (실서비스 기준 취약점 점검 결과 반영)
--
-- 1) 테이블 권한 최소화: Supabase 기본값으로 anon/authenticated에 열려 있던 쓰기·TRUNCATE 권한을 회수하고
--    화면에 꼭 필요한 권한만 다시 준다. (지금은 RLS가 막고 있지만, 정책 실수 한 번에 뚫리지 않게 이중으로 막는다)
--    - reports insert는 사용자가 쓰는 칸(시설·유형·내용·사진·위치)만 허용
--      → 신고 작성 때 admin_reply·handled_by·handled_at·created_at을 넣어 관리자 답변·처리자를 위조하던 문제를 막는다
--    - reports 상태 직접 수정(update status) 권한과 정책 제거
--      → 상태 변경은 admin_update_report()로만 (처리 기록·되돌리기 방지 규칙을 건너뛰지 못하게)
-- 2) 사진 재사용 방지: 신고·현장 인증 사진은 10분 안에 올린 것이어야 하고, 한 번 쓴 사진은 다시 쓸 수 없다
--    → 사진 한 장으로 매일 반복 인증해 포인트를 받던 우회를 막는다
-- 3) 남용 제한: 신고는 하루(한국 시간) 10건, 사진 업로드는 하루 30장까지
-- 4) security definer 함수의 search_path를 ''로 고정 (001·004에서 public으로 남아 있던 것)
-- 만든 날: 2026-11-25

-- 1) 테이블 권한 최소화 -------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger
  on public.users, public.smoking_facilities, public.reports, public.point_ledger,
     public.facility_checkins, public.admin_actions, public.sponsors, public.sponsor_transactions
  from anon, authenticated;

-- 로그인 전에는 흡연시설 목록만 볼 수 있다 (나머지 테이블은 RLS 정책도 authenticated 전용)
revoke select on public.users, public.reports, public.point_ledger, public.facility_checkins,
  public.admin_actions, public.sponsors, public.sponsor_transactions from anon;

grant update (nickname) on public.users to authenticated;
grant insert (facility_id, type, content, photo_path, reporter_latitude, reporter_longitude, location_accuracy_m)
  on public.reports to authenticated;

drop policy if exists "reports: 관리자 상태 변경" on public.reports;

-- 2)·3) 사진 확인 ----------------------------------------------------------------------
-- 오늘(한국 시간) 내가 올린 사진 수 (업로드 정책에서 사용)
create function public.photo_uploads_today()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from storage.objects o
  where o.bucket_id = 'report-photos'
    and o.owner_id = auth.uid()::text
    and (o.created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date;
$$;
revoke execute on function public.photo_uploads_today() from public, anon;
grant execute on function public.photo_uploads_today() to authenticated;

drop policy if exists "report-photos: 인증 회원 내 폴더 업로드" on storage.objects;
create policy "report-photos: 인증 회원 내 폴더 업로드" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.users where id = auth.uid() and is_adult_verified)
    and public.photo_uploads_today() < 30
  );

-- 방금(10분 안) 찍어 올린 내 사진이고, 다른 신고·인증에 쓰지 않은 사진인지 확인
create function public.assert_fresh_photo(p_user_id uuid, p_photo_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'report-photos' and o.name = p_photo_path and o.owner_id = p_user_id::text
      and o.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'onsite: 방금 촬영한 사진이 필요해요. 다시 촬영해 주세요.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.reports r where r.photo_path = p_photo_path)
     or exists (select 1 from public.facility_checkins c where c.photo_path = p_photo_path) then
    raise exception 'onsite: 이미 사용한 사진이에요. 다시 촬영해 주세요.' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.assert_fresh_photo(uuid, text) from public, anon, authenticated;

-- 신고 저장 전: 관리자 칸 초기화, 하루 10건 제한, 사진 확인
create function public.guard_report_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  daily_limit constant integer := 10;
begin
  -- 권한으로도 막지만, 혹시 권한이 다시 열려도 사용자가 넣은 값은 쓰지 않는다
  new.user_id := coalesce(auth.uid(), new.user_id);
  new.status := 'received';
  new.admin_reply := null;
  new.handled_by := null;
  new.handled_at := null;
  new.created_at := now();
  new.updated_at := now();

  perform pg_advisory_xact_lock(hashtext('reports:' || new.user_id::text));
  if (select count(*) from public.reports r
      where r.user_id = new.user_id
        and (r.created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date) >= daily_limit then
    raise exception 'onsite: 신고는 하루 %건까지 할 수 있어요.', daily_limit using errcode = 'P0001';
  end if;

  if new.photo_path is not null then
    perform public.assert_fresh_photo(new.user_id, new.photo_path);
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_report_insert() from public, anon, authenticated;

-- 트리거는 이름 순서로 돈다: reports_guard_insert → reports_verify_onsite(008)
create trigger reports_guard_insert
  before insert on public.reports
  for each row execute function public.guard_report_insert();

-- 현장 인증 저장 전: 사진 확인 (complete_onsite_checkin()이 넣는 행에도 적용)
create function public.guard_checkin_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_fresh_photo(new.user_id, new.photo_path);
  return new;
end;
$$;
revoke execute on function public.guard_checkin_insert() from public, anon, authenticated;

create trigger facility_checkins_guard_insert
  before insert on public.facility_checkins
  for each row execute function public.guard_checkin_insert();

-- 4) search_path 고정 -----------------------------------------------------------------
alter function public.is_admin() set search_path = '';
alter function public.handle_new_user() set search_path = '';

create or replace function public.award_points(p_user_id uuid, p_amount integer, p_reason text, p_ref_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  daily_limit constant integer := 10;
  today_sum integer;
  granted integer;
begin
  perform pg_advisory_xact_lock(hashtext('points:' || p_user_id::text));

  if p_ref_id is not null and exists (
    select 1 from public.point_ledger where user_id = p_user_id and ref_id = p_ref_id
  ) then
    return 0;
  end if;

  select coalesce(sum(amount), 0) into today_sum
  from public.point_ledger
  where user_id = p_user_id
    and (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date;

  granted := least(p_amount, daily_limit - today_sum);
  if granted <= 0 then
    return 0;
  end if;

  insert into public.point_ledger (user_id, amount, reason, ref_id)
  values (p_user_id, granted, p_reason, p_ref_id);
  return granted;
end;
$$;
revoke execute on function public.award_points(uuid, integer, text, text) from public, anon, authenticated;

create or replace function public.get_my_point_summary()
returns table (total integer, today integer, daily_limit integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(amount), 0)::integer,
    coalesce(sum(amount) filter (
      where (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date
    ), 0)::integer,
    10
  from public.point_ledger
  where user_id = auth.uid();
$$;
revoke execute on function public.get_my_point_summary() from public, anon;
grant execute on function public.get_my_point_summary() to authenticated;
