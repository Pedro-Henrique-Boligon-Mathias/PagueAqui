import type { RealtimeMessage } from '@leitor-nfce/shared';

export function getRealtimeWsUrl() {
  return process.env.NEXT_PUBLIC_REALTIME_WS_URL ?? 'ws://localhost:3333/ws';
}

export async function notifyRealtime(role: 'desktop' | 'mobile', message: RealtimeMessage) {
  const url = new URL(getRealtimeWsUrl());
  url.searchParams.set('role', role);
  url.searchParams.set('sessionId', message.sessionId);

  const WebSocketCtor = globalThis.WebSocket;

  if (!WebSocketCtor) {
    return;
  }

  await new Promise<void>((resolve) => {
    const socket = new WebSocketCtor(url);
    const timeout = setTimeout(() => {
      socket.close();
      resolve();
    }, 1500);

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify(message));
      clearTimeout(timeout);
      socket.close();
      resolve();
    });

    socket.addEventListener('error', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
