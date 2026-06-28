'use client';

import { isValidInvoiceQrPayload, parseInvoiceQrPayload } from '@leitor-nfce/shared';
import QrScanner from 'qr-scanner';
import { useEffect, useRef, useState } from 'react';

type ReaderState = 'idle' | 'starting' | 'reading' | 'success' | 'error';
type SocketState = 'connecting' | 'connected' | 'offline';

type ScanQrReaderProps = {
  deviceId: string;
  realtimeUrl: string;
  sessionId: string;
};

function isSecureCameraContext() {
  return window.isSecureContext || window.location.hostname === 'localhost';
}

function createSocket(realtimeUrl: string, sessionId: string) {
  const url = new URL(realtimeUrl);
  url.searchParams.set('role', 'mobile');
  url.searchParams.set('sessionId', sessionId);
  return new WebSocket(url);
}

function hasRealtimeMixedContentRisk(realtimeUrl: string) {
  return window.location.protocol === 'https:' && realtimeUrl.startsWith('ws://');
}

function getOpenSocket(socket: WebSocket | null) {
  return socket?.readyState === WebSocket.OPEN ? socket : null;
}

async function saveScanResult(sessionId: string, deviceId: string, rawValue: string) {
  const response = await fetch('/api/scan-results', {
    body: JSON.stringify({ deviceId, rawValue, sessionId }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  const data = (await response.json()) as {
    enrichment?: {
      error?: string | null;
      itemCount?: number;
      status?: string;
    };
    error?: string;
    invoiceId?: string;
    payload?: ReturnType<typeof parseInvoiceQrPayload>;
  };

  if (!response.ok || !data.invoiceId || !data.payload) {
    throw new Error(data.error ?? 'Nao foi possivel salvar a nota fiscal.');
  }

  return {
    enrichment: data.enrichment ?? { itemCount: 0, status: 'not_available' },
    invoiceId: data.invoiceId,
    payload: data.payload,
  };
}

export function ScanQrReader({ deviceId, realtimeUrl, sessionId }: ScanQrReaderProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<ReaderState>('idle');
  const [socketState, setSocketState] = useState<SocketState>('connecting');
  const [message, setMessage] = useState('Toque para iniciar a camera.');
  const [lastValue, setLastValue] = useState<string | null>(null);
  const [networkWarning, setNetworkWarning] = useState<string | null>(null);

  useEffect(() => {
    setNetworkWarning(
      hasRealtimeMixedContentRisk(realtimeUrl)
        ? 'O app esta em HTTPS, mas o realtime esta em ws://. Use um WSS do ngrok para o celular conseguir enviar a leitura.'
        : null,
    );
    setSocketState('connecting');

    const socket = createSocket(realtimeUrl, sessionId);
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          messageId: crypto.randomUUID(),
          mobileDeviceId: deviceId,
          sessionId,
          type: 'mobile_connected',
        }),
      );
      setSocketState('connected');
    });

    socket.addEventListener('close', () => {
      setSocketState('offline');
    });

    socket.addEventListener('error', () => {
      setSocketState('offline');
    });

    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data as string) as { type?: string };

        if (data.type === 'scan_requested') {
          setMessage('Desktop conectado. Toque para iniciar a camera.');
        }
      } catch {
        return;
      }
    });

    return () => {
      socket.close();
    };
  }, [deviceId, realtimeUrl, sessionId]);

  useEffect(() => {
    return () => {
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, []);

  async function startScanner() {
    if (!videoRef.current) {
      return;
    }

    if (!isSecureCameraContext()) {
      setState('error');
      setMessage('A camera exige HTTPS. Use ngrok ou abra em localhost no proprio aparelho.');
      return;
    }

    setState('starting');
    setMessage('Solicitando permissao da camera...');
    setLastValue(null);

    scannerRef.current?.destroy();

    const scanner = new QrScanner(
      videoRef.current,
      async (result) => {
        const rawValue = result.data.trim();

        if (!isValidInvoiceQrPayload(rawValue)) {
          setState('error');
          setMessage('QR Code invalido. Aponte para o QR Code da nota fiscal.');
          const socket = getOpenSocket(socketRef.current);
          if (socket) {
            socket.send(
              JSON.stringify({
                messageId: crypto.randomUUID(),
                reason: 'QR Code invalido para NFC-e.',
                sessionId,
                type: 'scan_failed',
              }),
            );
          }
          return;
        }

        scanner.stop();
        setState('starting');
        setMessage('Salvando nota fiscal...');

        let savedScan: Awaited<ReturnType<typeof saveScanResult>>;

        try {
          savedScan = await saveScanResult(sessionId, deviceId, rawValue);
        } catch (error) {
          setState('error');
          setMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar a nota fiscal.');
          setLastValue(rawValue);
          return;
        }

        const socket = getOpenSocket(socketRef.current);
        setLastValue(savedScan.payload.accessKey ?? savedScan.payload.rawValue);
        setState('success');

        if (!socket) {
          setMessage('Nota salva, mas o realtime esta desconectado. Atualize o desktop para ver a nota.');
          return;
        }

        socket.send(
          JSON.stringify({
            invoiceId: savedScan.invoiceId,
            messageId: crypto.randomUUID(),
            payload: savedScan.payload,
            sessionId,
            type: 'scan_result',
          }),
        );
        setMessage(
          savedScan.enrichment.status === 'completed'
            ? `Nota salva com ${savedScan.enrichment.itemCount ?? 0} item(ns) extraido(s).`
            : 'Nota salva, mas os itens nao foram extraidos automaticamente.',
        );
      },
      {
        highlightScanRegion: true,
        highlightCodeOutline: true,
        preferredCamera: 'environment',
        returnDetailedScanResult: true,
      },
    );

    scannerRef.current = scanner;

    try {
      await scanner.start();
      setState('reading');
      setMessage('Lendo QR Code...');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel abrir a camera.');
    }
  }

  function runPrimaryAction() {
    if (state === 'success') {
      window.location.href = '/scan';
      return;
    }

    void startScanner();
  }

  function getPrimaryActionLabel() {
    if (state === 'idle') {
      return 'Escanear QR Code';
    }

    if (state === 'success') {
      return 'Aguardar nova leitura';
    }

    return 'Tentar novamente';
  }

  return (
    <div className="scanner">
      <div className="scanner-video">
        <video ref={videoRef} muted playsInline />
      </div>
      {networkWarning ? <p className="notice">{networkWarning}</p> : null}
      <p className={socketState === 'connected' ? 'muted' : 'notice'}>
        Realtime:{' '}
        {socketState === 'connected'
          ? 'conectado'
          : socketState === 'connecting'
            ? 'conectando...'
            : 'offline'}
      </p>
      <p className={state === 'error' ? 'notice' : state === 'success' ? 'notice success' : 'muted'}>
        {message}
      </p>
      {lastValue ? <p className="scan-result">{lastValue}</p> : null}
      <div className="button-row">
        <button type="button" onClick={runPrimaryAction}>
          {getPrimaryActionLabel()}
        </button>
        {state === 'reading' || state === 'starting' ? (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              scannerRef.current?.stop();
              setState('idle');
              setMessage('Leitura cancelada.');
            }}
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </div>
  );
}
