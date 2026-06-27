import Image from 'next/image';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';

import { getSupabaseEnv } from '../../lib/env';
import { getRealtimeWsUrl } from '../../lib/realtime';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import { addInvoiceItem, deleteInvoiceItem, extractInvoiceData, signOut, updateInvoice } from './actions';
import {
  getInvoiceDateInputValue,
  getInvoiceDisplayDate,
  getInvoiceDisplayTitle,
  getInvoiceDisplayTotal,
  getInvoiceStatus,
  type InvoiceListItem,
} from './invoice-list';
import { renameDevice, requestDeviceScan, revokeDevice, startNewPairing, startPairing } from './pairing-actions';
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
    latestInvoice?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { latestInvoice, pairingError, pairingMessage, pairingSession, pairingUrl, reuseDevice, scanUrl } =
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

  const primaryDevice = pairedDevices?.[0] ?? null;

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
  const scannerStatus = scanUrl
    ? `Pedido enviado para ${reuseDevice ?? 'o celular pareado'}`
    : activePairingSession
      ? 'Aguardando leitura do celular'
      : primaryDevice
        ? `${primaryDevice.device_name} disponivel para nova leitura`
        : 'Nenhum celular conectado ainda';
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

      <section className="empty-state scanner-command" aria-labelledby="empty-title">
        <div>
          <p className="eyebrow">Status</p>
          <h2 id="empty-title">{scannerStatus}</h2>
          <p className="muted">
            {primaryDevice
              ? 'Deixe /scan aberto no celular. O desktop pede a leitura e o celular libera a camera quando encontrar a sessao.'
              : 'Conecte um celular uma unica vez. Depois disso, ele aparece aqui como leitor disponivel.'}
          </p>
        </div>
        <div className="button-row">
          <form action={startPairing}>
            <button type="submit">{primaryDevice ? `Escanear com ${primaryDevice.device_name}` : 'Conectar celular'}</button>
          </form>
          {primaryDevice ? (
            <form action={startNewPairing}>
              <button className="secondary" type="submit">
                Conectar novo celular
              </button>
            </form>
          ) : null}
        </div>

        {pairingError ? <p className="notice">{pairingError}</p> : null}
        {pairingMessage ? <p className="notice success">{pairingMessage}</p> : null}

        {pairingSession && scanUrl ? (
          <div className="pairing-box">
            <div>
              <h3>{reuseDevice ? `Pedido enviado para ${reuseDevice}` : 'Celular pareado'}</h3>
              <p className="muted">
                Se o celular estiver em /scan, ele encontra este pedido sozinho. Este link tambem abre a leitura direto.
              </p>
              <a className="text-link break-link" href={scanUrl}>
                Abrir leitura neste dispositivo
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
          <p className="muted">Ultimas NFC-e lidas pelo celular. A nota mais nova abre destacada quando chega.</p>
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
                <details
                  className={invoice.id === latestInvoice ? 'invoice-row highlighted' : 'invoice-row'}
                  key={invoice.id}
                  open={invoice.id === latestInvoice}
                >
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

                  <form action={extractInvoiceData} className="inline-action-form">
                    <input name="invoiceId" type="hidden" value={invoice.id} />
                    <button type="submit">Extrair dados agora</button>
                    <span className="muted">Busca total e itens pelo link publico da NFC-e.</span>
                  </form>

                  <form action={updateInvoice} className="invoice-form">
                    <input name="invoiceId" type="hidden" value={invoice.id} />
                    <label>
                      Emitente
                      <input
                        name="issuerName"
                        placeholder="Nome do mercado"
                        type="text"
                        defaultValue={invoice.issuer_name ?? ''}
                      />
                    </label>
                    <label>
                      Total
                      <input
                        inputMode="decimal"
                        name="totalAmount"
                        placeholder="0,00"
                        type="text"
                        defaultValue={invoice.total_amount ?? ''}
                      />
                    </label>
                    <label>
                      Data da compra
                      <input
                        name="purchasedAt"
                        type="datetime-local"
                        defaultValue={getInvoiceDateInputValue(invoice)}
                      />
                    </label>
                    <button className="secondary" type="submit">
                      Salvar dados
                    </button>
                  </form>

                  {items.length ? (
                    <div className="item-list">
                      {items.map((item) => (
                        <div className="item-row" key={item.id}>
                          <span>{item.name}</span>
                          <small>{item.quantity ?? '-'} x {item.unit_price ?? '-'}</small>
                          <strong>{item.total_price ?? '-'}</strong>
                          <form action={deleteInvoiceItem}>
                            <input name="itemId" type="hidden" value={item.id} />
                            <button className="secondary danger" type="submit">
                              Remover
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="notice">Itens ainda nao extraidos. Cadastre manualmente enquanto a extracao automatica nao entra.</p>
                  )}

                  <form action={addInvoiceItem} className="item-form">
                    <input name="invoiceId" type="hidden" value={invoice.id} />
                    <label>
                      Item
                      <input name="name" placeholder="Produto ou servico" required type="text" />
                    </label>
                    <label>
                      Qtd.
                      <input inputMode="decimal" name="quantity" placeholder="1" type="text" />
                    </label>
                    <label>
                      Unitario
                      <input inputMode="decimal" name="unitPrice" placeholder="0,00" type="text" />
                    </label>
                    <label>
                      Total
                      <input inputMode="decimal" name="totalPrice" placeholder="0,00" type="text" />
                    </label>
                    <button type="submit">Adicionar item</button>
                  </form>
                </details>
              );
            })}
          </div>
        ) : null}

        {!invoicesError && !invoices?.length ? (
          <div className="notice empty-guide">
            <strong>Nenhuma nota salva ainda.</strong>
            <span>Conecte um celular, clique em escanear e aponte para o QR Code da NFC-e.</span>
          </div>
        ) : null}
      </section>

      <section className="empty-state" aria-labelledby="devices-title">
        <div>
          <h2 id="devices-title">Celulares pareados</h2>
          <p className="muted">Escolha qual celular vai ler a proxima nota, renomeie ou revogue acessos antigos.</p>
        </div>

        {pairedDevices?.length ? (
          <div className="device-list">
            {pairedDevices.map((device) => (
              <article className="device-row" key={device.id}>
                <div className="device-info">
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
                <form action={renameDevice} className="rename-form">
                  <input name="deviceId" type="hidden" value={device.id} />
                  <input aria-label="Nome do dispositivo" name="deviceName" defaultValue={device.device_name} />
                  <button className="secondary" type="submit">
                    Renomear
                  </button>
                </form>
                <div className="device-actions">
                  <form action={requestDeviceScan}>
                    <input name="deviceId" type="hidden" value={device.id} />
                    <button type="submit">Escanear</button>
                  </form>
                  <form action={revokeDevice}>
                    <input name="deviceId" type="hidden" value={device.id} />
                    <button className="secondary danger" type="submit">
                      Revogar
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="notice empty-guide">
            <strong>Nenhum celular pareado ainda.</strong>
            <span>Use Conectar celular para liberar o primeiro leitor.</span>
          </div>
        )}
      </section>
    </main>
  );
}
