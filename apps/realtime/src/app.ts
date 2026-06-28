import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import type WebSocket from 'ws';

import {
  HealthResponseSchema,
  RealtimeConnectionQuerySchema,
  RealtimeErrorMessageSchema,
  RealtimeMessageSchema,
  createHealthResponse,
  type ConnectionRole,
  parseOriginAllowlist,
  type RealtimeMessage,
} from '@leitor-nfce/shared';

type ActiveConnection = {
  role: ConnectionRole;
  socket: WebSocket;
};

type SessionConnections = {
  desktop?: ActiveConnection;
  mobile?: ActiveConnection;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

type RealtimeAppOptions = {
  allowedOrigins?: string[];
};

export type RealtimeConnectionStore = {
  getSession(sessionId: string): SessionConnections | undefined;
  register(sessionId: string, connection: ActiveConnection): void;
  unregister(sessionId: string, role: ConnectionRole, socket: WebSocket): void;
};

export function createInMemoryConnectionStore(): RealtimeConnectionStore {
  const sessions = new Map<string, SessionConnections>();

  return {
    getSession(sessionId) {
      return sessions.get(sessionId);
    },
    register(sessionId, connection) {
      const session = sessions.get(sessionId) ?? {};
      session[connection.role] = connection;
      sessions.set(sessionId, session);
    },
    unregister(sessionId, role, socket) {
      const session = sessions.get(sessionId);

      if (!session || session[role]?.socket !== socket) {
        return;
      }

      delete session[role];

      if (!session.desktop && !session.mobile) {
        sessions.delete(sessionId);
      }
    },
  };
}

export function getAllowedOriginsFromEnv(value?: string) {
  return parseOriginAllowlist(value);
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[] = []) {
  if (!origin || allowedOrigins.length === 0) {
    return true;
  }

  try {
    return allowedOrigins.includes(new URL(origin).origin);
  } catch {
    return false;
  }
}

function sendJson(socket: WebSocket, payload: unknown) {
  if (socket.readyState !== socket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function sendError(socket: WebSocket, code: string, message: string) {
  sendJson(socket, RealtimeErrorMessageSchema.parse({ code, message, type: 'error' }));
}

function isRateLimited(state: RateLimitState, limit: number, windowMs: number, now = Date.now()) {
  if (state.resetAt <= now) {
    state.count = 1;
    state.resetAt = now + windowMs;
    return false;
  }

  if (state.count >= limit) {
    return true;
  }

  state.count += 1;
  return false;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown realtime error.';
}

function getTargetRole(message: RealtimeMessage, senderRole: ConnectionRole): ConnectionRole | null {
  if (message.type === 'desktop_connected' || message.type === 'mobile_connected') {
    return null;
  }

  if (
    message.type === 'pairing_started' ||
    message.type === 'scan_requested' ||
    message.type === 'session_expired'
  ) {
    return 'mobile';
  }

  if (
    message.type === 'pairing_confirmed' ||
    message.type === 'scan_result' ||
    message.type === 'scan_failed'
  ) {
    return 'desktop';
  }

  return senderRole === 'desktop' ? 'mobile' : 'desktop';
}

export function buildApp(store = createInMemoryConnectionStore(), options: RealtimeAppOptions = {}) {
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.status(500).send({ error: getErrorMessage(error) });
  });

  app.register(websocket, {
    errorHandler(error, socket) {
      sendError(socket, 'internal_error', getErrorMessage(error));
      socket.close(1011, 'internal_error');
    },
  });

  app.get('/health', async () => HealthResponseSchema.parse(createHealthResponse('realtime')));

  app.register(async (realtimeApp) => {
    realtimeApp.get('/ws', { websocket: true }, (socket, request) => {
      if (!isOriginAllowed(request.headers.origin, options.allowedOrigins)) {
        sendError(socket, 'origin_not_allowed', 'Realtime origin is not allowed.');
        socket.close(1008, 'origin_not_allowed');
        return;
      }

      const parsedQuery = RealtimeConnectionQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        sendError(socket, 'invalid_connection', 'Use role=desktop|mobile and sessionId.');
        socket.close(1008, 'invalid_connection');
        return;
      }

      const { role, sessionId } = parsedQuery.data;
      const rateLimitState: RateLimitState = { count: 0, resetAt: Date.now() + 60_000 };
      store.register(sessionId, { role, socket });

      socket.on('message', (rawMessage) => {
        if (isRateLimited(rateLimitState, 120, 60_000)) {
          sendError(socket, 'rate_limited', 'Too many realtime messages.');
          return;
        }
        let parsedJson: unknown;

        try {
          parsedJson = JSON.parse(rawMessage.toString());
        } catch {
          sendError(socket, 'invalid_json', 'Message must be valid JSON.');
          return;
        }

        const parsedMessage = RealtimeMessageSchema.safeParse(parsedJson);

        if (!parsedMessage.success) {
          sendError(socket, 'invalid_message', 'Message payload does not match realtime schema.');
          return;
        }

        const message = parsedMessage.data;

        if (message.sessionId !== sessionId) {
          sendError(socket, 'session_mismatch', 'Message sessionId differs from connection sessionId.');
          return;
        }

        const targetRole = getTargetRole(message, role);

        if (!targetRole) {
          return;
        }

        const target = store.getSession(sessionId)?.[targetRole];

        if (!target) {
          sendError(socket, 'target_offline', `${targetRole} connection is offline.`);
          return;
        }

        sendJson(target.socket, message);
      });

      socket.on('close', () => {
        store.unregister(sessionId, role, socket);
      });
    });
  });

  return app;
}
