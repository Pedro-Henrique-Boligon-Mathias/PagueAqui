'use server';

import { redirect } from 'next/navigation';

import { getReachablePairingUrl } from '../../lib/app-url';
import { createPairingToken, hashToken } from '../../lib/crypto';
import { notifyRealtime } from '../../lib/realtime';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import { createDeviceScanUrl, getLatestActiveDevice, type PairedDeviceSummary } from './device-reuse';

export async function startPairing() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/dashboard');
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const desktopConnectionId = `desktop-${crypto.randomUUID()}`;
  const { data: devices, error: devicesError } = await supabase
    .from('paired_devices')
    .select('id, device_name, last_seen_at, revoked_at, created_at')
    .eq('user_id', user.id)
    .is('revoked_at', null);

  if (devicesError) {
    redirect(`/dashboard?pairingError=${encodeURIComponent(devicesError.message)}`);
  }

  const latestDevice = getLatestActiveDevice((devices ?? []) as PairedDeviceSummary[]);

  if (latestDevice) {
    const { data, error } = await supabase
      .from('scan_sessions')
      .insert({
        desktop_connection_id: desktopConnectionId,
        expires_at: expiresAt,
        mobile_device_id: latestDevice.id,
        status: 'waiting_mobile',
        user_id: user.id,
      })
      .select('id')
      .single();

    if (error) {
      redirect(`/dashboard?pairingError=${encodeURIComponent(error.message)}`);
    }

    const scanUrl = createDeviceScanUrl(await getReachablePairingUrl(), data.id, latestDevice.id);

    await notifyRealtime('desktop', {
      messageId: crypto.randomUUID(),
      sessionId: data.id,
      type: 'scan_requested',
    });

    redirect(
      `/dashboard?pairingSession=${encodeURIComponent(data.id)}&reuseDevice=${encodeURIComponent(
        latestDevice.device_name,
      )}&scanUrl=${encodeURIComponent(scanUrl)}`,
    );
  }

  const token = createPairingToken();
  const { data, error } = await supabase
    .from('scan_sessions')
    .insert({
      desktop_connection_id: desktopConnectionId,
      expires_at: expiresAt,
      pairing_token_hash: hashToken(token),
      status: 'pending_pairing',
      user_id: user.id,
    })
    .select('id')
    .single();

  if (error) {
    redirect(`/dashboard?pairingError=${encodeURIComponent(error.message)}`);
  }

  const pairingUrl = new URL('/pair', await getReachablePairingUrl());
  pairingUrl.searchParams.set('token', token);

  redirect(
    `/dashboard?pairingSession=${encodeURIComponent(data.id)}&pairingUrl=${encodeURIComponent(
      pairingUrl.toString(),
    )}`,
  );
}

export async function revokeDevice(formData: FormData) {
  const deviceId = formData.get('deviceId');

  if (typeof deviceId !== 'string' || !deviceId) {
    redirect('/dashboard?pairingError=Dispositivo%20invalido.');
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/dashboard');
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('paired_devices')
    .update({ revoked_at: now })
    .eq('id', deviceId)
    .eq('user_id', user.id)
    .is('revoked_at', null);

  if (error) {
    redirect(`/dashboard?pairingError=${encodeURIComponent(error.message)}`);
  }

  await supabase
    .from('scan_sessions')
    .update({ status: 'cancelled' })
    .eq('user_id', user.id)
    .eq('mobile_device_id', deviceId)
    .in('status', ['waiting_mobile', 'scanning']);

  redirect('/dashboard?pairingMessage=Dispositivo%20revogado.');
}
