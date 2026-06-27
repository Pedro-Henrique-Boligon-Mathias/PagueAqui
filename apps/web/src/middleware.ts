import type { NextRequest } from 'next/server';

import { updateSupabaseSession } from './lib/supabase/middleware';

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co ws://localhost:3333 wss://*.ngrok-free.app",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
].join('; ');

function applySecurityHeaders(response: Response) {
  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  return response;
}

export async function middleware(request: NextRequest) {
  return applySecurityHeaders(await updateSupabaseSession(request));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
  runtime: 'nodejs',
};
