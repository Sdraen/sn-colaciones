-- Categoría propia para colaciones solicitadas fuera del menú publicado.
-- Se separa para que PostgreSQL confirme el nuevo valor antes de usarlo.

alter type public.order_kind add value if not exists 'special';

