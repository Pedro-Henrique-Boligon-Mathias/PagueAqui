'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { hashText, hashToken } from '../../lib/crypto';
import { notifyRealtime } from '../../lib/realtime';
import { createServerSupabaseClient } from '../../lib/supabase/server';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function confirmPairing(formData: FormData) {
  const token = getString(formData, 'token');
  const deviceName = getString(formData, 'deviceName') || 'Celular';

  if (!token) {
    redirect('/pair?message=Token%20de%20pareamento%20ausente.');
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/pair?token=${token}`)}`);
  }

  const tokenHash = hashToken(token);
  const { data: session, error: sessionError } = await supabase
    .from('scan_sessions')
    .select('id, expires_at, status')
    .eq('pairing_token_hash', tokenHash)
    .eq('user_id', user.id)
    .maybeSingle();

  if (sessionError || !session) {
    redirect(
      '/pair?message=Token%20invalido%2C%20expirado%20ou%20ja%20usado.%20Gere%20um%20novo%20QR%20Code%20no%20dashboard.',
    );
  }

  if (session.status !== 'pending_pairing') {
    redirect('/pair?message=Esta%20sessao%20de%20pareamento%20ja%20foi%20usada.');
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await supabase.from('scan_sessions').update({ status: 'expired' }).eq('id', session.id);
    redirect('/pair?message=Token%20de%20pareamento%20expirado.');
  }

  const headerStore = await headers();
  const userAgent = headerStore.get('user-agent') ?? 'unknown-device';
  const deviceFingerprintHash = hashText(`${user.id}:${userAgent}`);
  const now = new Date().toISOString();
  const { data: existingDevice, error: existingDeviceError } = await supabase
    .from('paired_devices')
    .select('id')
    .eq('user_id', user.id)
    .eq('device_fingerprint_hash', deviceFingerprintHash)
    .is('revoked_at', null)
    .maybeSingle();

  if (existingDeviceError) {
    redirect(
      `/pair?token=${encodeURIComponent(token)}&message=${encodeURIComponent(
        existingDeviceError.message,
      )}`,
    );
  }

  const { data: device, error: deviceError } = existingDevice
    ? await supabase
        .from('paired_devices')
        .update({
          device_name: deviceName,
          last_seen_at: now,
        })
        .eq('id', existingDevice.id)
        .select('id')
        .single()
    : await supabase
        .from('paired_devices')
        .insert({
          device_fingerprint_hash: deviceFingerprintHash,
          device_name: deviceName,
          device_public_token_hash: hashText(crypto.randomUUID()),
          last_seen_at: now,
          user_id: user.id,
        })
        .select('id')
        .single();

  if (deviceError) {
    redirect(`/pair?token=${encodeURIComponent(token)}&message=${encodeURIComponent(deviceError.message)}`);
  }

  const { error: updateError } = await supabase
    .from('scan_sessions')
    .update({
      mobile_device_id: device.id,
      pairing_confirmed_at: new Date().toISOString(),
      pairing_token_hash: null,
      status: 'waiting_mobile',
    })
    .eq('id', session.id);

  if (updateError) {
    redirect(`/pair?token=${encodeURIComponent(token)}&message=${encodeURIComponent(updateError.message)}`);
  }

  await notifyRealtime('mobile', {
    messageId: crypto.randomUUID(),
    mobileDeviceId: device.id,
    sessionId: session.id,
    type: 'pairing_confirmed',
  });

  redirect(`/scan?session=${encodeURIComponent(session.id)}&device=${encodeURIComponent(device.id)}`);
}
