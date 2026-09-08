-- Permite a la proveedora cargar un menú atrasado para la semana actual y
-- preparar cualquier semana futura. Los plazos de los pedidos siguen
-- dependiendo de cada service_day y no se reabren al publicar el menú.

create or replace function public.save_menu_week_draft(target_starts_on date, week_days jsonb)
returns public.menu_weeks
language plpgsql
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_organization_id uuid;
  organization_timezone text;
  current_monday date;
  saved_week public.menu_weeks%rowtype;
  saved_day_id uuid;
  day_input record;
  option_input record;
begin
  if actor_id is null then raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED'; end if;
  if not (select private.current_user_has_role('provider_admin')) then
    raise exception using errcode = 'P0001', message = 'PROVIDER_ROLE_REQUIRED';
  end if;
  if extract(isodow from target_starts_on) <> 1 then
    raise exception using errcode = '22023', message = 'WEEK_MUST_START_MONDAY';
  end if;
  if jsonb_typeof(week_days) is distinct from 'array' or jsonb_array_length(week_days) <> 7 then
    raise exception using errcode = '22023', message = 'INVALID_WEEK_DAYS';
  end if;

  select organization.id, organization.timezone into target_organization_id, organization_timezone
  from public.profiles as profile
  join public.organizations as organization on organization.id = profile.organization_id
  where profile.id = actor_id and profile.active and profile.role = 'provider_admin';

  current_monday := date_trunc('week', now() at time zone organization_timezone)::date;
  if target_starts_on < current_monday then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_IS_IN_THE_PAST';
  end if;

  select menu_week.* into saved_week
  from public.menu_weeks as menu_week
  where menu_week.organization_id = target_organization_id and menu_week.starts_on = target_starts_on
  for update;

  if saved_week.id is null then
    insert into public.menu_weeks (organization_id, starts_on, created_by)
    values (target_organization_id, target_starts_on, actor_id) returning * into saved_week;
  else
    if saved_week.published_at is not null then raise exception using errcode = 'P0001', message = 'MENU_WEEK_PUBLISHED'; end if;
    if exists (
      select 1 from public.service_days as service_day
      where service_day.menu_week_id = saved_week.id and (
        exists (select 1 from public.orders as order_record where order_record.service_day_id = service_day.id)
        or exists (select 1 from public.exception_requests as extra_request where extra_request.service_day_id = service_day.id)
      )
    ) then raise exception using errcode = 'P0001', message = 'MENU_WEEK_LOCKED'; end if;
    delete from public.service_days where menu_week_id = saved_week.id;
  end if;

  for day_input in
    select * from jsonb_to_recordset(week_days) as day_record(service_date date, disabled boolean, options jsonb)
  loop
    if day_input.service_date < target_starts_on or day_input.service_date > target_starts_on + 6 then
      raise exception using errcode = '22023', message = 'INVALID_WEEK_DAYS';
    end if;
    if jsonb_typeof(day_input.options) is distinct from 'array' then
      raise exception using errcode = '22023', message = 'MENU_DAY_WITHOUT_OPTIONS';
    end if;
    if not coalesce(day_input.disabled, false) and not exists (
      select 1 from jsonb_array_elements(day_input.options) as option_value
      where coalesce((option_value->>'available_for_workers')::boolean, true)
    ) then raise exception using errcode = '22023', message = 'MENU_DAY_WITHOUT_OPTIONS'; end if;

    insert into public.service_days (
      menu_week_id, service_date, phase, preorder_deadline, same_day_opens_at,
      same_day_closes_at, delivery_closes_at, disabled
    ) values (
      saved_week.id, day_input.service_date, 'draft',
      ((day_input.service_date - 1) + time '22:00') at time zone organization_timezone,
      (day_input.service_date + time '08:00') at time zone organization_timezone,
      (day_input.service_date + time '11:00') at time zone organization_timezone,
      (day_input.service_date + time '13:00') at time zone organization_timezone,
      coalesce(day_input.disabled, false)
    ) returning id into saved_day_id;

    for option_input in
      select * from jsonb_to_recordset(day_input.options) as option_record(
        category text, label text, description text, dessert text, beverage text,
        notes text, capacity integer, visible boolean, training_menu boolean,
        available_for_workers boolean, sort_order integer
      )
    loop
      if nullif(btrim(option_input.label), '') is null
        or nullif(btrim(option_input.description), '') is null
        or option_input.capacity < 0 or option_input.capacity > 10000 then
        raise exception using errcode = '22023', message = 'INVALID_MENU_OPTION';
      end if;
      insert into public.menu_options (
        service_day_id, category, label, description, dessert, beverage, notes,
        capacity, visible, available_for_training, available_for_workers, sort_order
      ) values (
        saved_day_id, option_input.category::public.menu_category, btrim(option_input.label),
        btrim(option_input.description), nullif(btrim(option_input.dessert), ''),
        nullif(btrim(option_input.beverage), ''), nullif(btrim(option_input.notes), ''),
        option_input.capacity, coalesce(option_input.visible, true),
        coalesce(option_input.training_menu, false),
        coalesce(option_input.available_for_workers, true), coalesce(option_input.sort_order, 0)
      );
    end loop;
  end loop;
  return saved_week;
end;
$$;

revoke all on function public.save_menu_week_draft(date, jsonb) from public, anon;
grant execute on function public.save_menu_week_draft(date, jsonb) to authenticated;

comment on function public.save_menu_week_draft(date, jsonb) is
  'Guarda menús de la semana actual o futuras; solo la proveedora y sin reabrir plazos vencidos.';
