-- 011: 현장 인증 반경을 30m로 줄입니다 (009는 150m, GPS 정확도 100m)
-- 시설에서 30m 이내, GPS 정확도 30m 이내일 때만 인증됩니다. 나머지 규칙(성인 인증, 사진, 하루 1번, 2P)은 009와 같습니다.
-- 신고(008)는 시설 좌표가 틀린 경우도 신고할 수 있어야 해서 150m를 그대로 둡니다.

create or replace function public.complete_onsite_checkin(
  p_facility_id bigint,
  p_photo_path text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m real
)
returns table (checkin_id bigint, distance_m real, points_awarded integer, today_points integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_accuracy_m constant real := 30;
  max_distance_m constant real := 30;
  checkin_points constant integer := 2;
  uid uuid := auth.uid();
  facility record;
  dist real;
  new_id bigint;
  granted integer;
begin
  if uid is null then
    raise exception 'onsite: 로그인이 필요해요.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.users where id = uid and is_adult_verified) then
    raise exception 'onsite: 성인 인증을 마친 회원만 현장 인증을 할 수 있어요.' using errcode = 'P0001';
  end if;
  if p_photo_path is null then
    raise exception 'onsite: 현장 사진을 촬영해 주세요.' using errcode = 'P0001';
  end if;
  if p_latitude is null or p_longitude is null or p_accuracy_m is null then
    raise exception 'onsite: 현재 위치를 확인해 주세요.' using errcode = 'P0001';
  end if;
  if p_accuracy_m > max_accuracy_m then
    raise exception 'onsite: GPS 정확도가 낮아요 (%m, %m 이내여야 해요). 하늘이 트인 곳에서 다시 시도해 주세요.', round(p_accuracy_m), max_accuracy_m
      using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'report-photos' and name = p_photo_path and owner_id = uid::text
  ) then
    raise exception 'onsite: 현장 사진을 찾을 수 없어요. 다시 촬영해 주세요.' using errcode = 'P0001';
  end if;

  select f.latitude, f.longitude into facility from public.smoking_facilities f where f.id = p_facility_id;
  if not found then
    raise exception 'onsite: 존재하지 않는 장소예요.' using errcode = 'P0001';
  end if;
  if facility.latitude is null or facility.longitude is null then
    raise exception 'onsite: 아직 위치 정보가 없는 장소라 현장 인증을 할 수 없어요.' using errcode = 'P0001';
  end if;

  dist := public.distance_m(p_latitude, p_longitude, facility.latitude, facility.longitude);
  if dist > max_distance_m then
    raise exception 'onsite: 장소에서 %m 떨어져 있어요. 현장(%m 이내)에서 인증해 주세요.', round(dist), max_distance_m
      using errcode = 'P0001';
  end if;

  begin
    insert into public.facility_checkins (user_id, facility_id, photo_path, reporter_latitude, reporter_longitude, location_accuracy_m, distance_m)
    values (uid, p_facility_id, p_photo_path, p_latitude, p_longitude, p_accuracy_m, dist)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'onsite: 오늘 이미 인증한 장소예요. 내일 다시 인증할 수 있어요.' using errcode = 'P0001';
  end;

  granted := public.award_points(uid, checkin_points, 'onsite_checkin', 'checkin:' || new_id);
  update public.facility_checkins c set points_awarded = granted where c.id = new_id;

  return query
    select new_id, dist, granted,
      (select coalesce(sum(amount), 0)::integer from public.point_ledger
       where user_id = uid and (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date);
end;
$$;

revoke execute on function public.complete_onsite_checkin(bigint, text, double precision, double precision, real) from public, anon;
grant execute on function public.complete_onsite_checkin(bigint, text, double precision, double precision, real) to authenticated;
