import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { requireSupabaseEnv } from '../env';

export async function createServerSupabaseClient() {
  const { supabasePublishableKey, supabaseUrl } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; middleware refreshes sessions.
        }
      },
    },
  });
}
