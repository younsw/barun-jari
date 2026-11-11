-- 013: 성인 인증 단계 없애기 + 관리자 지정·해제
--
-- 1) 성인 인증 단계 없이 가입하면 바로 이용할 수 있게 한다.
--    users.is_adult_verified는 남겨 두고 가입 시 자동으로 true가 된다.
--    (신고·현장 인증 함수가 이 값을 확인하므로 그대로 둔다. 나중에 본인확인 업체를 붙이면 기본값을 false로 되돌린다.)
--    출생연도만 보내면 인증되던 006의 함수는 지운다.
-- 2) 관리자는 회원 목록을 보고, 다른 회원을 관리자로 지정하거나 일반 회원으로 바꿀 수 있다.
--    관리자가 0명이 되는 변경은 막는다. 새로 가입한 회원은 일반 회원(is_admin = false)이다.

-- 1) 성인 인증 단계 없애기
drop function if exists public.complete_adult_verification(integer);

alter table public.users
  alter column is_adult_verified set default true,
  alter column verified_at set default now();

update public.users
set is_adult_verified = true, verified_at = coalesce(verified_at, created_at)
where not is_adult_verified;

-- users 행은 가입 트리거(handle_new_user)만 만든다. 화면에서 is_admin을 넣은 행을 직접 만들 수 없게 권한을 없앤다.
-- (RLS에 insert 정책이 없어 지금도 막혀 있지만, 권한 자체를 회수해 둔다)
revoke insert on public.users from anon, authenticated;

-- 2) 관리자: 회원 목록
create function public.admin_list_members()
returns table (user_id uuid, email text, nickname text, is_admin boolean, joined_at timestamptz, points integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin: 관리자만 볼 수 있어요.' using errcode = '42501';
  end if;
  return query
    select u.id, a.email::text, u.nickname, u.is_admin, u.created_at,
      (select coalesce(sum(p.amount), 0)::integer from public.point_ledger p where p.user_id = u.id)
    from public.users u
    join auth.users a on a.id = u.id
    order by u.is_admin desc, u.created_at;
end;
$$;

-- 3) 관리자: 회원을 관리자로 지정(true) / 일반 회원으로 변경(false)
create function public.admin_set_member_role(p_user_id uuid, p_is_admin boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  was_admin boolean;
begin
  if not public.is_admin() then
    raise exception 'admin: 관리자만 바꿀 수 있어요.' using errcode = '42501';
  end if;
  if p_user_id is null or p_is_admin is null then
    raise exception 'admin: 회원과 권한을 확인해 주세요.' using errcode = '22023';
  end if;

  -- 두 관리자가 동시에 서로를 해제해 관리자가 0명이 되지 않도록 한 번에 하나씩 처리한다
  perform pg_advisory_xact_lock(hashtext('barunjari:admin-roles'));

  select u.is_admin into was_admin from public.users u where u.id = p_user_id for update;
  if was_admin is null then
    raise exception 'admin: 회원을 찾을 수 없어요.' using errcode = 'P0002';
  end if;
  if was_admin = p_is_admin then
    return p_is_admin;
  end if;
  if not p_is_admin and (select count(*) from public.users u where u.is_admin) <= 1 then
    raise exception 'admin: 관리자가 최소 1명은 있어야 해요.' using errcode = 'P0001';
  end if;

  update public.users set is_admin = p_is_admin where id = p_user_id;
  return p_is_admin;
end;
$$;

revoke execute on function public.admin_list_members() from public, anon;
grant execute on function public.admin_list_members() to authenticated;
revoke execute on function public.admin_set_member_role(uuid, boolean) from public, anon;
grant execute on function public.admin_set_member_role(uuid, boolean) to authenticated;
