import { createHash } from 'node:crypto';

export type SecurityEventClient = {
  from(table: 'security_events'): {
    insert(payload: {
      event_type: string;
      ip_hash: string | null;
      metadata: Record<string, unknown>;
      user_agent_hash: string | null;
      user_id: string | null;
    }): unknown;
  };
};

function hashNullable(value: string | null) {
  return value ? createHash('sha256').update(value).digest('hex') : null;
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || request.headers.get('x-real-ip') || null;
}

export function getSecurityRequestHashes(request: Request) {
  return {
    ipHash: hashNullable(getRequestIp(request)),
    userAgentHash: hashNullable(request.headers.get('user-agent')),
  };
}

export async function logSecurityEvent(
  client: SecurityEventClient,
  request: Request,
  eventType: string,
  userId: string | null,
  metadata: Record<string, unknown> = {},
) {
  const { ipHash, userAgentHash } = getSecurityRequestHashes(request);

  try {
    await client.from('security_events').insert({
      event_type: eventType,
      ip_hash: ipHash,
      metadata,
      user_agent_hash: userAgentHash,
      user_id: userId,
    });
  } catch {
    // Security logging must not break the user flow.
  }
}
