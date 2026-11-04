-- 012: 성인 인증을 관리자 승인 방식으로 변경
--
-- 문제: 006의 complete_adult_verification(p_birth_year)는 로그인한 누구나 API로 직접 호출할 수 있어서
--       화면을 거치지 않고 아무 출생연도(예: 1990)만 넣으면 바로 성인 인증이 됐다.
-- 변경: 회원은 "인증 요청"만 할 수 있고, is_adult_verified는 관리자가 승인해야만 true가 된다.
--
-- 흐름: none(요청 전) → pending(승인 대기) → approved(승인) / rejected(반려, 다시 요청 가능)
-- 회원이 적은 출생연도는 관리자가 판단할 때만 쓰고, 승인·반려하면 지운다.

-- 1) 우회 경로 제거
drop function if exists public.complete_adult_verification(integer);

-- 2) 승인 상태 컬럼
alter table public.users
  add column adult_status text not null default 'none'
    check (adult_status in ('none', 'pending', 'approved', 'rejected')),
  add column adult_requested_at timestamptz,
  add column adult_declared_birth_year integer,
  add column adult_reviewed_at timestamptz,
  add column adult_reviewed_by uuid references public.users (id) on delete set null,
  add column adult_reject_reason text check (char_length(adult_reject_reason) <= 200);

-- 기존에 인증된 회원은 일단 승인 상태로 옮긴다.
update public.users set adult_status = 'approved' where is_adult_verified;

-- ⚠️ 우회로 인증된 계정을 가려낼 수 없으므로, 기존 회원을 모두 다시 승인받게 하려면
--    아래 주석을 풀고 실행하세요. (관리자는 제외)
-- update public.users
--   set is_adult_verified = false, verified_at = null, adult_status = 'none'
--   where is_adult_verified and not is_admin;

-- is_adult_verified와 adult_status가 어긋나지 않게
alter table public.users add constraint users_adult_status_consistent
  check (is_adult_verified = (adult_status = 'approved'));

-- 새 컬럼도 화면에서 직접 바꿀 수 없다. (001에서 nickname만 update 허용)

-- 3) 회원: 성인 인증 요청 (출생연도 자기 신고)
create function public.request_adult_verification(p_birth_year integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  korean_year integer := extract(year from now() at time zone 'Asia/Seoul')::integer;
  current_status text;
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

  select adult_status into current_status from public.users where id = auth.uid() for update;
  if current_status is null then
    raise exception '회원 정보를 찾을 수 없어요' using errcode = 'P0002';
  end if;
  if current_status = 'approved' then
    return current_status;  -- 이미 승인됨: 아무것도 바꾸지 않는다
  end if;

  update public.users
  set adult_status = 'pending',
      adult_requested_at = now(),
      adult_declared_birth_year = p_birth_year,
      adult_reject_reason = null
  where id = auth.uid();
  return 'pending';
end;
$$;

-- 4) 관리자: 승인 대기 목록
create function public.list_pending_adult_verifications()
returns table (
  user_id uuid,
  nickname text,
  email text,
  declared_birth_year integer,
  requested_at timestamptz,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 볼 수 있어요' using errcode = '42501';
  end if;
  return query
    select u.id, u.nickname, a.email::text, u.adult_declared_birth_year, u.adult_requested_at, u.created_at
    from public.users u
    join auth.users a on a.id = u.id
    where u.adult_status = 'pending'
    order by u.adult_requested_at;
end;
$$;

-- 5) 관리자: 승인 / 반려
create function public.review_adult_verification(p_user_id uuid, p_approve boolean, p_reason text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if not public.is_admin() then
    raise exception '관리자만 처리할 수 있어요' using errcode = '42501';
  end if;

  select adult_status into current_status from public.users where id = p_user_id for update;
  if current_status is null then
    raise exception '회원을 찾을 수 없어요' using errcode = 'P0002';
  end if;
  if current_status <> 'pending' then
    raise exception '승인 대기 중인 요청이 아니에요' using errcode = '55000';
  end if;

  if p_approve then
    update public.users
    set adult_status = 'approved', is_adult_verified = true, verified_at = now(),
        adult_reviewed_at = now(), adult_reviewed_by = auth.uid(),
        adult_declared_birth_year = null, adult_reject_reason = null
    where id = p_user_id;
    return 'approved';
  end if;

  update public.users
  set adult_status = 'rejected', is_adult_verified = false, verified_at = null,
      adult_reviewed_at = now(), adult_reviewed_by = auth.uid(),
      adult_declared_birth_year = null,
      adult_reject_reason = nullif(left(trim(coalesce(p_reason, '')), 200), '')
  where id = p_user_id;
  return 'rejected';
end;
$$;

-- 6) 권한: 로그인한 회원만 호출 (관리자 여부는 함수 안에서 다시 확인)
revoke execute on function public.request_adult_verification(integer) from public, anon;
grant execute on function public.request_adult_verification(integer) to authenticated;
revoke execute on function public.list_pending_adult_verifications() from public, anon;
grant execute on function public.list_pending_adult_verifications() to authenticated;
revoke execute on function public.review_adult_verification(uuid, boolean, text) from public, anon;
grant execute on function public.review_adult_verification(uuid, boolean, text) to authenticated;

-- 7) users 행은 가입 트리거만 만든다. 화면에서 is_admin·is_adult_verified를 넣은 행을 직접 만들 수 없게 막는다.
--    (RLS에 insert 정책이 없어 지금도 막혀 있지만, 권한 자체를 없애 둔다)
revoke insert on public.users from anon, authenticated;
