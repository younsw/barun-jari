-- 006: 성인 인증 저장 (임시 출생연도 인증)
-- users.is_adult_verified는 화면에서 직접 바꿀 수 없으므로(001) 이 함수로만 저장합니다.
-- 출생연도는 판단에만 쓰고 저장하지 않습니다.
-- 기준: 청소년 보호법 '연 나이' — 한국 시간 올해 - 19 년생까지 성인 (src/features/auth/adultAge.ts와 같은 규칙)
--
-- ⚠️ 출생연도를 사용자가 직접 고르므로 실제 본인인증이 아닙니다.
--    포트원 본인인증을 붙이면 이 함수를 지우고, Edge Function(service role)이
--    포트원 API로 생년을 확인한 뒤 users를 직접 갱신하게 바꾸세요.

create function public.complete_adult_verification(p_birth_year integer)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  korean_year integer := extract(year from now() at time zone 'Asia/Seoul')::integer;
  verified timestamptz := now();
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요' using errcode = '28000';
  end if;
  if p_birth_year is null or p_birth_year < korean_year - 120 or p_birth_year > korean_year then
    raise exception '출생연도를 확인해 주세요' using errcode = '22023';
  end if;
  if p_birth_year > korean_year - 19 then
    raise exception '%년생 이후 출생자는 가입할 수 없어요', korean_year - 18 using errcode = '42501';
  end if;

  update public.users
  set is_adult_verified = true, verified_at = verified
  where id = auth.uid();
  return verified;
end;
$$;

revoke execute on function public.complete_adult_verification(integer) from public, anon;
grant execute on function public.complete_adult_verification(integer) to authenticated;
