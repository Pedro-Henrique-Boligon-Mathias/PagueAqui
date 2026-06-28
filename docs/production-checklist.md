# Production Checklist

- [ ] HTTPS enabled for web and realtime endpoints.
- [ ] `NEXT_PUBLIC_SUPABASE_URL` points to the production Supabase project.
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is a publishable key, not a service role key.
- [ ] `NEXT_PUBLIC_REALTIME_WS_URL` uses `wss://`.
- [ ] `REALTIME_ALLOWED_ORIGINS` contains only trusted frontend origins.
- [ ] Supabase migrations applied in order.
- [ ] RLS confirmed on `profiles`, `paired_devices`, `scan_sessions`, `invoices`, `invoice_items`, and `security_events`.
- [ ] Pairing tokens expire and are stored only as hashes.
- [ ] Device revocation tested.
- [ ] Rate limiting tested for API and WebSocket paths.
- [ ] CSP reviewed against production domains.
- [ ] Logs checked to avoid leaking tokens, API keys, raw cookies, or service role secrets.
- [ ] Dependabot, CodeQL, Semgrep, and dependency audit enabled in CI.
- [ ] Branch protection requires PR checks before merge.
