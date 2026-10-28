-- 005: 함수 권한 정리 (Supabase 보안 점검 반영)

-- 트리거 전용 함수: API로 직접 호출 불가
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.reward_accepted_report() from public, anon, authenticated;

-- 로그인한 회원만 호출 (RLS 정책과 포인트 화면에서 사용)
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.get_my_point_summary() from public, anon;
grant execute on function public.get_my_point_summary() to authenticated;

-- search_path 고정
alter function public.touch_updated_at() set search_path = '';
