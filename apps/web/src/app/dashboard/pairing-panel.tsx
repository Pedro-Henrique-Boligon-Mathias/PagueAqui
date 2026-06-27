'use client';

import type { InvoiceQrParsedPayload } from '@leitor-nfce/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type PairingPanelProps = {
  pairingSessionId: string;
  realtimeUrl: string;
  requestScanOnOpen?: boolean;
};

type PairingState = 'waiting' | 'confirmed' | 'offline';

function hasRealtimeMixedContentRisk(realtimeUrl: string) {
  return window.location.protocol === 'https:' && realtimeUrl.startsWith('ws://');
}

export function PairingPanel({ pairingSessionId, realtimeUrl, requestScanOnOpen = false }: PairingPanelProps) {
  const router = useRouter();
  const [state, setState] = useState<PairingState>('waiting');
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [scanPayload, setScanPayload] = useState<InvoiceQrParsedPayload | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [networkWarning, setNetworkWarning] = useState<string | null>(null);

  useEffect(() => {
    setNetworkWarning(
      hasRealtimeMixedContentRisk(realtimeUrl)
        ? 'O dashboard esta em HTTPS, mas o realtime esta em ws://. Use NEXT_PUBLIC_REALTIME_WS_URL com wss:// para receber leituras via ngrok.'
        : null,
    );

    const url = new URL(realtimeUrl);
    url.searchParams.set('role', 'desktop');
    url.searchParams.set('sessionId', pairingSessionId);

    const socket = new WebSocket(url);
    const offlineTimer = window.setTimeout(() => {
      if (socket.readyState !== WebSocket.OPEN) {
        setState('offline');
      }
    }, 1500);

    socket.addEventListener('open', () => {
      window.clearTimeout(offlineTimer);
      setState('waiting');
      socket.send(
        JSON.stringify({
          desktopConnectionId: `browser-${crypto.randomUUID()}`,
          messageId: crypto.randomUUID(),
          sessionId: pairingSessionId,
          type: 'desktop_connected',
        }),
      );

      if (requestScanOnOpen) {
        socket.send(
          JSON.stringify({
            messageId: crypto.randomUUID(),
            sessionId: pairingSessionId,
            type: 'scan_requested',
          }),
        );
      }
    });

    socket.addEventListener('message', (event) => {
      let data: {
        payload?: InvoiceQrParsedPayload;
        code?: string;
        invoiceId?: string;
        message?: string;
        reason?: string;
        type?: string;
      };

      try {
        data = JSON.parse(event.data as string) as typeof data;
      } catch {
        return;
      }

      if (data.type === 'pairing_confirmed') {
        setState('confirmed');
      }

      if (data.type === 'scan_result' && data.payload) {
        setInvoiceId(data.invoiceId ?? null);
        setScanPayload(data.payload);
        setScanError(null);
        router.refresh();
      }

      if (data.type === 'scan_failed') {
        setScanError(data.reason ?? 'Falha na leitura do QR Code.');
      }

      if (data.type === 'error' && data.code === 'target_offline') {
        setScanError('Celular offline. Abra o link de leitura no celular pareado para continuar.');
      }
    });

    socket.addEventListener('error', () => {
      setState('offline');
    });

    return () => {
      window.clearTimeout(offlineTimer);
      socket.close();
    };
  }, [pairingSessionId, realtimeUrl, requestScanOnOpen, router]);

  if (scanPayload) {
    return (
      <div className="notice success">
        <strong>{invoiceId ? 'Nota salva e recebida.' : 'Leitura recebida.'}</strong>
        <dl className="scan-details">
          <div>
            <dt>Chave de acesso</dt>
            <dd>{scanPayload.accessKey ?? 'Nao encontrada'}</dd>
          </div>
          <div>
            <dt>CNPJ</dt>
            <dd>{scanPayload.cnpj ?? 'Nao encontrado'}</dd>
          </div>
          <div>
            <dt>Modelo</dt>
            <dd>{scanPayload.model ?? 'Nao encontrado'}</dd>
          </div>
        </dl>
        <a className="text-link break-link" href={scanPayload.qrUrl} rel="noreferrer" target="_blank">
          Abrir NFC-e
        </a>
        <p className="scan-result">{scanPayload.rawValue}</p>
      </div>
    );
  }

  if (scanError) {
    return <p className="notice">{scanError}</p>;
  }

  if (networkWarning) {
    return <p className="notice">{networkWarning}</p>;
  }

  if (state === 'confirmed') {
    return <p className="notice success">Celular pareado. Aguardando leitura da nota...</p>;
  }

  if (state === 'offline') {
    return <p className="notice">Realtime offline. O pareamento ainda sera salvo no banco.</p>;
  }

  return <p className="notice">Aguardando confirmacao do celular...</p>;
}
