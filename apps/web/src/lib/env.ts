import { parseWebEnvironment } from '@leitor-nfce/shared';

export function getSupabaseEnv() {
  const env = parseWebEnvironment(process.env);
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return {
    isConfigured: Boolean(supabaseUrl && supabasePublishableKey),
    supabasePublishableKey,
    supabaseUrl,
  };
}

export function requireSupabaseEnv() {
  const env = getSupabaseEnv();

  if (!env.supabaseUrl || !env.supabasePublishableKey) {
    throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }

  return {
    supabasePublishableKey: env.supabasePublishableKey,
    supabaseUrl: env.supabaseUrl,
  };
}
