import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve('../../supabase/migrations/20260627000000_initial_auth_schema.sql'),
  'utf8',
);
const pairingMigration = readFileSync(
  resolve('../../supabase/migrations/20260627030000_pairing_tokens.sql'),
  'utf8',
);

describe('initial Supabase migration', () => {
  it.each(['profiles', 'paired_devices', 'scan_sessions', 'invoices', 'invoice_items'])(
    'creates %s with RLS enabled',
    (tableName) => {
      expect(migration).toContain(`create table public.${tableName}`);
      expect(migration).toContain(`alter table public.${tableName} enable row level security`);
    },
  );

  it('creates security_events with RLS enabled', () => {
    expect(migration).toContain('create table public.security_events');
    expect(migration).toContain('alter table public.security_events enable row level security');
  });

  it('uses ownership predicates for authenticated access', () => {
    expect(migration).toContain('to authenticated');
    expect(migration).toContain('(select auth.uid()) = user_id');
    expect(migration).not.toContain("auth.role() = 'authenticated'");
  });

  it('prevents invoice items from referencing another user invoice', () => {
    expect(migration).toContain('where invoices.id = invoice_items.invoice_id');
    expect(migration).toContain('and invoices.user_id = (select auth.uid())');
  });

  it('adds pairing token metadata to scan sessions', () => {
    expect(pairingMigration).toContain('add column if not exists pairing_token_hash text');
    expect(pairingMigration).toContain('add column if not exists pairing_confirmed_at timestamptz');
    expect(pairingMigration).toContain('scan_sessions_pairing_token_hash_idx');
  });
});
