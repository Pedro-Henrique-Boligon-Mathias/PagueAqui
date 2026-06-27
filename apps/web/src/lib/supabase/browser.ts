'use client';

import { createBrowserClient } from '@supabase/ssr';

import { requireSupabaseEnv } from '../env';

export function createBrowserSupabaseClient() {
  const { supabasePublishableKey, supabaseUrl } = requireSupabaseEnv();

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
