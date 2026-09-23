-- Una solicitud de Securitas puede incluir varias preparaciones del mismo dia.
-- Cada alternativa conserva su cupo y su registro individual para correcciones.
-- Toda la operacion se confirma o revierte en una sola transaccion.

begin;

create or replace function public.create_company_extra_batch(
  target_service_day_id uuid,
  beneficiary_name text,
  selected_side public.side_choice,
  include_bread boolean,
  include_tea boolean,
  request_reason text,
  requested_items jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  target_day public.service_days%rowtype;
  item jsonb;
  option_id uuid;
  item_quantity integer;
  seen_options uuid[] := array[]::uuid[];
  saved_order public.orders%rowtype;
  saved_request public.exception_requests%rowtype;
  saved_items jsonb := '[]'::jsonb;
  late_request boolean;
begin
  if jsonb_typeof(requested_items) is distinct from 'array'
    or jsonb_array_length(requested_items) not between 1 and 10 then
    raise exception using errcode = '22023', message = 'INVALID_EXTRA_ITEMS';
  end if;

  select * into target_day
  from public.service_days
  where id = target_service_day_id;
  if target_day.id is null then
    raise exception using errcode = 'P0001', message = 'SERVICE_DAY_NOT_FOUND';
  end if;
  late_request := now() >= target_day.same_day_closes_at;
  if late_request and nullif(btrim(coalesce(request_reason, '')), '') is null then
    raise exception using errcode = '22023', message = 'EXTRA_REASON_REQUIRED';
  end if;

  for item in select value from jsonb_array_elements(requested_items)
  loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'menuOptionId') is distinct from 'string'
      or jsonb_typeof(item->'quantity') is distinct from 'number' then
      raise exception using errcode = '22023', message = 'INVALID_EXTRA_ITEMS';
    end if;
    option_id := (item->>'menuOptionId')::uuid;
    item_quantity := (item->>'quantity')::integer;
    if item_quantity not between 1 and 500 or option_id = any(seen_options) then
      raise exception using errcode = '22023', message = 'INVALID_EXTRA_ITEMS';
    end if;
    seen_options := array_append(seen_options, option_id);

    if late_request then
      saved_request := public.request_exceptional_order_with_quantity(
        target_service_day_id, option_id, beneficiary_name, request_reason,
        item_quantity, selected_side, include_bread, include_tea
      );
      saved_items := saved_items || jsonb_build_array(to_jsonb(saved_request));
    else
      saved_order := public.create_extra_order_with_quantity(
        target_service_day_id, option_id, beneficiary_name,
        item_quantity, selected_side, include_bread, include_tea
      );
      saved_items := saved_items || jsonb_build_array(to_jsonb(saved_order));
    end if;
  end loop;

  return jsonb_build_object(
    'outcome', case when late_request then 'pending' else 'confirmed' end,
    'items', saved_items
  );
end;
$$;

-- Las capacitaciones usan una sesion por preparacion. El nombre compartido
-- permite identificarlas y cada pedido conserva su propio cupo y correcciones.
create or replace function public.create_company_training_batch(
  target_service_day_id uuid,
  training_name text,
  include_tea boolean,
  requested_items jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
  option_id uuid;
  item_quantity integer;
  seen_options uuid[] := array[]::uuid[];
  saved_order public.orders%rowtype;
  saved_items jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(requested_items) is distinct from 'array'
    or jsonb_array_length(requested_items) not between 1 and 10 then
    raise exception using errcode = '22023', message = 'INVALID_TRAINING_ITEMS';
  end if;

  for item in select value from jsonb_array_elements(requested_items)
  loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'menuOptionId') is distinct from 'string'
      or jsonb_typeof(item->'quantity') is distinct from 'number' then
      raise exception using errcode = '22023', message = 'INVALID_TRAINING_ITEMS';
    end if;
    option_id := (item->>'menuOptionId')::uuid;
    item_quantity := (item->>'quantity')::integer;
    if item_quantity not between 1 and 500 or option_id = any(seen_options) then
      raise exception using errcode = '22023', message = 'INVALID_TRAINING_ITEMS';
    end if;
    seen_options := array_append(seen_options, option_id);

    saved_order := public.create_training_order(
      target_service_day_id, option_id, training_name, item_quantity,
      'ensalada'::public.side_choice, true, include_tea
    );
    saved_items := saved_items || jsonb_build_array(to_jsonb(saved_order));
  end loop;
  return saved_items;
end;
$$;

revoke all on function public.create_company_extra_batch(
  uuid, text, public.side_choice, boolean, boolean, text, jsonb
) from public, anon;
grant execute on function public.create_company_extra_batch(
  uuid, text, public.side_choice, boolean, boolean, text, jsonb
) to authenticated;

revoke all on function public.create_company_training_batch(
  uuid, text, boolean, jsonb
) from public, anon;
grant execute on function public.create_company_training_batch(
  uuid, text, boolean, jsonb
) to authenticated;

commit;
