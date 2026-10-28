-- 001: 회원 정보 (Supabase Auth의 auth.users와 1:1)
-- 성인 인증 결과만 저장합니다. 주민번호·생년월일 원본은 저장하지 않습니다.

create table public.users (
  id                uuid primary key references auth.users (id) on delete cascade,
  nickname          text not null check (char_length(nickname) between 2 and 20),
  is_adult_verified boolean not null default false,
  verified_at       timestamptz,
  is_admin          boolean not null default false,  -- 신고 처리 권한
  created_at        timestamptz not null default now()
);

-- 관리자 여부 (RLS 정책에서 사용)
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false);
$$;

-- 회원가입 시 users 행 자동 생성 (닉네임은 signUp의 options.data.nickname)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nickname', '사용자' || left(new.id::text, 6)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 권한: 내 정보만 보고, 닉네임만 직접 바꿀 수 있음
-- (성인 인증·관리자 여부는 서버(service role)에서만 변경)
alter table public.users enable row level security;

create policy "users: 내 정보 보기" on public.users
  for select to authenticated
  using (id = auth.uid());

create policy "users: 내 닉네임 수정" on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.users from anon, authenticated;
grant update (nickname) on public.users to authenticated;
