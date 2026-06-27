import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getRealtimeWsUrl } from '../../lib/realtime';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import { ScanQrReader } from './qr-reader';

type ScanPageProps = {
  searchParams: Promise<{
    device?: string;
    session?: string;
  }>;
};

export default async function ScanPage({ searchParams }: ScanPageProps) {
  const { device, session } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = session ? `/scan?session=${session}${device ? `&device=${device}` : ''}` : '/scan';
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  if (!device) {
    return (
      <main className="auth-shell">
        <section className="auth-panel" aria-labelledby="scan-title">
          <Link href="/dashboard" className="text-link">
            Leitor NFC-e
          </Link>
          <h1 id="scan-title">Escanear nota</h1>
          <p className="notice">Sessao de leitura ausente. Gere um novo QR Code no dashboard.</p>
        </section>
      </main>
    );
  }

  const { data: pairedDevice } = await supabase
    .from('paired_devices')
    .select('id')
    .eq('id', device)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .maybeSingle();

  if (!pairedDevice) {
    return (
      <main className="auth-shell">
        <section className="auth-panel" aria-labelledby="scan-title">
          <Link href="/dashboard" className="text-link">
            Leitor NFC-e
          </Link>
          <h1 id="scan-title">Escanear nota</h1>
          <p className="notice">Este celular foi revogado. Gere um novo pareamento no dashboard.</p>
        </section>
      </main>
    );
  }

  const now = new Date().toISOString();
  const { data: latestDeviceSession } = await supabase
    .from('scan_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('mobile_device_id', device)
    .in('status', ['waiting_mobile', 'scanning'])
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session && latestDeviceSession) {
    redirect(`/scan?session=${encodeURIComponent(latestDeviceSession.id)}&device=${encodeURIComponent(device)}`);
  }

  const { data: scanSession } = session
    ? await supabase
        .from('scan_sessions')
        .select('id, mobile_device_id, status, expires_at')
        .eq('id', session)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };

  if (latestDeviceSession && latestDeviceSession.id !== session) {
    redirect(`/scan?session=${encodeURIComponent(latestDeviceSession.id)}&device=${encodeURIComponent(device)}`);
  }

  if (!scanSession || scanSession.mobile_device_id !== device) {
    return (
      <main className="auth-shell">
        <section className="auth-panel" aria-labelledby="scan-title">
          <Link href="/dashboard" className="text-link">
            Leitor NFC-e
          </Link>
          <h1 id="scan-title">Escanear nota</h1>
          <p className="notice">Este celular nao esta pareado para esta sessao.</p>
        </section>
      </main>
    );
  }

  if (new Date(scanSession.expires_at).getTime() <= Date.now()) {
    await supabase.from('scan_sessions').update({ status: 'expired' }).eq('id', scanSession.id);

    return (
      <main className="auth-shell">
        <section className="auth-panel" aria-labelledby="scan-title">
          <Link href="/dashboard" className="text-link">
            Leitor NFC-e
          </Link>
          <h1 id="scan-title">Escanear nota</h1>
          <p className="notice">Esta sessao expirou. Clique em Escanear com celular no dashboard.</p>
        </section>
      </main>
    );
  }

  await supabase.from('paired_devices').update({ last_seen_at: now }).eq('id', device);

  if (scanSession.status === 'waiting_mobile') {
    await supabase.from('scan_sessions').update({ status: 'scanning' }).eq('id', session);
  }

  return (
    <main className="scan-shell">
      <section className="scan-panel" aria-labelledby="scan-title">
        <Link href="/dashboard" className="text-link">
          Leitor NFC-e
        </Link>
        <h1 id="scan-title">Escanear nota fiscal</h1>
        <p className="muted">Aponte a camera para o QR Code da NFC-e.</p>
        <ScanQrReader deviceId={device} realtimeUrl={getRealtimeWsUrl()} sessionId={scanSession.id} />
      </section>
    </main>
  );
}
