create or replace function public.admin_member_dashboard(_member uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _tz text;
  result jsonb;
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'not authorized';
  end if;

  _tz := coalesce((select timezone from public.user_engagement where user_id = _member), 'America/Chicago');

  select jsonb_build_object(
    'latest_reading', (select jsonb_build_object('ts', ts, 'mg_dl', mg_dl, 'trend', trend)
                       from public.cgm_readings where user_id = _member order by ts desc limit 1),
    'readings_24h', coalesce((select jsonb_agg(jsonb_build_object('ts', ts, 'mg_dl', mg_dl) order by ts)
                       from (select ts, mg_dl from public.cgm_readings
                             where user_id = _member and ts > now() - interval '24 hours' order by ts) r), '[]'::jsonb),
    'today_carbs', coalesce((select sum(carbs_grams) from public.food_logs
                       where user_id = _member and type <> 'medication'
                         and (logged_at at time zone _tz)::date = (now() at time zone _tz)::date), 0),
    'today_meals', (select count(*) from public.food_logs
                       where user_id = _member and type <> 'medication'
                         and (logged_at at time zone _tz)::date = (now() at time zone _tz)::date),
    'recent_meals', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'carbs', carbs_grams, 'type', type, 'logged_at', logged_at) order by logged_at desc)
                       from (select label, carbs_grams, type, logged_at from public.food_logs
                             where user_id = _member order by logged_at desc limit 5) m), '[]'::jsonb),
    'recent_rises', coalesce((select jsonb_agg(jsonb_build_object('detected_at', detected_at, 'rise', rise_mg_dl, 'response', user_response, 'status', status) order by detected_at desc)
                       from (select detected_at, rise_mg_dl, user_response, status from public.spike_events
                             where user_id = _member order by detected_at desc limit 5) s), '[]'::jsonb),
    'recent_texts', coalesce((select jsonb_agg(jsonb_build_object('direction', direction, 'body', body, 'status', status, 'purpose', purpose, 'occurred_at', occurred_at) order by occurred_at desc)
                       from (select direction, body, status, purpose, occurred_at from public.sms_events
                             where user_id = _member order by occurred_at desc limit 10) t), '[]'::jsonb),
    'medications', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'dose', dose, 'unit', unit))
                       from (select name, dose, unit from public.medications
                             where user_id = _member and stopped_at is null order by name) md), '[]'::jsonb)
  ) into result;

  return result;
end
$$;

revoke execute on function public.admin_member_dashboard(uuid) from public, anon;
grant execute on function public.admin_member_dashboard(uuid) to authenticated;