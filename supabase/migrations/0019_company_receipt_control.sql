-- Control de recepción por Securitas: llegada compartida, conteo por ítem,
-- observaciones, faltantes y notificación a la proveedora.

begin;

create table public.service_receipt_checks (
  service_day_id uuid primary key references public.service_days(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  general_note text,
  reported_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_receipt_items_array_check check (jsonb_typeof(items) = 'array'),
  constraint service_receipt_note_length_check check (
    general_note is null or char_length(general_note) <= 1000
  )
);

create index service_receipt_checks_organization_index
  on public.service_receipt_checks (organization_id, updated_at desc);

create trigger service_receipt_checks_set_updated_at
before update on public.service_receipt_checks
for each row execute function public.set_updated_at();

alter table public.service_receipt_checks enable row level security;

revoke all on table public.service_receipt_checks from anon, authenticated;
grant select on table public.service_receipt_checks to authenticated;

create policy "operations can read receipt checks"
on public.service_receipt_checks for select
to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (
    (select private.current_user_has_role('provider_admin'))
    or (select private.current_user_has_role('company_admin'))
    or (select private.current_user_has_role('delivery'))
  )
);

create or replace function public.record_delivery_event(
  target_service_day_id uuid,
  event_name text
)
returns public.service_delivery_tracking
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_organization_id uuid;
  actor_role text;
  target_organization_id uuid;
  target_service_date date;
  target_timezone text;
  saved_tracking public.service_delivery_tracking%rowtype;
  changed_rows integer := 0;
begin
  select profile.organization_id, profile.role::text
  into actor_organization_id, actor_role
  from public.profiles as profile
  where profile.id = actor_id
    and profile.active
    and profile.role::text in ('delivery', 'company_admin');

  if actor_organization_id is null then
    raise exception using errcode = 'P0001', message = 'DELIVERY_EVENT_ROLE_REQUIRED';
  end if;

  if event_name not in ('arrived', 'delivered') then
    raise exception using errcode = 'P0001', message = 'INVALID_DELIVERY_EVENT';
  end if;

  if actor_role = 'company_admin' and event_name <> 'arrived' then
    raise exception using errcode = 'P0001', message = 'DELIVERY_ROLE_REQUIRED';
  end if;

  select menu_week.organization_id, service_day.service_date, organization.timezone
  into target_organization_id, target_service_date, target_timezone
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  join public.organizations as organization on organization.id = menu_week.organization_id
  where service_day.id = target_service_day_id;

  if target_organization_id is null or target_organization_id <> actor_organization_id then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_NOT_FOUND';
  end if;

  if target_service_date <> (now() at time zone target_timezone)::date then
    raise exception using errcode = 'P0001', message = 'DELIVERY_DAY_MISMATCH';
  end if;

  insert into public.service_delivery_tracking (service_day_id, organization_id)
  values (target_service_day_id, target_organization_id)
  on conflict (service_day_id) do nothing;

  select tracking.*
  into saved_tracking
  from public.service_delivery_tracking as tracking
  where tracking.service_day_id = target_service_day_id
  for update;

  if event_name = 'arrived' then
    if saved_tracking.arrived_at is null then
      update public.service_delivery_tracking
      set arrived_at = now(), arrived_by = actor_id
      where service_day_id = target_service_day_id
      returning * into saved_tracking;
      get diagnostics changed_rows = row_count;
    end if;
  else
    if saved_tracking.arrived_at is null then
      raise exception using errcode = 'P0001', message = 'DELIVERY_ARRIVAL_REQUIRED';
    end if;
    if saved_tracking.delivered_at is null then
      update public.service_delivery_tracking
      set delivered_at = now(), delivered_by = actor_id
      where service_day_id = target_service_day_id
      returning * into saved_tracking;
      get diagnostics changed_rows = row_count;
    end if;
  end if;

  if changed_rows > 0 then
    insert into public.audit_events (
      organization_id, actor_id, entity_type, entity_id, action, metadata
    ) values (
      target_organization_id,
      actor_id,
      'service_delivery',
      target_service_day_id,
      case event_name when 'arrived' then 'delivery.arrived' else 'delivery.completed' end,
      jsonb_build_object('recorded_at', now(), 'actor_role', actor_role)
    );
  end if;

  return saved_tracking;
end;
$$;

create or replace function public.save_service_receipt_check(
  target_service_day_id uuid,
  receipt_items jsonb,
  receipt_note text default null
)
returns public.service_receipt_checks
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_organization_id uuid;
  target_organization_id uuid;
  target_service_date date;
  expected_items jsonb;
  normalized_items jsonb;
  previous_items jsonb;
  previous_note text;
  input_item jsonb;
  saved_check public.service_receipt_checks%rowtype;
  shortage_count integer := 0;
  has_observation boolean := false;
begin
  select profile.organization_id
  into actor_organization_id
  from public.profiles as profile
  where profile.id = actor_id
    and profile.active
    and profile.role::text = 'company_admin';

  if actor_organization_id is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_ROLE_REQUIRED';
  end if;

  select menu_week.organization_id, service_day.service_date
  into target_organization_id, target_service_date
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  where service_day.id = target_service_day_id;

  if target_organization_id is null or target_organization_id <> actor_organization_id then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.service_delivery_tracking as tracking
    where tracking.service_day_id = target_service_day_id
      and tracking.arrived_at is not null
  ) then
    raise exception using errcode = 'P0001', message = 'DELIVERY_ARRIVAL_REQUIRED';
  end if;

  if exists (
    select 1
    from public.service_delivery_tracking as tracking
    where tracking.service_day_id = target_service_day_id
      and tracking.receipt_confirmed_at is not null
  ) then
    raise exception using errcode = 'P0001', message = 'RECEIPT_ALREADY_CONFIRMED';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key', expected_line.item_key,
        'type', expected_line.item_type,
        'label', expected_line.item_label,
        'expectedQuantity', expected_line.expected_quantity
      ) order by expected_line.group_order, expected_line.item_order, expected_line.item_label
    ),
    '[]'::jsonb
  )
  into expected_items
  from (
    select
      'menu:' || menu_option.id::text as item_key,
      'menu'::text as item_type,
      menu_option.label || case when menu_option.description = '' then '' else ' · ' || menu_option.description end as item_label,
      sum(order_record.quantity)::integer as expected_quantity,
      1 as group_order,
      menu_option.sort_order as item_order
    from public.orders as order_record
    join public.menu_options as menu_option on menu_option.id = order_record.menu_option_id
    where order_record.service_day_id = target_service_day_id
      and order_record.status = 'confirmed'
    group by menu_option.id, menu_option.label, menu_option.description, menu_option.sort_order

    union all

    select
      'side:' || order_record.side::text,
      'side',
      case order_record.side::text
        when 'ensalada' then 'Ensaladas'
        when 'fruta' then 'Frutas'
        when 'postre' then 'Postres'
        else 'Sin acompañamiento'
      end,
      sum(order_record.quantity)::integer,
      2,
      case order_record.side::text when 'ensalada' then 1 when 'fruta' then 2 when 'postre' then 3 else 4 end
    from public.orders as order_record
    where order_record.service_day_id = target_service_day_id
      and order_record.status = 'confirmed'
      and order_record.side::text <> 'ninguno'
    group by order_record.side

    union all

    select
      'complement:bread', 'complement', 'Panes', sum(order_record.quantity)::integer, 3, 1
    from public.orders as order_record
    where order_record.service_day_id = target_service_day_id
      and order_record.status = 'confirmed'
      and order_record.bread
    having sum(order_record.quantity) > 0

    union all

    select
      'complement:tea', 'complement', 'Tés', sum(order_record.quantity)::integer, 3, 2
    from public.orders as order_record
    where order_record.service_day_id = target_service_day_id
      and order_record.status = 'confirmed'
      and order_record.tea
    having sum(order_record.quantity) > 0
  ) as expected_line;

  if jsonb_typeof(receipt_items) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'INVALID_RECEIPT_ITEMS';
  end if;

  if jsonb_array_length(receipt_items) <> jsonb_array_length(expected_items) then
    raise exception using errcode = 'P0001', message = 'RECEIPT_ITEMS_MISMATCH';
  end if;

  if (
    select count(*) <> count(distinct item.value->>'key')
    from jsonb_array_elements(receipt_items) as item(value)
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_RECEIPT_ITEMS';
  end if;

  for input_item in select item.value from jsonb_array_elements(receipt_items) as item(value)
  loop
    if jsonb_typeof(input_item) <> 'object'
      or jsonb_typeof(input_item->'key') is distinct from 'string'
      or coalesce(input_item->>'key', '') = ''
      or jsonb_typeof(input_item->'receivedQuantity') is distinct from 'number'
      or coalesce(input_item->>'receivedQuantity', '') !~ '^[0-9]+$'
      or char_length(coalesce(input_item->>'receivedQuantity', '')) > 6
      or (
        input_item ? 'note'
        and jsonb_typeof(input_item->'note') not in ('string', 'null')
      )
      or char_length(coalesce(input_item->>'note', '')) > 500
      or not exists (
        select 1
        from jsonb_array_elements(expected_items) as expected(value)
        where expected.value->>'key' = input_item->>'key'
      )
    then
      raise exception using errcode = 'P0001', message = 'INVALID_RECEIPT_ITEMS';
    end if;
  end loop;

  if char_length(coalesce(receipt_note, '')) > 1000 then
    raise exception using errcode = 'P0001', message = 'INVALID_RECEIPT_NOTE';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key', expected.value->>'key',
        'type', expected.value->>'type',
        'label', expected.value->>'label',
        'expectedQuantity', (expected.value->>'expectedQuantity')::integer,
        'receivedQuantity', (received.value->>'receivedQuantity')::integer,
        'note', nullif(btrim(received.value->>'note'), '')
      ) order by expected.position
    ),
    '[]'::jsonb
  )
  into normalized_items
  from jsonb_array_elements(expected_items) with ordinality as expected(value, position)
  join jsonb_array_elements(receipt_items) as received(value)
    on received.value->>'key' = expected.value->>'key';

  select receipt.items, receipt.general_note
  into previous_items, previous_note
  from public.service_receipt_checks as receipt
  where receipt.service_day_id = target_service_day_id
  for update;

  insert into public.service_receipt_checks (
    service_day_id, organization_id, items, general_note, reported_by
  ) values (
    target_service_day_id,
    target_organization_id,
    normalized_items,
    nullif(btrim(receipt_note), ''),
    actor_id
  )
  on conflict (service_day_id) do update
  set items = excluded.items,
      general_note = excluded.general_note,
      reported_by = excluded.reported_by,
      updated_at = now()
  returning * into saved_check;

  select count(*)::integer,
         bool_or(nullif(item.value->>'note', '') is not null)
  into shortage_count, has_observation
  from jsonb_array_elements(normalized_items) as item(value)
  where (item.value->>'receivedQuantity')::integer < (item.value->>'expectedQuantity')::integer
     or nullif(item.value->>'note', '') is not null;

  shortage_count := coalesce((
    select count(*)::integer
    from jsonb_array_elements(normalized_items) as item(value)
    where (item.value->>'receivedQuantity')::integer < (item.value->>'expectedQuantity')::integer
  ), 0);
  has_observation := coalesce(has_observation, false) or nullif(btrim(receipt_note), '') is not null;

  insert into public.audit_events (
    organization_id, actor_id, entity_type, entity_id, action, metadata
  ) values (
    target_organization_id,
    actor_id,
    'service_receipt',
    target_service_day_id,
    'delivery.receipt_checked',
    jsonb_build_object(
      'service_date', target_service_date,
      'shortage_items', shortage_count,
      'has_observation', has_observation
    )
  );

  if (
      normalized_items is distinct from previous_items
      or nullif(btrim(receipt_note), '') is distinct from previous_note
    )
    and (shortage_count > 0 or has_observation)
  then
    insert into public.notifications (
      organization_id, recipient_profile_id, channel, event_type, title, body,
      related_entity_type, related_entity_id, delivered_at
    )
    select
      target_organization_id,
      profile.id,
      channel.value,
      case when shortage_count > 0 then 'delivery_shortage_reported' else 'delivery_receipt_observation' end,
      case when shortage_count > 0 then 'Faltantes informados por Securitas' else 'Observación en la recepción' end,
      case
        when shortage_count > 0 then
          'Securitas registró diferencias en ' || shortage_count || ' ítem(s) de la recepción del ' ||
          to_char(target_service_date, 'DD/MM/YYYY') || '. Revisa el control de recepción.'
        else
          'Securitas dejó una observación en la recepción del ' ||
          to_char(target_service_date, 'DD/MM/YYYY') || '.'
      end,
      'service_day',
      target_service_day_id,
      case when channel.value = 'in_app' then now() else null end
    from public.profiles as profile
    cross join (values ('in_app'::text), ('email'::text)) as channel(value)
    where profile.organization_id = target_organization_id
      and profile.role::text = 'provider_admin'
      and profile.active;
  end if;

  return saved_check;
end;
$$;

create or replace function public.confirm_service_receipt(
  target_service_day_id uuid
)
returns public.service_delivery_tracking
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_organization_id uuid;
  target_organization_id uuid;
  saved_tracking public.service_delivery_tracking%rowtype;
  receipt_items jsonb;
begin
  select profile.organization_id
  into actor_organization_id
  from public.profiles as profile
  where profile.id = actor_id
    and profile.active
    and profile.role::text = 'company_admin';

  if actor_organization_id is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_ROLE_REQUIRED';
  end if;

  select menu_week.organization_id
  into target_organization_id
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  where service_day.id = target_service_day_id;

  if target_organization_id is null or target_organization_id <> actor_organization_id then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_NOT_FOUND';
  end if;

  select tracking.*
  into saved_tracking
  from public.service_delivery_tracking as tracking
  where tracking.service_day_id = target_service_day_id
  for update;

  if saved_tracking.service_day_id is null or saved_tracking.delivered_at is null then
    raise exception using errcode = 'P0001', message = 'DELIVERY_COMPLETION_REQUIRED';
  end if;

  select receipt.items
  into receipt_items
  from public.service_receipt_checks as receipt
  where receipt.service_day_id = target_service_day_id;

  if receipt_items is null then
    raise exception using errcode = 'P0001', message = 'RECEIPT_CHECK_REQUIRED';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(receipt_items) as item(value)
    where (item.value->>'receivedQuantity')::integer < (item.value->>'expectedQuantity')::integer
  ) then
    raise exception using errcode = 'P0001', message = 'DELIVERY_RECEIPT_HAS_SHORTAGES';
  end if;

  if saved_tracking.receipt_confirmed_at is null then
    update public.service_delivery_tracking
    set receipt_confirmed_at = now(), receipt_confirmed_by = actor_id
    where service_day_id = target_service_day_id
    returning * into saved_tracking;

    update public.orders
    set fulfilled_at = saved_tracking.receipt_confirmed_at
    where service_day_id = target_service_day_id
      and status = 'confirmed'
      and fulfilled_at is null;

    insert into public.audit_events (
      organization_id, actor_id, entity_type, entity_id, action, metadata
    ) values (
      target_organization_id,
      actor_id,
      'service_delivery',
      target_service_day_id,
      'delivery.receipt_confirmed',
      jsonb_build_object('confirmed_at', saved_tracking.receipt_confirmed_at)
    );
  end if;

  return saved_tracking;
end;
$$;

revoke all on function public.record_delivery_event(uuid, text) from public, anon;
revoke all on function public.save_service_receipt_check(uuid, jsonb, text) from public, anon;
revoke all on function public.confirm_service_receipt(uuid) from public, anon;
grant execute on function public.record_delivery_event(uuid, text) to authenticated;
grant execute on function public.save_service_receipt_check(uuid, jsonb, text) to authenticated;
grant execute on function public.confirm_service_receipt(uuid) to authenticated;

comment on table public.service_receipt_checks is
  'Conteo de recepción informado por Securitas, con cantidades esperadas, recibidas y observaciones.';
comment on function public.save_service_receipt_check(uuid, jsonb, text) is
  'Calcula los ítems esperados, guarda el conteo recibido y avisa a la proveedora cuando existen diferencias.';

commit;
