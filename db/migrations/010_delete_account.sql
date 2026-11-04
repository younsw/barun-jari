-- 010: 회원 탈퇴
-- 로그인한 본인 계정(auth.users)을 지웁니다. on delete cascade로 아래가 함께 지워집니다:
--   public.users → reports, point_ledger, facility_checkins
-- 사진(Storage report-photos/{user_id}/...)은 SQL로 지울 수 없어 화면이 Storage API로 먼저 지웁니다.
-- 탈퇴 후 같은 이메일로 다시 가입할 수 있습니다.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception '로그인이 필요해요.' using errcode = 'P0001';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
