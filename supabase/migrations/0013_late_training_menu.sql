-- Permite agregar o actualizar el menú común de capacitaciones después de
-- publicar la semana, sin desbloquear ni reemplazar las alternativas de los
-- trabajadores. Se aplica a los días hábiles porque las capacitaciones sólo
-- pueden registrarse de lunes a viernes.

begin;

create or replace function public.set_training_menu_for_week(
  target_menu_week_id uuid,
  preparation text,
  informed_capacity integer default null
)
returns public.menu_weeks
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_organization_id uuid;
  organization_timezone text;
  saved_week public.menu_weeks%rowtype;
  target_day record;
  existing_option public.menu_options%rowtype;
  confirmed_quantity integer;
begin
  if actor_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not (select private.current_user_has_role('provider_admin')) then
    raise exception using errcode = 'P0001', message = 'PROVIDER_ROLE_REQUIRED';
  end if;
  if char_length(btrim(coalesce(preparation, ''))) < 3
    or char_length(btrim(preparation)) > 300 then
    raise exception using errcode = '22023', message = 'INVALID_TRAINING_MENU';
  end if;
  if informed_capacity is not null
    and (informed_capacity < 0 or informed_capacity > 10000) then
    raise exception using errcode = '22023', message = 'INVALID_TRAINING_MENU';
  end if;

  select organization.id, organization.timezone
  into target_organization_id, organization_timezone
  from public.profiles as profile
  join public.organizations as organization
    on organization.id = profile.organization_id
  where profile.id = actor_id
    and profile.active
    and profile.role = 'provider_admin';

  select menu_week.*
  into saved_week
  from public.menu_weeks as menu_week
  where menu_week.id = target_menu_week_id
    and menu_week.organization_id = target_organization_id
  for update;

  if saved_week.id is null then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_FOUND';
  end if;
  if saved_week.starts_on + 6 < (now() at time zone organization_timezone)::date then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_IS_IN_THE_PAST';
  end if;

  for target_day in
    select service_day.id, service_day.service_date
    from public.service_days as service_day
    where service_day.menu_week_id = saved_week.id
      and extract(isodow from service_day.service_date) between 1 and 5
    order by service_day.service_date
    for update
  loop
    select menu_option.*
    into existing_option
    from public.menu_options as menu_option
    where menu_option.service_day_id = target_day.id
      and menu_option.available_for_training
    for update;

    if existing_option.id is not null then
      select coalesce(sum(order_record.quantity), 0)::integer
      into confirmed_quantity
      from public.orders as order_record
      where order_record.menu_option_id = existing_option.id
        and order_record.status = 'confirmed';

      if informed_capacity is not null and confirmed_quantity > informed_capacity then
        raise exception using errcode = 'P0001', message = 'MENU_OPTION_CAPACITY_EXCEEDED';
      end if;

      update public.menu_options
      set category = 'especial',
          label = 'Menú capacitación',
          description = btrim(preparation),
          dessert = null,
          beverage = null,
          notes = null,
          capacity = informed_capacity,
          capacity_updated_at = now(),
          visible = true,
          available_for_training = true,
          available_for_workers = false,
          sort_order = 99
      where id = existing_option.id;
    else
      insert into public.menu_options (
        service_day_id,
        category,
        label,
        description,
        dessert,
        beverage,
        notes,
        capacity,
        capacity_updated_at,
        visible,
        available_for_training,
        available_for_workers,
        sort_order
      ) values (
        target_day.id,
        'especial',
        'Menú capacitación',
        btrim(preparation),
        null,
        null,
        null,
        informed_capacity,
        now(),
        true,
        true,
        false,
        99
      );
    end if;
  end loop;

  update public.menu_weeks
  set updated_at = now()
  where id = saved_week.id
  returning * into saved_week;

  insert into public.audit_events (
    organization_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata
  ) values (
    target_organization_id,
    actor_id,
    'menu_week',
    saved_week.id,
    'training_menu.saved',
    jsonb_build_object(
      'preparation', btrim(preparation),
      'capacity', informed_capacity,
      'published', saved_week.published_at is not null
    )
  );

  return saved_week;
end;
$$;

revoke all on function public.set_training_menu_for_week(uuid, text, integer)
  from public, anon;
grant execute on function public.set_training_menu_for_week(uuid, text, integer)
  to authenticated;

comment on function public.set_training_menu_for_week(uuid, text, integer) is
  'Agrega o actualiza el menú de capacitación de lunes a viernes, incluso si la semana ya fue publicada, sin modificar el menú de trabajadores.';

commit;
