create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.paired_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null,
  device_fingerprint_hash text not null,
  device_public_token_hash text not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.scan_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  desktop_connection_id text not null,
  mobile_device_id uuid references public.paired_devices(id) on delete set null,
  status text not null default 'pending_pairing',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint scan_sessions_status_check check (
    status in (
      'pending_pairing',
      'waiting_mobile',
      'scanning',
      'completed',
      'expired',
      'cancelled',
      'failed'
    )
  )
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  access_key text,
  qr_url text not null,
  issuer_name text,
  total_amount numeric check (total_amount is null or total_amount >= 0),
  purchased_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  quantity numeric check (quantity is null or quantity >= 0),
  unit_price numeric check (unit_price is null or unit_price >= 0),
  total_price numeric check (total_price is null or total_price >= 0),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index paired_devices_user_active_idx
  on public.paired_devices (user_id, last_seen_at desc)
  where revoked_at is null;

create unique index paired_devices_active_fingerprint_idx
  on public.paired_devices (user_id, device_fingerprint_hash)
  where revoked_at is null;

create index scan_sessions_user_status_idx
  on public.scan_sessions (user_id, status, created_at desc);

create index invoices_user_created_idx
  on public.invoices (user_id, created_at desc);

create index invoice_items_invoice_idx
  on public.invoice_items (invoice_id, created_at);

create index security_events_user_created_idx
  on public.security_events (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.paired_devices enable row level security;
alter table public.scan_sessions enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.security_events enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.paired_devices to authenticated;
grant select, insert, update, delete on public.scan_sessions to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;
grant select, insert on public.security_events to authenticated;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = id);

create policy "profiles_delete_own"
  on public.profiles for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = id);

create policy "paired_devices_select_own"
  on public.paired_devices for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "paired_devices_insert_own"
  on public.paired_devices for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "paired_devices_update_own"
  on public.paired_devices for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "paired_devices_delete_own"
  on public.paired_devices for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "scan_sessions_select_own"
  on public.scan_sessions for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "scan_sessions_insert_own"
  on public.scan_sessions for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and (
      mobile_device_id is null
      or exists (
        select 1
        from public.paired_devices
        where paired_devices.id = scan_sessions.mobile_device_id
          and paired_devices.user_id = (select auth.uid())
      )
    )
  );

create policy "scan_sessions_update_own"
  on public.scan_sessions for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and (
      mobile_device_id is null
      or exists (
        select 1
        from public.paired_devices
        where paired_devices.id = scan_sessions.mobile_device_id
          and paired_devices.user_id = (select auth.uid())
      )
    )
  );

create policy "scan_sessions_delete_own"
  on public.scan_sessions for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "invoices_select_own"
  on public.invoices for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "invoices_insert_own"
  on public.invoices for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "invoices_update_own"
  on public.invoices for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "invoices_delete_own"
  on public.invoices for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "invoice_items_select_own"
  on public.invoice_items for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "invoice_items_insert_own"
  on public.invoice_items for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and exists (
      select 1
      from public.invoices
      where invoices.id = invoice_items.invoice_id
        and invoices.user_id = (select auth.uid())
    )
  );

create policy "invoice_items_update_own"
  on public.invoice_items for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and exists (
      select 1
      from public.invoices
      where invoices.id = invoice_items.invoice_id
        and invoices.user_id = (select auth.uid())
    )
  );

create policy "invoice_items_delete_own"
  on public.invoice_items for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "security_events_select_own"
  on public.security_events for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "security_events_insert_own"
  on public.security_events for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
