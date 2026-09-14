-- El guardado semanal crea o reemplaza menu_weeks, service_days y menu_options
-- dentro de una sola RPC. La propia función valida identidad, rol y organización;
-- SECURITY DEFINER permite completar esa transacción sin que las políticas RLS
-- de las tablas hijas rechacen las filas recién creadas en la misma llamada.

begin;

alter function public.save_menu_week_draft(date, jsonb) security definer;
alter function public.save_menu_week_draft(date, jsonb) set search_path = '';

revoke all on function public.save_menu_week_draft(date, jsonb) from public, anon;
grant execute on function public.save_menu_week_draft(date, jsonb) to authenticated;

comment on function public.save_menu_week_draft(date, jsonb) is
  'Guarda atómicamente el menú semanal. Valida auth.uid(), rol provider_admin y organización antes de operar con privilegios definidos.';

commit;
