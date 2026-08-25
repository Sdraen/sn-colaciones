-- Permisos iniciales para los tres roles de la aplicación.
-- Requiere que cada usuario autenticado tenga una fila activa en profiles.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.organization_id
  from public.profiles as profile
  where profile.id = (select auth.uid())
    and profile.active
  limit 1
$$;

create or replace function private.current_user_has_role(expected_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.active
      and profile.role = expected_role
  )
$$;

create or replace function private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.active
      and profile.role in ('company_admin', 'provider_admin')
  )
$$;

create or replace function private.menu_week_belongs_to_current_org(target_menu_week_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.menu_weeks as menu_week
    join public.profiles as profile on profile.organization_id = menu_week.organization_id
    where menu_week.id = target_menu_week_id
      and profile.id = (select auth.uid())
      and profile.active
  )
$$;

create or replace function private.service_day_belongs_to_current_org(target_service_day_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.service_days as service_day
    join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
    join public.profiles as profile on profile.organization_id = menu_week.organization_id
    where service_day.id = target_service_day_id
      and profile.id = (select auth.uid())
      and profile.active
  )
$$;

create or replace function private.service_day_is_visible_to_current_user(target_service_day_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.service_days as service_day
    join public.menu_weeks as menu_week on menu_week.id = service_day.menu_week_id
    join public.profiles as profile on profile.organization_id = menu_week.organization_id
    where service_day.id = target_service_day_id
      and profile.id = (select auth.uid())
      and profile.active
      and (
        menu_week.published_at is not null
        or profile.role in ('company_admin', 'provider_admin')
      )
  )
$$;

create or replace function private.worker_owns_diner(target_diner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.diners as diner
    where diner.id = target_diner_id
      and diner.auth_user_id = (select auth.uid())
      and diner.active
  )
$$;

revoke all on function private.current_organization_id() from public;
revoke all on function private.current_user_has_role(public.app_role) from public;
revoke all on function private.current_user_is_admin() from public;
revoke all on function private.menu_week_belongs_to_current_org(uuid) from public;
revoke all on function private.service_day_belongs_to_current_org(uuid) from public;
revoke all on function private.service_day_is_visible_to_current_user(uuid) from public;
revoke all on function private.worker_owns_diner(uuid) from public;

grant execute on function private.current_organization_id() to authenticated;
grant execute on function private.current_user_has_role(public.app_role) to authenticated;
grant execute on function private.current_user_is_admin() to authenticated;
grant execute on function private.menu_week_belongs_to_current_org(uuid) to authenticated;
grant execute on function private.service_day_belongs_to_current_org(uuid) to authenticated;
grant execute on function private.service_day_is_visible_to_current_user(uuid) to authenticated;
grant execute on function private.worker_owns_diner(uuid) to authenticated;

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.diners from anon, authenticated;
revoke all on table public.menu_weeks from anon, authenticated;
revoke all on table public.service_days from anon, authenticated;
revoke all on table public.menu_options from anon, authenticated;
revoke all on table public.training_sessions from anon, authenticated;
revoke all on table public.exception_requests from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;

grant select on table public.organizations, public.profiles, public.audit_events to authenticated;
grant select, insert, update, delete on table
  public.diners,
  public.menu_weeks,
  public.service_days,
  public.menu_options,
  public.training_sessions,
  public.orders
to authenticated;
grant select, insert, update on table public.exception_requests to authenticated;

create policy "organization members can read their organization"
on public.organizations for select
to authenticated
using (id = (select private.current_organization_id()));

create policy "users can read their profile and admins can read their organization"
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or (
    organization_id = (select private.current_organization_id())
    and (select private.current_user_is_admin())
  )
);

create policy "workers can read themselves and admins can read organization diners"
on public.diners for select
to authenticated
using (
  auth_user_id = (select auth.uid())
  or (
    organization_id = (select private.current_organization_id())
    and (select private.current_user_is_admin())
  )
);

create policy "company admins can insert diners"
on public.diners for insert
to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_has_role('company_admin'))
);

create policy "company admins can update diners"
on public.diners for update
to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_has_role('company_admin'))
)
with check (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_has_role('company_admin'))
);

create policy "company admins can delete diners"
on public.diners for delete
to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_has_role('company_admin'))
);

create policy "members can read published weeks and admins can read drafts"
on public.menu_weeks for select
to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (
    published_at is not null
    or (select private.current_user_is_admin())
  )
);

create policy "provider admins can insert menu weeks"
on public.menu_weeks for insert
to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_has_role('provider_admin'))
);

create policy "provider admins can update menu weeks"
on public.menu_weeks for update
to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_has_role('provider_admin'))
)
with check (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_has_role('provider_admin'))
);

create policy "provider admins can delete menu weeks"
on public.menu_weeks for delete
to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_has_role('provider_admin'))
);

create policy "members can read visible service days"
on public.service_days for select
to authenticated
using ((select private.service_day_is_visible_to_current_user(id)));

create policy "provider admins can insert service days"
on public.service_days for insert
to authenticated
with check (
  (select private.menu_week_belongs_to_current_org(menu_week_id))
  and (select private.current_user_has_role('provider_admin'))
);

create policy "provider admins can update service days"
on public.service_days for update
to authenticated
using (
  (select private.service_day_belongs_to_current_org(id))
  and (select private.current_user_has_role('provider_admin'))
)
with check (
  (select private.menu_week_belongs_to_current_org(menu_week_id))
  and (select private.current_user_has_role('provider_admin'))
);

create policy "provider admins can delete service days"
on public.service_days for delete
to authenticated
using (
  (select private.service_day_belongs_to_current_org(id))
  and (select private.current_user_has_role('provider_admin'))
);

create policy "members can read menu options for visible days"
on public.menu_options for select
to authenticated
using ((select private.service_day_is_visible_to_current_user(service_day_id)));

create policy "provider admins can insert menu options"
on public.menu_options for insert
to authenticated
with check (
  (select private.service_day_belongs_to_current_org(service_day_id))
  and (select private.current_user_has_role('provider_admin'))
);

create policy "provider admins can update menu options"
on public.menu_options for update
to authenticated
using (
  (select private.service_day_belongs_to_current_org(service_day_id))
  and (select private.current_user_has_role('provider_admin'))
)
with check (
  (select private.service_day_belongs_to_current_org(service_day_id))
  and (select private.current_user_has_role('provider_admin'))
);

create policy "provider admins can delete menu options"
on public.menu_options for delete
to authenticated
using (
  (select private.service_day_belongs_to_current_org(service_day_id))
  and (select private.current_user_has_role('provider_admin'))
);

create policy "admins can read training sessions"
on public.training_sessions for select
to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_is_admin())
);

create policy "company admins can insert training sessions"
on public.training_sessions for insert
to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and created_by = (select auth.uid())
  and (select private.current_user_has_role('company_admin'))
);

create policy "company admins can update training sessions"
on public.training_sessions for update
to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_has_role('company_admin'))
)
with check (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_has_role('company_admin'))
);

create policy "company admins can delete training sessions"
on public.training_sessions for delete
to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_has_role('company_admin'))
);

create policy "admins can read exception requests"
on public.exception_requests for select
to authenticated
using (
  (select private.service_day_belongs_to_current_org(service_day_id))
  and (select private.current_user_is_admin())
);

create policy "company admins can request exceptions"
on public.exception_requests for insert
to authenticated
with check (
  (select private.service_day_belongs_to_current_org(service_day_id))
  and requested_by = (select auth.uid())
  and status = 'pending'
  and (select private.current_user_has_role('company_admin'))
);

create policy "provider admins can resolve exceptions"
on public.exception_requests for update
to authenticated
using (
  (select private.service_day_belongs_to_current_org(service_day_id))
  and (select private.current_user_has_role('provider_admin'))
)
with check (
  (select private.service_day_belongs_to_current_org(service_day_id))
  and resolved_by = (select auth.uid())
  and status in ('approved', 'rejected')
  and resolved_at is not null
  and (select private.current_user_has_role('provider_admin'))
);

create policy "workers can read their orders and admins can read organization orders"
on public.orders for select
to authenticated
using (
  (
    kind = 'regular'
    and (select private.worker_owns_diner(diner_id))
  )
  or (
    (select private.service_day_belongs_to_current_org(service_day_id))
    and (select private.current_user_is_admin())
  )
);

create policy "authorized roles can insert orders"
on public.orders for insert
to authenticated
with check (
  (select private.service_day_belongs_to_current_org(service_day_id))
  and (
    (
      kind = 'regular'
      and diner_id is not null
      and created_by = (select auth.uid())
      and quantity = 1
      and (select private.worker_owns_diner(diner_id))
    )
    or (
      kind in ('training', 'extra')
      and created_by = (select auth.uid())
      and (select private.current_user_has_role('company_admin'))
    )
    or (
      kind = 'exceptional'
      and created_by = (select auth.uid())
      and (select private.current_user_has_role('provider_admin'))
    )
  )
);

create policy "authorized roles can update orders"
on public.orders for update
to authenticated
using (
  (select private.service_day_belongs_to_current_org(service_day_id))
  and (
    (kind = 'regular' and (select private.worker_owns_diner(diner_id)))
    or (kind in ('training', 'extra') and (select private.current_user_has_role('company_admin')))
    or (kind = 'exceptional' and (select private.current_user_has_role('provider_admin')))
  )
)
with check (
  (select private.service_day_belongs_to_current_org(service_day_id))
  and (
    (
      kind = 'regular'
      and diner_id is not null
      and created_by = (select auth.uid())
      and quantity = 1
      and (select private.worker_owns_diner(diner_id))
    )
    or (
      kind in ('training', 'extra')
      and (select private.current_user_has_role('company_admin'))
    )
    or (
      kind = 'exceptional'
      and (select private.current_user_has_role('provider_admin'))
    )
  )
);

create policy "authorized roles can delete orders"
on public.orders for delete
to authenticated
using (
  (select private.service_day_belongs_to_current_org(service_day_id))
  and (
    (kind = 'regular' and (select private.worker_owns_diner(diner_id)))
    or (kind in ('training', 'extra') and (select private.current_user_has_role('company_admin')))
    or (kind = 'exceptional' and (select private.current_user_has_role('provider_admin')))
  )
);

create policy "admins can read audit events"
on public.audit_events for select
to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.current_user_is_admin())
);

create index if not exists training_sessions_org_date_index
  on public.training_sessions (organization_id, service_date);
create index if not exists exception_requests_service_day_index
  on public.exception_requests (service_day_id, status);
create index if not exists diners_auth_user_index
  on public.diners (auth_user_id)
  where auth_user_id is not null;

commit;
