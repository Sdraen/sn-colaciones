-- Edición controlada de menús publicados. Conserva los identificadores usados
-- por las reservas, protege el historial y notifica cambios de preparación.

begin;

create or replace function public.update_published_menu_week(
  target_menu_week_id uuid,
  week_days jsonb,
  confirm_impact boolean default false
)
returns public.menu_weeks
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_organization_id uuid;
  target_week public.menu_weeks%rowtype;
  target_timezone text;
  organization_today date;
  day_payload jsonb;
  option_payload jsonb;
  target_day public.service_days%rowtype;
  target_option public.menu_options%rowtype;
  option_id uuid;
  requested_disabled boolean;
  day_changed boolean;
  reserved_quantity integer;
  impacted_reservations integer := 0;
  changed_days integer := 0;
begin
  if actor_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select profile.organization_id
  into actor_organization_id
  from public.profiles as profile
  where profile.id = actor_id
    and profile.active
    and profile.role = 'provider_admin';

  if actor_organization_id is null then
    raise exception using errcode = 'P0001', message = 'PROVIDER_ROLE_REQUIRED';
  end if;

  select menu_week.*
  into target_week
  from public.menu_weeks as menu_week
  where menu_week.id = target_menu_week_id
    and menu_week.organization_id = actor_organization_id
  for update;

  if target_week.id is null then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_FOUND';
  end if;
  if target_week.published_at is null then
    raise exception using errcode = 'P0001', message = 'MENU_WEEK_NOT_PUBLISHED';
  end if;

  select organization.timezone
  into target_timezone
  from public.organizations as organization
  where organization.id = target_week.organization_id;

  if jsonb_typeof(week_days) <> 'array' or jsonb_array_length(week_days) <> 7 then
    raise exception using errcode = '22023', message = 'INVALID_MENU_WEEK_DAYS';
  end if;
  if (
    select count(distinct item->>'service_date')
    from jsonb_array_elements(week_days) as item
  ) <> 7 or exists (
    select 1
    from jsonb_array_elements(week_days) as item
    where (item->>'service_date')::date
      not between target_week.starts_on and target_week.starts_on + 6
  ) then
    raise exception using errcode = '22023', message = 'INVALID_MENU_WEEK_DAYS';
  end if;

  organization_today := (now() at time zone target_timezone)::date;

  for day_payload in select value from jsonb_array_elements(week_days)
  loop
    select service_day.*
    into target_day
    from public.service_days as service_day
    where service_day.menu_week_id = target_week.id
      and service_day.service_date = (day_payload->>'service_date')::date
    for update;

    if target_day.id is null then
      raise exception using errcode = 'P0001', message = 'SERVICE_DAY_NOT_FOUND';
    end if;

    requested_disabled := coalesce((day_payload->>'disabled')::boolean, false);

    select
      target_day.disabled is distinct from requested_disabled
      or exists (
        select 1
        from jsonb_array_elements(coalesce(day_payload->'options', '[]'::jsonb)) as requested
        where coalesce((requested->>'available_for_workers')::boolean, true)
          and coalesce((requested->>'visible')::boolean, true)
          and (
            nullif(requested->>'id', '') is null
            or not exists (
              select 1
              from public.menu_options as current_option
              where current_option.id = (requested->>'id')::uuid
                and current_option.service_day_id = target_day.id
                and current_option.available_for_workers
                and current_option.visible
                and current_option.category = (requested->>'category')::public.menu_category
                and current_option.label = requested->>'label'
                and current_option.description = requested->>'description'
                and current_option.dessert is not distinct from nullif(requested->>'dessert', '')
                and current_option.beverage is not distinct from nullif(requested->>'beverage', '')
                and current_option.notes is not distinct from nullif(requested->>'notes', '')
                and current_option.capacity is not distinct from (requested->>'capacity')::integer
                and current_option.sort_order = coalesce((requested->>'sort_order')::integer, 0)
            )
          )
      )
      or exists (
        select 1
        from public.menu_options as current_option
        where current_option.service_day_id = target_day.id
          and current_option.available_for_workers
          and current_option.visible
          and not exists (
            select 1
            from jsonb_array_elements(coalesce(day_payload->'options', '[]'::jsonb)) as requested
            where nullif(requested->>'id', '')::uuid = current_option.id
              and coalesce((requested->>'available_for_workers')::boolean, true)
              and coalesce((requested->>'visible')::boolean, true)
          )
      )
    into day_changed;

    if day_changed and target_day.service_date < organization_today then
      raise exception using errcode = 'P0001', message = 'OPERATION_HISTORY_LOCKED';
    end if;
    if day_changed and exists (
      select 1
      from public.service_delivery_tracking as tracking
      where tracking.service_day_id = target_day.id
        and (tracking.delivered_at is not null or tracking.receipt_confirmed_at is not null)
    ) then
      raise exception using errcode = 'P0001', message = 'DELIVERY_ALREADY_COMPLETED';
    end if;

    if day_changed then
      changed_days := changed_days + 1;
    end if;

    -- Bloquea alternativas para serializar esta corrección con nuevas reservas.
    perform menu_option.id
    from public.menu_options as menu_option
    where menu_option.service_day_id = target_day.id
      and menu_option.available_for_workers
      and menu_option.visible
    for update;

    if requested_disabled then
      select coalesce(sum(order_record.quantity), 0)::integer
      into reserved_quantity
      from public.orders as order_record
      where order_record.service_day_id = target_day.id
        and order_record.status = 'confirmed';

      if reserved_quantity > 0 then
        raise exception using errcode = 'P0001', message = 'MENU_DAY_HAS_RESERVATIONS';
      end if;

      update public.service_days
      set disabled = true
      where id = target_day.id;

      update public.menu_options as menu_option
      set visible = false,
          available_for_workers = false
      where menu_option.service_day_id = target_day.id
        and menu_option.available_for_workers;
      continue;
    end if;

    if not exists (
      select 1
      from jsonb_array_elements(coalesce(day_payload->'options', '[]'::jsonb)) as requested
      where coalesce((requested->>'available_for_workers')::boolean, true)
        and coalesce((requested->>'visible')::boolean, true)
    ) then
      raise exception using errcode = 'P0001', message = 'MENU_DAY_WITHOUT_OPTIONS';
    end if;

    -- Las alternativas omitidas se eliminan sólo cuando nunca fueron usadas.
    for target_option in
      select menu_option.*
      from public.menu_options as menu_option
      where menu_option.service_day_id = target_day.id
        and menu_option.available_for_workers
        and menu_option.visible
        and not exists (
          select 1
          from jsonb_array_elements(coalesce(day_payload->'options', '[]'::jsonb)) as requested
          where nullif(requested->>'id', '')::uuid = menu_option.id
            and coalesce((requested->>'available_for_workers')::boolean, true)
            and coalesce((requested->>'visible')::boolean, true)
        )
    loop
      select coalesce(sum(order_record.quantity), 0)::integer
      into reserved_quantity
      from public.orders as order_record
      where order_record.menu_option_id = target_option.id
        and order_record.status = 'confirmed';

      if reserved_quantity > 0 then
        raise exception using errcode = 'P0001', message = 'MENU_OPTION_HAS_RESERVATIONS';
      end if;

      if exists (
        select 1 from public.orders as order_record
        where order_record.menu_option_id = target_option.id
      ) or exists (
        select 1 from public.exception_requests as request_record
        where request_record.menu_option_id = target_option.id
      ) then
        update public.menu_options
        set visible = false,
            available_for_workers = false
        where id = target_option.id;
      else
        delete from public.menu_options where id = target_option.id;
      end if;
    end loop;

    for option_payload in
      select value
      from jsonb_array_elements(coalesce(day_payload->'options', '[]'::jsonb))
      where coalesce((value->>'available_for_workers')::boolean, true)
        and coalesce((value->>'visible')::boolean, true)
    loop
      if nullif(option_payload->>'capacity', '') is null then
        raise exception using errcode = 'P0001', message = 'MENU_WEEK_INCOMPLETE';
      end if;

      option_id := nullif(option_payload->>'id', '')::uuid;
      if option_id is null then
        insert into public.menu_options (
          service_day_id, category, label, description, dessert, beverage, notes,
          capacity, capacity_updated_at, available_for_training,
          available_for_workers, visible, sort_order
        ) values (
          target_day.id,
          (option_payload->>'category')::public.menu_category,
          btrim(option_payload->>'label'),
          btrim(option_payload->>'description'),
          nullif(btrim(option_payload->>'dessert'), ''),
          nullif(btrim(option_payload->>'beverage'), ''),
          nullif(btrim(option_payload->>'notes'), ''),
          (option_payload->>'capacity')::integer,
          now(),
          false,
          true,
          true,
          coalesce((option_payload->>'sort_order')::integer, 0)
        );
        continue;
      end if;

      select menu_option.*
      into target_option
      from public.menu_options as menu_option
      where menu_option.id = option_id
        and menu_option.service_day_id = target_day.id
        and menu_option.available_for_workers
      for update;

      if target_option.id is null then
        raise exception using errcode = 'P0001', message = 'MENU_OPTION_NOT_FOUND';
      end if;

      select coalesce(sum(order_record.quantity), 0)::integer
      into reserved_quantity
      from public.orders as order_record
      where order_record.menu_option_id = target_option.id
        and order_record.status = 'confirmed';

      if (option_payload->>'capacity')::integer < reserved_quantity then
        raise exception using errcode = 'P0001', message = 'MENU_OPTION_CAPACITY_EXCEEDED';
      end if;

      if reserved_quantity > 0 and (
        target_option.category is distinct from (option_payload->>'category')::public.menu_category
        or target_option.label is distinct from btrim(option_payload->>'label')
        or target_option.description is distinct from btrim(option_payload->>'description')
        or target_option.dessert is distinct from nullif(btrim(option_payload->>'dessert'), '')
        or target_option.beverage is distinct from nullif(btrim(option_payload->>'beverage'), '')
        or target_option.notes is distinct from nullif(btrim(option_payload->>'notes'), '')
      ) then
        if not confirm_impact then
          raise exception using errcode = 'P0001', message = 'MENU_EDIT_CONFIRMATION_REQUIRED';
        end if;

        impacted_reservations := impacted_reservations + reserved_quantity;
        insert into public.notifications (
          organization_id, recipient_profile_id, channel, event_type, title, body,
          related_entity_type, related_entity_id, delivered_at
        )
        select distinct
          target_week.organization_id,
          order_record.created_by,
          'in_app',
          'published_menu_changed',
          'Cambio en una preparación reservada',
          'La preparación del ' || to_char(target_day.service_date, 'DD/MM/YYYY') ||
            ' ahora es: ' || btrim(option_payload->>'description') ||
            '. Tu reserva y tu cupo se mantienen.',
          'menu_option',
          target_option.id,
          now()
        from public.orders as order_record
        join public.profiles as recipient on recipient.id = order_record.created_by
        where order_record.menu_option_id = target_option.id
          and order_record.status = 'confirmed'
          and recipient.active;
      end if;

      update public.menu_options
      set category = (option_payload->>'category')::public.menu_category,
          label = btrim(option_payload->>'label'),
          description = btrim(option_payload->>'description'),
          dessert = nullif(btrim(option_payload->>'dessert'), ''),
          beverage = nullif(btrim(option_payload->>'beverage'), ''),
          notes = nullif(btrim(option_payload->>'notes'), ''),
          capacity = (option_payload->>'capacity')::integer,
          capacity_updated_at = case
            when capacity is distinct from (option_payload->>'capacity')::integer then now()
            else capacity_updated_at
          end,
          visible = true,
          sort_order = coalesce((option_payload->>'sort_order')::integer, 0)
      where id = target_option.id;
    end loop;

    update public.service_days
    set disabled = false,
        availability_published_at = now()
    where id = target_day.id;
  end loop;

  update public.menu_weeks
  set updated_at = now()
  where id = target_week.id
  returning * into target_week;

  insert into public.audit_events (
    organization_id, actor_id, entity_type, entity_id, action, metadata
  ) values (
    target_week.organization_id,
    actor_id,
    'menu_week',
    target_week.id,
    'menu_week.published_corrected',
    jsonb_build_object(
      'changed_days', changed_days,
      'impacted_reservations', impacted_reservations,
      'impact_confirmed', confirm_impact
    )
  );

  return target_week;
end;
$$;

revoke all on function public.update_published_menu_week(uuid, jsonb, boolean)
  from public, anon;
grant execute on function public.update_published_menu_week(uuid, jsonb, boolean)
  to authenticated;

comment on function public.update_published_menu_week(uuid, jsonb, boolean) is
  'Permite a la proveedora corregir menús publicados sin romper reservas ni modificar días pasados o entregados.';

commit;
