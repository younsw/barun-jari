-- 015: 가상 후원 예산이 모자라도 포인트는 지급하고, 모자란 만큼은 나중에 후원받아 메운다
--
-- 포인트 지급(적립)은 원래 후원 예산과 상관없이 항상 된다(하루 10P 한도만 있음).
-- 014에서는 예산이 넉넉한 후원 기업이 없으면 "차감 기록"을 남기지 않았는데, 이제는 항상 남긴다.
--   1) 진행 중이고 남은 예산이 충분한 기업 (종료일이 빠른 순)
--   2) 없으면 진행 중인 기업 중 종료일이 가장 빠른 곳 → 남은 예산이 마이너스(적자)가 된다
--   3) 진행 중인 기업이 하나도 없으면 "후원 대기" (sponsor_id 없음)로 쌓아 둔다
-- 관리자가 예산을 추가하거나 새 기업을 첫 예산과 함께 등록하면, 후원 대기 지급분을 오래된 것부터 그 예산으로 옮긴다.
-- 적자인 기업에 예산을 추가하면 남은 예산 = 총예산 - 지급이므로 자연스럽게 적자가 메워진다.

alter table public.sponsor_transactions alter column sponsor_id drop not null;
alter table public.sponsor_transactions
  add constraint sponsor_transactions_budget_has_sponsor check (kind = 'payout' or sponsor_id is not null);
create index sponsor_transactions_waiting_idx on public.sponsor_transactions (created_at) where sponsor_id is null;

-- 014 전에 적립돼 어느 예산에도 기록되지 않은 포인트는 후원 대기로 옮겨 둔다
insert into public.sponsor_transactions (sponsor_id, kind, amount, note, point_id, created_at)
select null, 'payout', p.amount, p.reason, p.id, p.created_at
from public.point_ledger p
where p.amount > 0
  and not exists (select 1 from public.sponsor_transactions t where t.point_id = p.id);

create or replace function public.charge_sponsor_for_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sponsor bigint;
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if new.amount <= 0 then
    return new;
  end if;
  -- 1) 예산이 충분한 진행 중 기업
  select s.id into v_sponsor
  from public.sponsors s
  where today between s.starts_on and s.ends_on
    and (select coalesce(sum(t.amount) filter (where t.kind = 'budget'), 0)
              - coalesce(sum(t.amount) filter (where t.kind = 'payout'), 0)
         from public.sponsor_transactions t where t.sponsor_id = s.id) >= new.amount
  order by s.ends_on, s.id
  limit 1;
  -- 2) 모자라도 진행 중인 기업에서 차감 (마이너스 허용)
  if v_sponsor is null then
    select s.id into v_sponsor
    from public.sponsors s
    where today between s.starts_on and s.ends_on
    order by s.ends_on, s.id
    limit 1;
  end if;
  -- 3) 진행 중인 기업이 없으면 v_sponsor = null → 후원 대기
  insert into public.sponsor_transactions (sponsor_id, kind, amount, note, point_id)
  values (v_sponsor, 'payout', new.amount, new.reason, new.id);
  return new;
end;
$$;
revoke execute on function public.charge_sponsor_for_points() from public, anon, authenticated;

-- 후원 대기 지급분을 남은 예산 안에서 오래된 것부터 이 기업으로 옮긴다 (관리자 함수 안에서만 호출)
create function public.settle_waiting_payouts(p_sponsor_id bigint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining integer;
  moved integer := 0;
  waiting record;
begin
  select coalesce(sum(amount) filter (where kind = 'budget'), 0) - coalesce(sum(amount) filter (where kind = 'payout'), 0)
  into remaining from public.sponsor_transactions where sponsor_id = p_sponsor_id;

  for waiting in
    select t.id, t.amount from public.sponsor_transactions t
    where t.sponsor_id is null and t.kind = 'payout'
    order by t.created_at, t.id
    for update
  loop
    exit when remaining < waiting.amount;
    update public.sponsor_transactions set sponsor_id = p_sponsor_id where id = waiting.id;
    remaining := remaining - waiting.amount;
    moved := moved + waiting.amount;
  end loop;
  return moved;
end;
$$;
revoke execute on function public.settle_waiting_payouts(bigint) from public, anon, authenticated;

-- 예산 추가 후 후원 대기분 정산
create or replace function public.admin_adjust_sponsor_budget(p_sponsor_id bigint, p_amount integer, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining integer;
  settled integer := 0;
begin
  if not public.is_admin() then
    raise exception 'admin: 관리자만 할 수 있어요.' using errcode = '42501';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'admin: 조정할 포인트를 입력해 주세요.' using errcode = '22023';
  end if;
  perform 1 from public.sponsors where id = p_sponsor_id for update;
  if not found then
    raise exception 'admin: 후원 기업을 찾을 수 없어요.' using errcode = 'P0002';
  end if;
  select coalesce(sum(amount) filter (where kind = 'budget'), 0) - coalesce(sum(amount) filter (where kind = 'payout'), 0)
  into remaining from public.sponsor_transactions where sponsor_id = p_sponsor_id;
  if p_amount < 0 and remaining + p_amount < 0 then
    raise exception 'admin: 남은 예산(%P)보다 많이 줄일 수 없어요.', remaining using errcode = 'P0001';
  end if;

  insert into public.sponsor_transactions (sponsor_id, kind, amount, note, created_by)
  values (p_sponsor_id, 'budget', p_amount, coalesce(left(trim(p_note), 200), ''), auth.uid());
  if p_amount > 0 then
    settled := public.settle_waiting_payouts(p_sponsor_id);
  end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, detail)
  values (auth.uid(), 'sponsor_budget', 'sponsor', p_sponsor_id::text,
    jsonb_build_object('amount', p_amount, 'note', p_note, 'settled_waiting', settled));
end;
$$;

-- 새 기업을 첫 예산과 함께 등록하면 후원 대기분 정산
create or replace function public.admin_save_sponsor(p_sponsor_id bigint, p_name text, p_description text,
  p_starts_on date, p_ends_on date, p_initial_budget integer default 0)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id bigint;
  settled integer := 0;
begin
  if not public.is_admin() then
    raise exception 'admin: 관리자만 할 수 있어요.' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' or p_starts_on is null or p_ends_on is null then
    raise exception 'admin: 기업명과 후원 기간을 입력해 주세요.' using errcode = '22023';
  end if;
  if p_ends_on < p_starts_on then
    raise exception 'admin: 종료일이 시작일보다 빠를 수 없어요.' using errcode = '22023';
  end if;

  if p_sponsor_id is null then
    insert into public.sponsors (name, description, starts_on, ends_on)
    values (trim(p_name), coalesce(trim(p_description), ''), p_starts_on, p_ends_on)
    returning id into saved_id;
    if coalesce(p_initial_budget, 0) > 0 then
      insert into public.sponsor_transactions (sponsor_id, kind, amount, note, created_by)
      values (saved_id, 'budget', p_initial_budget, '첫 후원 예산', auth.uid());
      settled := public.settle_waiting_payouts(saved_id);
    end if;
  else
    update public.sponsors
    set name = trim(p_name), description = coalesce(trim(p_description), ''), starts_on = p_starts_on, ends_on = p_ends_on
    where id = p_sponsor_id
    returning id into saved_id;
    if saved_id is null then
      raise exception 'admin: 후원 기업을 찾을 수 없어요.' using errcode = 'P0002';
    end if;
  end if;

  insert into public.admin_actions (admin_id, action, target_type, target_id, detail)
  values (auth.uid(), 'sponsor_save', 'sponsor', saved_id::text, jsonb_build_object(
    'name', trim(p_name), 'starts_on', p_starts_on, 'ends_on', p_ends_on, 'new', p_sponsor_id is null, 'settled_waiting', settled));
  return saved_id;
end;
$$;

-- 후원 대기(어느 기업에도 배정되지 않은 지급분)와 적자 합계
create function public.admin_sponsor_shortfall()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin: 관리자만 볼 수 있어요.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'waiting_points', (select coalesce(sum(amount), 0) from public.sponsor_transactions where sponsor_id is null and kind = 'payout'),
    'waiting_count',  (select count(*) from public.sponsor_transactions where sponsor_id is null and kind = 'payout'),
    'deficit_points', (select coalesce(sum(-s.remaining), 0) from public.admin_list_sponsors() s where s.remaining < 0)
  );
end;
$$;
revoke execute on function public.admin_sponsor_shortfall() from public, anon;
grant execute on function public.admin_sponsor_shortfall() to authenticated;

-- 대시보드: 후원 필요 포인트(대기 + 적자) 추가
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
    'low_budget_sponsors', (select count(*) from public.admin_list_sponsors() s where s.active and s.budget > 0 and s.remaining < s.budget * 0.2),
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
