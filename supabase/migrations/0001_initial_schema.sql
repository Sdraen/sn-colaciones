-- Modelo inicial. Debe revisarse con las respuestas finales antes de aplicarlo
-- a producción. PostgreSQL almacena horarios en UTC; la aplicación usa
-- America/Santiago para construir y mostrar los límites diarios.

begin;

create extension if not exists pgcrypto;

create type public.app_role as enum ('worker', 'company_admin', 'provider_admin');
create type public.diner_type as enum ('worker', 'trainee', 'external');
create type public.menu_category as enum ('principal', 'vegetariano', 'hipocalorico', 'sandwich', 'handroll', 'especial');
create type public.side_choice as enum ('ensalada', 'postre', 'ninguno');
create type public.order_kind as enum ('regular', 'training', 'extra', 'exceptional');
create type public.order_status as enum ('confirmed', 'cancelled');
create type public.request_status as enum ('pending', 'approved', 'rejected');
create type public.service_phase as enum ('draft', 'preorder_open', 'preorder_closed', 'same_day_open', 'closed');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/Santiago',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  full_name text not null,
  role public.app_role not null default 'worker',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.diners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  type public.diner_type not null,
  employee_code text,
  active_from date,
  active_until date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diners_active_dates_check check (
    active_until is null or active_from is null or active_until >= active_from
  )
);

create unique index diners_employee_code_unique
  on public.diners (organization_id, employee_code)
  where employee_code is not null;

create table public.menu_weeks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  starts_on date not null,
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, starts_on)
);

create table public.service_days (
  id uuid primary key default gen_random_uuid(),
  menu_week_id uuid not null references public.menu_weeks(id) on delete cascade,
  service_date date not null,
  phase public.service_phase not null default 'draft',
  preorder_deadline timestamptz not null,
  same_day_opens_at timestamptz not null,
  same_day_closes_at timestamptz not null,
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (menu_week_id, service_date),
  constraint service_day_times_check check (
    preorder_deadline < same_day_opens_at
    and same_day_opens_at < same_day_closes_at
  )
);

create table public.menu_options (
  id uuid primary key default gen_random_uuid(),
  service_day_id uuid not null references public.service_days(id) on delete cascade,
  category public.menu_category not null,
  label text not null,
  description text not null,
  capacity integer,
  visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_option_capacity_check check (capacity is null or capacity >= 0)
);

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  service_date date not null,
  expected_attendees integer not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_attendees_check check (expected_attendees > 0)
);

create table public.exception_requests (
  id uuid primary key default gen_random_uuid(),
  service_day_id uuid not null references public.service_days(id),
  menu_option_id uuid not null references public.menu_options(id),
  beneficiary_label text not null,
  reason text not null,
  status public.request_status not null default 'pending',
  requested_by uuid not null references public.profiles(id),
  resolved_by uuid references public.profiles(id),
  resolution_note text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint exception_resolution_check check (
    (status = 'pending' and resolved_at is null)
    or (status <> 'pending' and resolved_at is not null)
  )
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  service_day_id uuid not null references public.service_days(id),
  menu_option_id uuid not null references public.menu_options(id),
  diner_id uuid references public.diners(id),
  training_session_id uuid references public.training_sessions(id),
  exception_request_id uuid unique references public.exception_requests(id),
  created_by uuid not null references public.profiles(id),
  kind public.order_kind not null,
  beneficiary_label text,
  quantity integer not null default 1,
  side public.side_choice not null,
  bread boolean not null default false,
  tea boolean not null default false,
  status public.order_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_quantity_check check (quantity > 0),
  constraint order_beneficiary_check check (
    (kind = 'regular' and diner_id is not null and training_session_id is null and quantity = 1)
    or (kind = 'training' and training_session_id is not null and diner_id is null)
    or (kind in ('extra', 'exceptional') and beneficiary_label is not null and quantity = 1)
  )
);

-- Evita el problema detectado en Excel: más de un pedido activo de la misma
-- persona para el mismo día.
create unique index orders_one_active_per_diner_day
  on public.orders (service_day_id, diner_id)
  where diner_id is not null and status = 'confirmed';

create index orders_service_day_index on public.orders (service_day_id, status);
create index orders_menu_option_index on public.orders (menu_option_id, status);
create index training_sessions_date_index on public.training_sessions (service_date);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id),
  actor_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger diners_set_updated_at before update on public.diners for each row execute function public.set_updated_at();
create trigger menu_weeks_set_updated_at before update on public.menu_weeks for each row execute function public.set_updated_at();
create trigger service_days_set_updated_at before update on public.service_days for each row execute function public.set_updated_at();
create trigger menu_options_set_updated_at before update on public.menu_options for each row execute function public.set_updated_at();
create trigger training_sessions_set_updated_at before update on public.training_sessions for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

-- Todas las tablas expuestas comienzan cerradas. Las políticas específicas se
-- agregarán junto con Supabase Auth cuando se confirme el método de acceso.
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.diners enable row level security;
alter table public.menu_weeks enable row level security;
alter table public.service_days enable row level security;
alter table public.menu_options enable row level security;
alter table public.training_sessions enable row level security;
alter table public.exception_requests enable row level security;
alter table public.orders enable row level security;
alter table public.audit_events enable row level security;

comment on table public.diners is
  'Personas que reciben colaciones; auth_user_id es opcional para alumnos y externos.';
comment on table public.training_sessions is
  'Capacitaciones creadas por Securitas sin cuentas individuales para alumnos.';
comment on column public.menu_options.capacity is
  'Cupo total publicable a las 08:00; null mientras la regla esté pendiente.';

commit;
