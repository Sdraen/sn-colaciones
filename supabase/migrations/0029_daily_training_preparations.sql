-- La proveedora define varias preparaciones de capacitacion por dia.
-- Los pedidos existentes conservan su alternativa y su cupo.

begin;

drop index if exists public.menu_options_one_training_menu_per_day;

-- El endpoint semanal antiguo supone una unica preparacion y no debe volver
-- a modificar arbitrariamente una de las alternativas diarias.
revoke execute on function public.set_training_menu_for_week(uuid, text, integer)
  from authenticated;

create or replace function public.set_training_menus_for_day(
  target_service_day_id uuid,
  requested_options jsonb,
  confirm_impact boolean default false
)
returns public.service_days
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_day public.service_days%rowtype;
  target_organization_id uuid;
  target_timezone text;
  current_option public.menu_options%rowtype;
  option_payload jsonb;
  option_id uuid;
  option_capacity integer;
  option_description text;
  option_label text;
  reserved_quantity integer;
  option_index integer := 0;
  seen_options uuid[] := array[]::uuid[];
begin
  select service_day.*
  into target_day
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  where service_day.id = target_service_day_id
  for update of service_day;

  if target_day.id is null then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_NOT_FOUND';
  end if;

  select menu_week.organization_id, organization.timezone
  into target_organization_id, target_timezone
  from public.menu_weeks as menu_week
  join public.organizations as organization on organization.id = menu_week.organization_id
  where menu_week.id = target_day.menu_week_id;

  if actor_id is null or not exists (
    select 1 from public.profiles as profile
    where profile.id = actor_id and profile.active
      and profile.role = 'provider_admin'
      and profile.organization_id = target_organization_id
  ) then
    raise exception using errcode = 'P0001', message = 'PROVIDER_ROLE_REQUIRED';
  end if;
  if extract(isodow from target_day.service_date) not between 1 and 5
    or target_day.service_date < (now() at time zone target_timezone)::date then
    raise exception using errcode = 'P0001', message = 'OPERATION_HISTORY_LOCKED';
  end if;
  if exists (
    select 1 from public.service_delivery_tracking as tracking
    where tracking.service_day_id = target_day.id
      and (tracking.delivered_at is not null or tracking.receipt_confirmed_at is not null)
  ) then
    raise exception using errcode = 'P0001', message = 'DELIVERY_ALREADY_COMPLETED';
  end if;
  if jsonb_typeof(requested_options) is distinct from 'array'
    or jsonb_array_length(requested_options) > 10 then
    raise exception using errcode = '22023', message = 'INVALID_TRAINING_ITEMS';
  end if;

  for option_payload in select value from jsonb_array_elements(requested_options)
  loop
    option_id := nullif(option_payload->>'id', '')::uuid;
    option_label := btrim(coalesce(option_payload->>'label', ''));
    option_description := btrim(coalesce(option_payload->>'description', ''));
    option_capacity := (option_payload->>'capacity')::integer;
    if jsonb_typeof(option_payload) is distinct from 'object'
      or char_length(option_label) not between 2 and 80
      or char_length(option_description) not between 3 and 300
      or option_capacity is null or option_capacity not between 0 and 10000
      or (option_id is not null and option_id = any(seen_options)) then
      raise exception using errcode = '22023', message = 'INVALID_TRAINING_ITEMS';
    end if;
    if option_id is not null then
      seen_options := array_append(seen_options, option_id);
    end if;
  end loop;

  for current_option in
    select * from public.menu_options
    where service_day_id = target_day.id and available_for_training
    for update
  loop
    if not (current_option.id = any(seen_options)) then
      select coalesce(sum(order_record.quantity), 0)::integer into reserved_quantity
      from public.orders as order_record
      where order_record.menu_option_id = current_option.id
        and order_record.status = 'confirmed';
      if reserved_quantity > 0 then
        raise exception using errcode = 'P0001', message = 'MENU_OPTION_HAS_RESERVATIONS';
      end if;
      if exists (select 1 from public.orders where menu_option_id = current_option.id)
        or exists (select 1 from public.exception_requests where menu_option_id = current_option.id) then
        update public.menu_options
        set visible = false, available_for_training = false
        where id = current_option.id;
      else
        delete from public.menu_options where id = current_option.id;
      end if;
    end if;
  end loop;

  for option_payload in select value from jsonb_array_elements(requested_options)
  loop
    option_index := option_index + 1;
    option_id := nullif(option_payload->>'id', '')::uuid;
    option_label := btrim(option_payload->>'label');
    option_description := btrim(option_payload->>'description');
    option_capacity := (option_payload->>'capacity')::integer;

    if option_id is null then
      insert into public.menu_options (
        service_day_id, category, label, description, capacity,
        capacity_updated_at, visible, available_for_training,
        available_for_workers, sort_order
      ) values (
        target_day.id, 'especial', option_label, option_description,
        option_capacity, now(), true, true, false, 80 + option_index
      );
      continue;
    end if;

    select * into current_option from public.menu_options
    where id = option_id and service_day_id = target_day.id
      and available_for_training and not available_for_workers
    for update;
    if current_option.id is null then
      raise exception using errcode = 'P0001', message = 'MENU_OPTION_NOT_FOUND';
    end if;
    select coalesce(sum(order_record.quantity), 0)::integer into reserved_quantity
    from public.orders as order_record
    where order_record.menu_option_id = option_id
      and order_record.status = 'confirmed';
    if option_capacity < reserved_quantity then
      raise exception using errcode = 'P0001', message = 'MENU_OPTION_CAPACITY_EXCEEDED';
    end if;
    if reserved_quantity > 0 and (
      current_option.label is distinct from option_label
      or current_option.description is distinct from option_description
    ) then
      if not confirm_impact then
        raise exception using errcode = 'P0001', message = 'MENU_EDIT_CONFIRMATION_REQUIRED';
      end if;
      insert into public.notifications (
        organization_id, recipient_profile_id, channel, event_type, title, body,
        related_entity_type, related_entity_id, delivered_at
      )
      select distinct
        target_organization_id, order_record.created_by, 'in_app',
        'published_menu_changed', 'Cambio en menú de capacitación',
        'La preparación del ' || to_char(target_day.service_date, 'DD/MM/YYYY') ||
          ' ahora es: ' || option_description || '. El cupo reservado se mantiene.',
        'menu_option', option_id, now()
      from public.orders as order_record
      join public.profiles as recipient on recipient.id = order_record.created_by
      where order_record.menu_option_id = option_id
        and order_record.status = 'confirmed'
        and recipient.active;
    end if;
    update public.menu_options
    set label = option_label,
        description = option_description,
        capacity = option_capacity,
        capacity_updated_at = case when capacity is distinct from option_capacity then now() else capacity_updated_at end,
        visible = true,
        sort_order = 80 + option_index
    where id = option_id;
  end loop;

  update public.menu_weeks set updated_at = now() where id = target_day.menu_week_id;
  insert into public.audit_events (
    organization_id, actor_id, entity_type, entity_id, action, metadata
  ) values (
    target_organization_id, actor_id, 'service_day', target_day.id,
    'training_menus.saved', jsonb_build_object(
      'preparations', jsonb_array_length(requested_options),
      'impact_confirmed', confirm_impact
    )
  );
  return target_day;
end;
$$;

revoke all on function public.set_training_menus_for_day(uuid, jsonb, boolean) from public, anon;
grant execute on function public.set_training_menus_for_day(uuid, jsonb, boolean) to authenticated;

create or replace function public.get_menu_option_availability(target_menu_week_id uuid)
returns table (
  menu_option_id uuid,
  reserved_quantity integer,
  remaining_quantity integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not (select private.menu_week_belongs_to_current_org(target_menu_week_id)) then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_FOUND';
  end if;
  if not (select private.current_user_has_role('provider_admin'))
    and not exists (
      select 1 from public.menu_weeks as menu_week
      where menu_week.id = target_menu_week_id and menu_week.published_at is not null
    ) then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_PUBLISHED';
  end if;

  return query
  select
    menu_option.id,
    coalesce(sum(order_record.quantity) filter (
      where order_record.status = 'confirmed'
    ), 0)::integer,
    case
      when menu_option.capacity is null then null
      else greatest(
        menu_option.capacity - coalesce(sum(order_record.quantity) filter (
          where order_record.status = 'confirmed'
        ), 0)::integer,
        0
      )
    end
  from public.menu_options as menu_option
  join public.service_days as service_day on service_day.id = menu_option.service_day_id
  left join public.orders as order_record
    on order_record.menu_option_id = menu_option.id
      and order_record.service_day_id = service_day.id
  where service_day.menu_week_id = target_menu_week_id
    and menu_option.visible
    and (
      menu_option.available_for_workers
      or (menu_option.available_for_training and (
        (select private.current_user_has_role('company_admin'))
        or (select private.current_user_has_role('provider_admin'))
      ))
    )
  group by menu_option.id, menu_option.capacity;
end;
$$;

commit;
