-- 016: 관리자 홈의 '예산 부족' 수에서 적자(남은 예산 마이너스) 기업을 뺀다
--
-- 015 이후 적자 기업은 '후원 필요'와 후원 관리 화면의 '예산 초과(적자)'로 따로 보여준다.
-- 그런데 admin_dashboard()의 low_budget_sponsors는 remaining < budget*20%만 봐서 적자 기업도 세었다.
-- 후원 관리 화면(AdminSponsorsScreen)과 같은 기준(remaining >= 0)으로 맞춘다. 나머지는 015와 같다.
-- 만든 날: 2026-11-16

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  shortfall jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin: 관리자만 볼 수 있어요.' using errcode = '42501';
  end if;
  shortfall := public.admin_sponsor_shortfall();
  return jsonb_build_object(
    'total_users',        (select count(*) from public.users),
    'admin_users',        (select count(*) from public.users where is_admin),
    'today_reports',      (select count(*) from public.reports where (created_at at time zone 'Asia/Seoul')::date = today),
    'unresolved_reports', (select count(*) from public.reports where status in ('received', 'reviewing')),
    'today_points',       (select coalesce(sum(amount), 0) from public.point_ledger where (created_at at time zone 'Asia/Seoul')::date = today),
    'today_checkins',     (select count(*) from public.facility_checkins where checkin_date = today),
    'suspicious_checkins', (select count(*) from public.admin_list_checkins() c where c.flagged and c.review_status = 'none'),
    'low_budget_sponsors', (select count(*) from public.admin_list_sponsors() s where s.active and s.budget > 0 and s.remaining >= 0 and s.remaining < s.budget * 0.2),
    'sponsor_needed_points', (shortfall->>'waiting_points')::integer + (shortfall->>'deficit_points')::integer,
    'recent_reports', coalesce((
      select jsonb_agg(r order by r.created_at desc)
      from (
        select rp.id, rp.type, rp.status, rp.created_at, f.name as facility_name, u.nickname
        from public.reports rp
        join public.smoking_facilities f on f.id = rp.facility_id
        left join public.users u on u.id = rp.user_id
        order by rp.created_at desc
        limit 5
      ) r), '[]'::jsonb)
  );
end;
$$;
