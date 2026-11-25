-- 018: 닉네임 중복 금지
--
-- 1) 이미 같은 닉네임(대소문자 무시)을 쓰는 회원이 있으면 먼저 가입한 사람은 그대로 두고,
--    나중에 가입한 사람 닉네임 뒤에 숫자를 붙인다 (예: 바른이 → 바른이2). 화면 규칙(2~12자)에 맞게 앞 10자만 남긴다.
-- 2) users.nickname에 대소문자를 무시하는 유일 인덱스를 건다.
-- 3) 가입 화면에서 미리 확인할 수 있게 is_nickname_available()을 만든다 (로그인 전에도 호출 가능, 내 닉네임은 사용 가능으로 본다).
-- 4) 가입 트리거(handle_new_user): 확인과 가입 사이에 다른 사람이 같은 닉네임을 먼저 가져가면 가입이 실패하지 않게 숫자를 붙인다.
-- 만든 날: 2026-11-25

-- 1) 기존 중복 정리
do $$
declare
  dup record;
  candidate text;
  n integer;
begin
  for dup in
    select id, nickname from (
      select u.id, u.nickname, row_number() over (partition by lower(u.nickname) order by u.created_at, u.id) as rn
      from public.users u
    ) d where d.rn > 1
  loop
    n := 2;
    loop
      candidate := left(dup.nickname, 10) || n;
      exit when not exists (select 1 from public.users where lower(nickname) = lower(candidate));
      n := n + 1;
    end loop;
    update public.users set nickname = candidate where id = dup.id;
  end loop;
end;
$$;

-- 2) 중복 금지
create unique index users_nickname_unique on public.users (lower(nickname));

-- 3) 닉네임 사용 가능 여부
create function public.is_nickname_available(p_nickname text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.users u
    where lower(u.nickname) = lower(trim(p_nickname))
      and u.id is distinct from auth.uid()
  );
$$;
revoke execute on function public.is_nickname_available(text) from public;
grant execute on function public.is_nickname_available(text) to anon, authenticated;

-- 4) 가입 트리거: 닉네임이 겹치면 숫자를 붙여 가입은 성공시킨다
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), '사용자' || left(new.id::text, 6));
  candidate text := wanted;
  n integer := 2;
begin
  while exists (select 1 from public.users where lower(nickname) = lower(candidate)) loop
    candidate := left(wanted, 10) || n;
    n := n + 1;
  end loop;
  insert into public.users (id, nickname) values (new.id, candidate);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
