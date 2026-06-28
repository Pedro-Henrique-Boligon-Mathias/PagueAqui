import { parseRealtimeEnvironment } from '@leitor-nfce/shared';

import { buildApp, getAllowedOriginsFromEnv } from './app.js';

const env = parseRealtimeEnvironment(process.env);
const app = buildApp(undefined, {
  allowedOrigins: getAllowedOriginsFromEnv(env.REALTIME_ALLOWED_ORIGINS),
});

await app.listen({ host: env.HOST, port: env.PORT });
