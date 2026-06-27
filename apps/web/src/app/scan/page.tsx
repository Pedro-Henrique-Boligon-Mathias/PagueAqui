import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getRealtimeWsUrl } from '../../lib/realtime';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import { MobileWaitingPanel } from './mobile-waiting';
import { ScanQrReader } from './qr-reader';

type ScanPageProps = {
  searchParams: Promise<{
    device?: string;
    session?: string;
  }>;
};

function buildScanNextUrl(session?: string, device?: string) {
  const params = new URLSearchParams();

  if (session) {
    params.set('session', session);
  }

  if (device) {
    params.set('device', device);
  }

  const query = params.toString();
  return query ? `/scan?${query}` : '/scan';
}

function ScanShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="scan-title">
        <Link href="/dashboard" className="text-link">
          Leitor NFC-e
        </Link>
        <h1 id="scan-title">Escanear nota</h1>
        {children}
      </section>
    </main>
  );
}

export default async function ScanPage({ searchParams }: ScanPageProps) {
  const { device, session } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(buildScanNextUrl(session, device))}`);
  }

  const cookieStore = await cookies();
  const rememberedDeviceId = cookieStore.get('leitor_nfce_device_id')?.value;
  let activeDeviceId = device ?? rememberedDeviceId ?? null;

  if (!activeDeviceId) {
    const { data: latestDevice } = await supabase
      .from('paired_devices')
      .select('id')
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .order('last_seen_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    activeDeviceId = latestDevice?.id ?? null;
  }

  if (!activeDeviceId) {
    return (
      <ScanShell>
        <p className="notice">Nenhum celular pareado ainda. Gere o primeiro pareamento no dashboard.</p>
      </ScanShell>
    );
  }

  const { data: pairedDevice } = await supabase
    .from('paired_devices')
    .select('id, device_name')
    .eq('id', activeDeviceId)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .maybeSingle();

  if (!pairedDevice) {
    return (
      <ScanShell>
        <p className="notice">Este celular foi revogado. Gere um novo pareamento no dashboard.</p>
      </ScanShell>
    );
  }

  const now = new Date().toISOString();
  const { data: latestDeviceSession } = await supabase
    .from('scan_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('mobile_device_id', activeDeviceId)
    .in('status', ['waiting_mobile', 'scanning'])
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session && latestDeviceSession) {
    redirect(
      `/scan?session=${encodeURIComponent(latestDeviceSession.id)}&device=${encodeURIComponent(activeDeviceId)}`,
    );
  }

  if (!session) {
    return (
      <main className="scan-shell">
        <section className="scan-panel" aria-labelledby="scan-title">
          <Link href="/dashboard" className="text-link">
            Leitor NFC-e
          </Link>
          <h1 id="scan-title">Celular conectado</h1>
          <MobileWaitingPanel deviceId={activeDeviceId} deviceName={pairedDevice.device_name} />
        </section>
      </main>
    );
  }

  const { data: scanSession } = await supabase
    .from('scan_sessions')
    .select('id, mobile_device_id, status, expires_at')
    .eq('id', session)
    .eq('user_id', user.id)
    .maybeSingle();

  if (latestDeviceSession && latestDeviceSession.id !== session) {
    redirect(
      `/scan?session=${encodeURIComponent(latestDeviceSession.id)}&device=${encodeURIComponent(activeDeviceId)}`,
    );
  }

  if (!scanSession || scanSession.mobile_device_id !== activeDeviceId) {
    return (
      <ScanShell>
        <p className="notice">Este celular nao esta pareado para esta sessao.</p>
      </ScanShell>
    );
  }

  if (new Date(scanSession.expires_at).getTime() <= Date.now()) {
    await supabase.from('scan_sessions').update({ status: 'expired' }).eq('id', scanSession.id);

    return (
      <ScanShell>
        <p className="notice">Esta sessao expirou. Clique em Escanear no dashboard.</p>
      </ScanShell>
    );
  }

  await supabase.from('paired_devices').update({ last_seen_at: now }).eq('id', activeDeviceId);

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
        <p className="muted">{pairedDevice.device_name} conectado. Aponte a camera para o QR Code da NFC-e.</p>
        <ScanQrReader deviceId={activeDeviceId} realtimeUrl={getRealtimeWsUrl()} sessionId={scanSession.id} />
      </section>
    </main>
  );
}
