# Deploy

## Frontend Web

1. Configure the environment variables from `apps/web/.env.example` in the hosting provider.
2. Build with `corepack pnpm --filter @leitor-nfce/web build`.
3. Deploy the Next.js app with HTTPS enabled.
4. Set `NEXT_PUBLIC_REALTIME_WS_URL` to the public `wss://` endpoint of the realtime service.
5. Set `NEXT_PUBLIC_PAIRING_APP_URL` to the HTTPS URL reachable by the mobile browser.

## Realtime Service

1. Configure variables from `apps/realtime/.env.example`.
2. Set `REALTIME_ALLOWED_ORIGINS` to the exact frontend origins allowed to open WebSocket connections.
3. Build locally with `corepack pnpm --filter @leitor-nfce/realtime build` or build the Docker image:

```bash
docker build -f apps/realtime/Dockerfile -t leitor-nfce-realtime .
docker run --rm -p 3333:3333 \
  -e PORT=3333 \
  -e REALTIME_ALLOWED_ORIGINS=https://app.example.com \
  leitor-nfce-realtime
```

## Supabase

1. Create a Supabase project.
2. Apply SQL files from `supabase/migrations` in order.
3. Keep RLS enabled on all public user-owned tables.
4. Use only publishable keys in the frontend. Never expose service role keys.
5. Confirm Auth email settings for the target environment.

## Local Production Check

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm validate
```
