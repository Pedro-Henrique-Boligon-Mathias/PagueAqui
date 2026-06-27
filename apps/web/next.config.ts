import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootEnvFile = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env.local');
const loadEnvFile = (
  process as typeof process & {
    loadEnvFile?: (path: string) => void;
  }
).loadEnvFile;

if (existsSync(rootEnvFile)) {
  loadEnvFile?.(rootEnvFile);
}

function getAllowedDevOrigins() {
  const values = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_PAIRING_APP_URL,
    process.env.NEXT_ALLOWED_DEV_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap((value) => value?.split(',') ?? [])
    .map((value) => value.trim())
    .filter(Boolean);

  const origins = values.flatMap((value) => {
    try {
      const url = new URL(value);
      return [url.origin, url.hostname];
    } catch {
      return value;
    }
  });

  return Array.from(new Set([...origins, '*.ngrok-free.app']));
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_PAIRING_APP_URL: process.env.NEXT_PUBLIC_PAIRING_APP_URL,
    NEXT_PUBLIC_REALTIME_WS_URL: process.env.NEXT_PUBLIC_REALTIME_WS_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/.next/**', '**/.pnpm-store/**', '**/dist/**', '**/node_modules/**'],
      };
    }

    return config;
  },
  reactStrictMode: true,
};

export default nextConfig;
