-- Desde las 14:00 se pueden crear capacitaciones sólo para fechas futuras.
-- Hasta las 09:00 se mantiene el registro para hoy o fechas futuras.
-- Las correcciones de registros existentes conservan sus reglas propias.

begin;

do $migration$
declare
  original_definition text := pg_get_functiondef(
    'private.enforce_order_business_rules()'::regprocedure
  );
  updated_definition text;
  cutoff_pattern text := 'organization_now::time[[:space:]]*<[[:space:]]*time[[:space:]]*''14:00''';
  matches_found integer;
begin
  select count(*) into matches_found
  from regexp_matches(original_definition, cutoff_pattern, 'g');

  if matches_found <> 1 then
    raise exception 'No se encontró una única ventana de reapertura de capacitación';
  end if;

  updated_definition := regexp_replace(
    original_definition,
    cutoff_pattern,
    '(organization_now::time < time ''14:00'' or target_day.service_date = organization_now::date)'
  );
  execute updated_definition;
end;
$migration$;

comment on function private.enforce_order_business_rules() is
  'Permite crear capacitaciones para hoy sólo hasta las 09:00; desde las 14:00, sólo para fechas futuras.';

commit;
