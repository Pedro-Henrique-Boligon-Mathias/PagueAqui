export function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return {
    isConfigured: Boolean(supabaseUrl && supabasePublishableKey),
    supabasePublishableKey,
    supabaseUrl,
  };
}

export function requireSupabaseEnv() {
  const env = getSupabaseEnv();

  if (!env.supabaseUrl || !env.supabasePublishableKey) {
    throw new Error(
      'Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  return {
    supabasePublishableKey: env.supabasePublishableKey,
    supabaseUrl: env.supabaseUrl,
  };
}
