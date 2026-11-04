-- 008: 신고 현장 인증 (위치 + 사진 둘 다 필수)
-- 신고할 때 앱 내 카메라 사진과 현재 GPS 위치를 반드시 함께 보내야 합니다.
-- 서버(트리거)가 다시 확인하는 것:
--   1) 사진이 report-photos 버킷의 내 폴더에 실제로 올라가 있는지
--   2) GPS 정확도가 100m 이내인지
--   3) 시설 좌표가 있으면 신고 위치가 시설에서 150m 이내인지 (아니면 거부)
-- 시설 좌표가 아직 없으면(지오코딩 전) 거리는 계산할 수 없어 location_verified = false로 저장하고,
-- 관리자가 신고 위치(reporter_latitude/longitude)를 보고 판단합니다.
-- 주의: 브라우저 GPS 값은 조작할 수 있어 완전한 증명은 아닙니다. 사진과 함께 보조 근거로 씁니다.

alter table public.reports
  add column reporter_latitude   double precision,
  add column reporter_longitude  double precision,
  add column location_accuracy_m real,
  add column distance_m          real,
  add column location_verified   boolean not null default false;

-- 기존 신고가 없어서 바로 필수로 바꿀 수 있습니다.
alter table public.reports
  alter column photo_path set not null,
  alter column reporter_latitude set not null,
  alter column reporter_longitude set not null,
  alter column location_accuracy_m set not null,
  add constraint reports_reporter_latitude_range check (reporter_latitude between -90 and 90),
  add constraint reports_reporter_longitude_range check (reporter_longitude between -180 and 180),
  add constraint reports_location_accuracy_range check (location_accuracy_m >= 0);

-- 두 좌표 사이 거리(미터), 하버사인 공식
create function public.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

create function public.verify_report_onsite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_accuracy_m constant real := 100;
  max_distance_m constant real := 150;
  facility record;
begin
  -- not null 제약보다 트리거가 먼저 돌기 때문에 빠진 값은 여기서 안내 문구로 거부
  if new.photo_path is null then
    raise exception 'onsite: 현장 사진을 촬영해 주세요.' using errcode = 'P0001';
  end if;
  if new.reporter_latitude is null or new.reporter_longitude is null or new.location_accuracy_m is null then
    raise exception 'onsite: 현재 위치를 확인해 주세요.' using errcode = 'P0001';
  end if;

  if new.location_accuracy_m > max_accuracy_m then
    raise exception 'onsite: GPS 정확도가 낮아요 (%m). 실외에서 다시 시도해 주세요.', round(new.location_accuracy_m)
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'report-photos' and name = new.photo_path and owner_id = new.user_id::text
  ) then
    raise exception 'onsite: 현장 사진을 찾을 수 없어요. 다시 촬영해 주세요.' using errcode = 'P0001';
  end if;

  select latitude, longitude into facility
  from public.smoking_facilities where id = new.facility_id;

  -- 클라이언트가 보낸 값은 무시하고 서버가 다시 계산
  new.distance_m := null;
  new.location_verified := false;

  if facility.latitude is not null and facility.longitude is not null then
    new.distance_m := public.distance_m(new.reporter_latitude, new.reporter_longitude, facility.latitude, facility.longitude);
    if new.distance_m > max_distance_m then
      raise exception 'onsite: 장소에서 %m 떨어져 있어요. 현장(150m 이내)에서 신고해 주세요.', round(new.distance_m)
        using errcode = 'P0001';
    end if;
    new.location_verified := true;
  end if;

  return new;
end;
$$;

create trigger reports_verify_onsite
  before insert on public.reports
  for each row execute function public.verify_report_onsite();

revoke execute on function public.verify_report_onsite() from public, anon, authenticated;

-- 거리·인증 여부는 화면에서 바꿀 수 없게 (insert 때 트리거가 덮어쓰고, update는 status만 허용된 상태 유지)
