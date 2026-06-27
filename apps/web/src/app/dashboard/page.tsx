import Image from 'next/image';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';

import { getSupabaseEnv } from '../../lib/env';
import { getRealtimeWsUrl } from '../../lib/realtime';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import { signOut } from './actions';
import {
  getInvoiceDisplayDate,
  getInvoiceDisplayTitle,
  getInvoiceDisplayTotal,
  getInvoiceStatus,
  type InvoiceListItem,
} from './invoice-list';
import { revokeDevice, startPairing } from './pairing-actions';
import { PairingPanel } from './pairing-panel';

export const dynamic = 'force-dynamic';

type DashboardPageProps = {
  searchParams: Promise<{
    pairingError?: string;
    pairingMessage?: string;
    pairingSession?: string;
    pairingUrl?: string;
    reuseDevice?: string;
    scanUrl?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { pairingError, pairingMessage, pairingSession, pairingUrl, reuseDevice, scanUrl } =
    await searchParams;
  const { isConfigured } = getSupabaseEnv();

  if (!isConfigured) {
    redirect('/login?message=Configure%20o%20Supabase%20antes%20de%20abrir%20o%20dashboard.');
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, created_at')
    .eq('id', user.id)
    .maybeSingle();

  const { count: invoiceCount } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true });

  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, access_key, qr_url, issuer_name, total_amount, purchased_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const invoiceIds = invoices?.map((invoice) => invoice.id) ?? [];
  const { data: invoiceItems } = invoiceIds.length
    ? await supabase
        .from('invoice_items')
        .select('id, invoice_id, name, quantity, unit_price, total_price')
        .in('invoice_id', invoiceIds)
        .order('created_at', { ascending: true })
    : { data: [] };

  const itemsByInvoiceId = new Map<string, typeof invoiceItems>();

  for (const item of invoiceItems ?? []) {
    const currentItems = itemsByInvoiceId.get(item.invoice_id) ?? [];
    currentItems.push(item);
    itemsByInvoiceId.set(item.invoice_id, currentItems);
  }

  const { count: deviceCount } = await supabase
    .from('paired_devices')
    .select('id', { count: 'exact', head: true })
    .is('revoked_at', null);

  const { data: pairedDevices } = await supabase
    .from('paired_devices')
    .select('id, device_name, last_seen_at, created_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  const { data: latestActiveSession } = await supabase
    .from('scan_sessions')
    .select('id, status, created_at')
    .eq('user_id', user.id)
    .in('status', ['waiting_mobile', 'scanning'])
    .not('mobile_device_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const activePairingSession = pairingSession ?? latestActiveSession?.id ?? null;
  const qrCodeDataUrl = pairingUrl
    ? await QRCode.toDataURL(pairingUrl, { errorCorrectionLevel: 'M', margin: 1, width: 240 })
    : null;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Leitor NFC-e</p>
          <h1>Dashboard</h1>
          <p className="muted">{user.email}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="secondary">
            Sair
          </button>
        </form>
      </header>

      <section className="metric-grid" aria-label="Resumo">
        <article className="metric">
          <span>Notas</span>
          <strong>{invoiceCount ?? 0}</strong>
        </article>
        <article className="metric">
          <span>Celulares pareados</span>
          <strong>{deviceCount ?? 0}</strong>
        </article>
        <article className="metric">
          <span>Perfil</span>
          <strong>{profile?.full_name ?? 'Sem nome'}</strong>
        </article>
      </section>

      <section className="empty-state" aria-labelledby="empty-title">
        <div>
          <h2 id="empty-title">Escanear com celular</h2>
          <p className="muted">
            Inicie um pareamento para conectar seu celular a este painel desktop.
          </p>
        </div>
        <form action={startPairing}>
          <button type="submit">Escanear com celular</button>
        </form>

        {pairingError ? <p className="notice">{pairingError}</p> : null}
        {pairingMessage ? <p className="notice success">{pairingMessage}</p> : null}

        {pairingSession && scanUrl ? (
          <div className="pairing-box">
            <div>
              <h3>{reuseDevice ? `Usando ${reuseDevice}` : 'Celular pareado'}</h3>
              <p className="muted">
                Se o celular nao abrir sozinho, abra este link no dispositivo pareado.
              </p>
              <a className="text-link break-link" href={scanUrl}>
                {scanUrl}
              </a>
              <PairingPanel
                pairingSessionId={pairingSession}
                realtimeUrl={getRealtimeWsUrl()}
                requestScanOnOpen
              />
            </div>
          </div>
        ) : null}

        {qrCodeDataUrl && pairingSession && pairingUrl ? (
          <div className="pairing-box">
            <Image
              alt="QR Code de pareamento"
              height={240}
              src={qrCodeDataUrl}
              unoptimized
              width={240}
            />
            <div>
              <h3>Abra este QR Code no celular</h3>
              <p className="muted">
                O token expira em 10 minutos. Use a mesma conta do desktop ao abrir no celular.
              </p>
              <a className="text-link break-link" href={pairingUrl}>
                {pairingUrl}
              </a>
              <PairingPanel pairingSessionId={pairingSession} realtimeUrl={getRealtimeWsUrl()} />
            </div>
          </div>
        ) : null}

        {!qrCodeDataUrl && !scanUrl && activePairingSession ? (
          <div className="pairing-box">
            <div>
              <h3>Celular conectado</h3>
              <p className="muted">
                Mantendo o desktop aguardando a leitura da nota na ultima sessao ativa.
              </p>
              <PairingPanel pairingSessionId={activePairingSession} realtimeUrl={getRealtimeWsUrl()} />
            </div>
          </div>
        ) : null}
      </section>


      <section className="empty-state" aria-labelledby="invoices-title">
        <div>
          <h2 id="invoices-title">Notas salvas</h2>
          <p className="muted">Ultimas NFC-e lidas pelo celular e persistidas no Supabase.</p>
        </div>

        {invoicesError ? <p className="notice">Nao foi possivel carregar as notas: {invoicesError.message}</p> : null}

        {!invoicesError && invoices?.length ? (
          <div className="invoice-list">
            {(invoices as InvoiceListItem[]).map((invoice) => {
              const items = itemsByInvoiceId.get(invoice.id) ?? [];
              const displayDate = new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(getInvoiceDisplayDate(invoice)));

              return (
                <details className="invoice-row" key={invoice.id}>
                  <summary>
                    <span>
                      <strong>{getInvoiceDisplayTitle(invoice)}</strong>
                      <small>{displayDate}</small>
                    </span>
                    <span className="invoice-meta">
                      <b>{getInvoiceDisplayTotal(invoice)}</b>
                      <small>{getInvoiceStatus(invoice)}</small>
                    </span>
                  </summary>
                  <dl className="scan-details">
                    <div>
                      <dt>Chave de acesso</dt>
                      <dd>{invoice.access_key ?? 'Nao encontrada'}</dd>
                    </div>
                    <div>
                      <dt>Link da NFC-e</dt>
                      <dd>
                        <a className="text-link break-link" href={invoice.qr_url} rel="noreferrer" target="_blank">
                          {invoice.qr_url}
                        </a>
                      </dd>
                    </div>
                  </dl>
                  {items.length ? (
                    <div className="item-list">
                      {items.map((item) => (
                        <div className="item-row" key={item.id}>
                          <span>{item.name}</span>
                          <small>{item.quantity ?? '-'} x {item.unit_price ?? '-'}</small>
                          <strong>{item.total_price ?? '-'}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="notice">Itens ainda nao extraidos. A estrutura ja esta pronta para a etapa de extracao.</p>
                  )}
                </details>
              );
            })}
          </div>
        ) : null}

        {!invoicesError && !invoices?.length ? (
          <p className="notice">Nenhuma nota salva ainda. Escaneie uma NFC-e pelo celular para ela aparecer aqui.</p>
        ) : null}
      </section>

      <section className="empty-state" aria-labelledby="devices-title">
        <div>
          <h2 id="devices-title">Celulares pareados</h2>
          <p className="muted">Revogue um celular para impedir que ele seja reutilizado em novas leituras.</p>
        </div>

        {pairedDevices?.length ? (
          <div className="device-list">
            {pairedDevices.map((device) => (
              <article className="device-row" key={device.id}>
                <div>
                  <strong>{device.device_name}</strong>
                  <p className="muted">
                    Ultimo uso:{' '}
                    {device.last_seen_at
                      ? new Intl.DateTimeFormat('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(device.last_seen_at))
                      : 'ainda nao registrado'}
                  </p>
                </div>
                <form action={revokeDevice}>
                  <input name="deviceId" type="hidden" value={device.id} />
                  <button className="secondary" type="submit">
                    Revogar
                  </button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <p className="notice">Nenhum celular pareado ainda.</p>
        )}
      </section>
    </main>
  );
}
