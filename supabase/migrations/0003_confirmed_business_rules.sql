-- Reglas confirmadas el 26 de agosto de 2026:
-- disponibilidad informada por la proveedora, capacitaciones solo en días
-- hábiles, extraordinarias con rechazo justificado, notificaciones e historial.

begin;

alter table public.service_days
  add column availability_published_at timestamptz,
  add column delivery_closes_at timestamptz;

update public.service_days
set delivery_closes_at = same_day_closes_at + interval '3 hours'
where delivery_closes_at is null;

alter table public.service_days
  alter column delivery_closes_at set not null,
  add constraint service_day_delivery_time_check check (
    same_day_closes_at < delivery_closes_at
  );

alter table public.menu_options
  add column capacity_updated_at timestamptz;

alter table public.training_sessions
  add constraint training_sessions_weekday_check check (
    extract(isodow from service_date) between 1 and 5
  );

alter table public.exception_requests
  add constraint exception_rejection_note_check check (
    status <> 'rejected'
    or nullif(btrim(resolution_note), '') is not null
  );

alter table public.orders
  add column fulfilled_at timestamptz;

create table public.service_calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  kind text not null check (kind in ('holiday', 'vacation', 'no_service', 'special')),
  reason text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint service_calendar_block_dates_check check (starts_on <= ends_on)
);

create index service_calendar_blocks_org_dates_index
  on public.service_calendar_blocks (organization_id, starts_on, ends_on);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null default 'in_app' check (channel in ('in_app', 'email')),
  event_type text not null,
  title text not null,
  body text not null,
  related_entity_type text,
  related_entity_id uuid,
  delivered_at timestamptz,
  read_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index notifications_recipient_created_index
  on public.notifications (recipient_profile_id, created_at desc);

alter table public.service_calendar_blocks enable row level security;
alter table public.notifications enable row level security;

revoke all on table public.service_calendar_blocks from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;

grant select, insert, update, delete on table public.service_calendar_blocks to authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

create policy "admins can read organization calendar blocks"
on public.service_calendar_blocks for select
to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_is_admin())
);

create policy "provider admins can insert calendar blocks"
on public.service_calendar_blocks for insert
to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and created_by = (select auth.uid())
  and (select private.current_user_has_role('provider_admin'))
);

create policy "provider admins can update calendar blocks"
on public.service_calendar_blocks for update
to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_has_role('provider_admin'))
)
with check (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_has_role('provider_admin'))
);

create policy "provider admins can delete calendar blocks"
on public.service_calendar_blocks for delete
to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_has_role('provider_admin'))
);

create policy "users can read their notifications"
on public.notifications for select
to authenticated
using (recipient_profile_id = (select auth.uid()));

create policy "users can mark their notifications as read"
on public.notifications for update
to authenticated
using (recipient_profile_id = (select auth.uid()))
with check (recipient_profile_id = (select auth.uid()));

create or replace function private.notify_exception_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
begin
  select menu_week.organization_id
  into target_organization_id
  from public.service_days as service_day
  join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
  where service_day.id = new.service_day_id;

  if tg_op = 'INSERT' then
    insert into public.notifications (
      organization_id,
      recipient_profile_id,
      event_type,
      title,
      body,
      related_entity_type,
      related_entity_id,
      delivered_at
    )
    select
      target_organization_id,
      profile.id,
      'exception_requested',
      'Nueva solicitud extraordinaria',
      new.beneficiary_label || ' requiere una decisión de la proveedora.',
      'exception_request',
      new.id,
      now()
    from public.profiles as profile
    where profile.organization_id = target_organization_id
      and profile.role = 'provider_admin'
      and profile.active;
  elsif old.status = 'pending' and new.status in ('approved', 'rejected') then
    insert into public.notifications (
      organization_id,
      recipient_profile_id,
      event_type,
      title,
      body,
      related_entity_type,
      related_entity_id,
      delivered_at
    ) values (
      target_organization_id,
      new.requested_by,
      case when new.status = 'approved' then 'exception_approved' else 'exception_rejected' end,
      case when new.status = 'approved' then 'Solicitud extraordinaria aprobada' else 'Solicitud extraordinaria rechazada' end,
      case
        when new.status = 'approved' then new.beneficiary_label || ' fue incorporada a la producción.'
        else new.beneficiary_label || ': ' || new.resolution_note
      end,
      'exception_request',
      new.id,
      now()
    );
  end if;

  return new;
end;
$$;

revoke all on function private.notify_exception_request() from public;

create trigger exception_requests_notify
after insert or update of status on public.exception_requests
for each row execute function private.notify_exception_request();

comment on column public.menu_options.capacity is
  'Disponibilidad informada manualmente por la proveedora. Su alcance definitivo sigue pendiente.';
comment on column public.service_days.availability_published_at is
  'Momento en que la proveedora informa la disponibilidad del día, normalmente a las 08:00.';
comment on column public.orders.fulfilled_at is
  'Momento de entrega; permite distinguir colaciones confirmadas de colaciones efectivamente exitosas.';
comment on table public.service_calendar_blocks is
  'Feriados, vacaciones, cierres y días especiales. Las reglas exactas aún deben confirmarse.';
comment on table public.notifications is
  'Fuente de verdad para notificaciones internas y correos transaccionales.';

commit;
