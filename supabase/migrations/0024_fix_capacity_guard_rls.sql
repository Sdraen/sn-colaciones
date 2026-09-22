-- El bloqueo de cupos usa SELECT ... FOR NO KEY UPDATE sobre menu_options.
-- PostgreSQL aplica la política UPDATE también a esa lectura con bloqueo;
-- trabajadores y Securitas pueden reservar, pero no editar el menú.
-- Ejecutar el guard con su propietario permite bloquear la alternativa y
-- comprobar la capacidad real sin ampliar las políticas de escritura.

begin;

alter function private.enforce_menu_option_capacity() security definer;
alter function private.enforce_menu_option_capacity() set search_path = '';

-- Es una función trigger interna: no necesita invocación directa por clientes.
revoke all on function private.enforce_menu_option_capacity()
  from public, anon, authenticated;

comment on function private.enforce_menu_option_capacity() is
  'Bloquea la alternativa y verifica su cupo con permisos del propietario, sin conceder edición de menús a quien reserva.';

commit;
