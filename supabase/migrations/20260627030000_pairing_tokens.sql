alter table public.scan_sessions
  add column if not exists pairing_token_hash text,
  add column if not exists pairing_confirmed_at timestamptz;

create unique index if not exists scan_sessions_pairing_token_hash_idx
  on public.scan_sessions (pairing_token_hash)
  where pairing_token_hash is not null;

create index if not exists scan_sessions_pending_pairing_idx
  on public.scan_sessions (user_id, expires_at)
  where status = 'pending_pairing';
