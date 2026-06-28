'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type MobileWaitingPanelProps = {
  deviceId: string;
  deviceName: string;
};

type LookupState = 'checking' | 'connected' | 'error';

async function findActiveSession(deviceId: string) {
  const response = await fetch(`/api/mobile-session?device=${encodeURIComponent(deviceId)}`, {
    cache: 'no-store',
  });

  const data = (await response.json()) as { error?: string; scanUrl?: string };

  if (!response.ok) {
    throw new Error(data.error ?? 'Nao foi possivel procurar uma sessao de leitura.');
  }

  return data.scanUrl ?? null;
}

export function MobileWaitingPanel({ deviceId, deviceName }: MobileWaitingPanelProps) {
  const router = useRouter();
  const [state, setState] = useState<LookupState>('checking');
  const [message, setMessage] = useState('Procurando pedido de leitura do desktop...');

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    async function check() {
      try {
        setState('checking');
        const scanUrl = await findActiveSession(deviceId);

        if (!active) {
          return;
        }

        if (scanUrl) {
          router.replace(scanUrl);
          return;
        }

        setState('connected');
        setMessage('Celular conectado. Clique em escanear no desktop para liberar a camera aqui.');
      } catch (error) {
        if (!active) {
          return;
        }

        setState('error');
        setMessage(error instanceof Error ? error.message : 'Nao foi possivel procurar uma sessao.');
      } finally {
        if (active) {
          timer = window.setTimeout(check, 2500);
        }
      }
    }

    void check();

    return () => {
      active = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [deviceId, router]);

  return (
    <div className="scanner">
      <p className="notice success">{deviceName} conectado a sua conta.</p>
      <p className={state === 'error' ? 'notice' : 'muted'}>{message}</p>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          setMessage('Procurando pedido de leitura do desktop...');
          void findActiveSession(deviceId)
            .then((scanUrl) => {
              if (scanUrl) {
                router.replace(scanUrl);
                return;
              }

              setState('connected');
              setMessage('Nenhum pedido ativo ainda. Deixe esta tela aberta.');
            })
            .catch((error: unknown) => {
              setState('error');
              setMessage(error instanceof Error ? error.message : 'Nao foi possivel procurar uma sessao.');
            });
        }}
      >
        Procurar pedido agora
      </button>
    </div>
  );
}
