create type public.app_role as enum ('admin','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "Users can view their own roles"
on public.user_roles for select to authenticated
using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from auth.users
where email in ('kehlin.swain@greens.health','kehlinswain@gmail.com','mirna.elizondo01@gmail.com')
on conflict do nothing;

-- Admin-only aggregate of texted-in meal approvals
create or replace function public.admin_sms_approval_stats(_days integer default 30)
returns table (
  user_id uuid,
  label text,
  approved bigint,
  pending bigint,
  discarded bigint,
  inbound_messages bigint,
  outbound_messages bigint,
  last_activity timestamptz
)
language sql stable security definer set search_path = public, auth as $$
  with since as (select now() - make_interval(days => greatest(_days,1)) as ts),
  p as (
    select l.user_id,
      count(*) filter (where l.status = 'confirmed') as approved,
      count(*) filter (where l.status = 'pending') as pending,
      count(*) filter (where l.status = 'discarded') as discarded,
      max(l.created_at) as last_p
    from public.sms_pending_logs l, since
    where l.created_at >= since.ts
    group by l.user_id
  ),
  e as (
    select s.user_id,
      count(*) filter (where s.direction = 'inbound') as inbound,
      count(*) filter (where s.direction = 'outbound') as outbound,
      max(s.occurred_at) as last_e
    from public.sms_events s, since
    where s.occurred_at >= since.ts and s.user_id is not null
    group by s.user_id
  )
  select
    coalesce(p.user_id, e.user_id) as user_id,
    coalesce(u.email, ue.phone, 'unknown') as label,
    coalesce(p.approved, 0), coalesce(p.pending, 0), coalesce(p.discarded, 0),
    coalesce(e.inbound, 0), coalesce(e.outbound, 0),
    greatest(coalesce(p.last_p, 'epoch'::timestamptz), coalesce(e.last_e, 'epoch'::timestamptz))
  from p full outer join e on e.user_id = p.user_id
  left join auth.users u on u.id = coalesce(p.user_id, e.user_id)
  left join public.user_engagement ue on ue.user_id = coalesce(p.user_id, e.user_id)
  where public.has_role(auth.uid(), 'admin')
  order by 8 desc
$$;

revoke execute on function public.admin_sms_approval_stats(integer) from public, anon;
grant execute on function public.admin_sms_approval_stats(integer) to authenticated, service_role;