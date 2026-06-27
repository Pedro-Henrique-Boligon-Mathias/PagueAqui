import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { parseInvoiceQrPayload } from '@leitor-nfce/shared';

import { buildApp } from './app.js';

const app = buildApp();

async function connect(role: 'desktop' | 'mobile', sessionId: string) {
  return app.injectWS(`/ws?role=${role}&sessionId=${sessionId}`);
}

function waitForMessage(socket: WebSocket) {
  return new Promise<unknown>((resolve) => {
    socket.once('message', (data) => resolve(JSON.parse(data.toString())));
  });
}

describe('realtime app', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds to the healthcheck', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    const body = response.json<{ service: string; status: string }>();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({ service: 'realtime', status: 'ok' });
  });

  it('accepts websocket connections', async () => {
    const desktop = await connect('desktop', 'accepts-connection');

    expect(desktop.readyState).toBe(WebSocket.OPEN);

    desktop.close();
  });

  it('rejects invalid messages', async () => {
    const desktop = await connect('desktop', 'invalid-message');
    const messagePromise = waitForMessage(desktop);

    desktop.send(JSON.stringify({ type: 'scan_requested' }));

    await expect(messagePromise).resolves.toMatchObject({
      code: 'invalid_message',
      type: 'error',
    });

    desktop.close();
  });

  it('routes desktop messages to mobile', async () => {
    const sessionId = 'desktop-to-mobile';
    const desktop = await connect('desktop', sessionId);
    const mobile = await connect('mobile', sessionId);
    const messagePromise = waitForMessage(mobile);

    desktop.send(
      JSON.stringify({
        messageId: 'msg-1',
        sessionId,
        type: 'scan_requested',
      }),
    );

    await expect(messagePromise).resolves.toMatchObject({
      messageId: 'msg-1',
      type: 'scan_requested',
    });

    desktop.close();
    mobile.close();
  });

  it('routes mobile messages to desktop', async () => {
    const sessionId = 'mobile-to-desktop';
    const desktop = await connect('desktop', sessionId);
    const mobile = await connect('mobile', sessionId);
    const messagePromise = waitForMessage(desktop);

    mobile.send(
      JSON.stringify({
        messageId: 'msg-2',
        payload: parseInvoiceQrPayload(
          'https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=43260618052247000460650130000545801039901006%7C3%7C1',
        ),
        sessionId,
        type: 'scan_result',
      }),
    );

    await expect(messagePromise).resolves.toMatchObject({
      messageId: 'msg-2',
      payload: {
        accessKey: '43260618052247000460650130000545801039901006',
        cnpj: '18052247000460',
        model: '65',
      },
      type: 'scan_result',
    });

    desktop.close();
    mobile.close();
  });

  it('notifies when the target connection is offline', async () => {
    const desktop = await connect('desktop', 'target-offline');
    const messagePromise = waitForMessage(desktop);

    desktop.send(
      JSON.stringify({
        messageId: 'msg-3',
        sessionId: 'target-offline',
        type: 'scan_requested',
      }),
    );

    await expect(messagePromise).resolves.toMatchObject({
      code: 'target_offline',
      type: 'error',
    });

    desktop.close();
  });
});
