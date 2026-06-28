'use server';

import { redirect } from 'next/navigation';

import { getReachablePairingUrl } from '../../lib/app-url';
import { createPairingToken, hashToken } from '../../lib/crypto';
import { notifyRealtime } from '../../lib/realtime';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import {
  createDeviceScanUrl,
  getLatestActiveDevice,
  normalizeDeviceName,
  type PairedDeviceSummary,
} from './device-reuse';

function getDashboardErrorUrl(message: string) {
  return `/dashboard?pairingError=${encodeURIComponent(message)}`;
}

async function getAuthenticatedSupabase() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/dashboard');
  }

  return { supabase, user };
}

async function createScanSessionForDevice(device: { device_name: string; id: string }, userId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const desktopConnectionId = `desktop-${crypto.randomUUID()}`;
  const { data, error } = await supabase
    .from('scan_sessions')
    .insert({
      desktop_connection_id: desktopConnectionId,
      expires_at: expiresAt,
      mobile_device_id: device.id,
      status: 'waiting_mobile',
      user_id: userId,
    })
    .select('id')
    .single();

  if (error) {
    redirect(getDashboardErrorUrl(error.message));
  }

  const scanUrl = createDeviceScanUrl(await getReachablePairingUrl(), data.id, device.id);

  await notifyRealtime('desktop', {
    messageId: crypto.randomUUID(),
    sessionId: data.id,
    type: 'scan_requested',
  });

  redirect(
    `/dashboard?pairingSession=${encodeURIComponent(data.id)}&reuseDevice=${encodeURIComponent(
      device.device_name,
    )}&scanUrl=${encodeURIComponent(scanUrl)}`,
  );
}

export async function startPairing() {
  const { supabase, user } = await getAuthenticatedSupabase();

  const { data: devices, error: devicesError } = await supabase
    .from('paired_devices')
    .select('id, device_name, last_seen_at, revoked_at, created_at')
    .eq('user_id', user.id)
    .is('revoked_at', null);

  if (devicesError) {
    redirect(getDashboardErrorUrl(devicesError.message));
  }

  const latestDevice = getLatestActiveDevice((devices ?? []) as PairedDeviceSummary[]);

  if (latestDevice) {
    await createScanSessionForDevice(latestDevice, user.id);
  }

  await startNewPairing();
}

export async function startNewPairing() {
  const { supabase, user } = await getAuthenticatedSupabase();
  const token = createPairingToken();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const desktopConnectionId = `desktop-${crypto.randomUUID()}`;
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
    redirect(getDashboardErrorUrl(error.message));
  }

  const pairingUrl = new URL('/pair', await getReachablePairingUrl());
  pairingUrl.searchParams.set('token', token);

  redirect(
    `/dashboard?pairingSession=${encodeURIComponent(data.id)}&pairingUrl=${encodeURIComponent(
      pairingUrl.toString(),
    )}`,
  );
}

export async function requestDeviceScan(formData: FormData) {
  const deviceId = formData.get('deviceId');

  if (typeof deviceId !== 'string' || !deviceId) {
    redirect('/dashboard?pairingError=Dispositivo%20invalido.');
  }

  const { supabase, user } = await getAuthenticatedSupabase();
  const { data: device, error } = await supabase
    .from('paired_devices')
    .select('id, device_name')
    .eq('id', deviceId)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) {
    redirect(getDashboardErrorUrl(error.message));
  }

  if (!device) {
    redirect('/dashboard?pairingError=Celular%20nao%20encontrado%20ou%20revogado.');
  }

  await createScanSessionForDevice(device, user.id);
}

export async function renameDevice(formData: FormData) {
  const deviceId = formData.get('deviceId');
  const deviceName = normalizeDeviceName(formData.get('deviceName'));

  if (typeof deviceId !== 'string' || !deviceId || !deviceName) {
    redirect('/dashboard?pairingError=Nome%20ou%20dispositivo%20invalido.');
  }

  const { supabase, user } = await getAuthenticatedSupabase();
  const { error } = await supabase
    .from('paired_devices')
    .update({ device_name: deviceName })
    .eq('id', deviceId)
    .eq('user_id', user.id)
    .is('revoked_at', null);

  if (error) {
    redirect(getDashboardErrorUrl(error.message));
  }

  redirect('/dashboard?pairingMessage=Dispositivo%20renomeado.');
}

export async function revokeDevice(formData: FormData) {
  const deviceId = formData.get('deviceId');

  if (typeof deviceId !== 'string' || !deviceId) {
    redirect('/dashboard?pairingError=Dispositivo%20invalido.');
  }

  const { supabase, user } = await getAuthenticatedSupabase();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('paired_devices')
    .update({ revoked_at: now })
    .eq('id', deviceId)
    .eq('user_id', user.id)
    .is('revoked_at', null);

  if (error) {
    redirect(getDashboardErrorUrl(error.message));
  }

  await supabase
    .from('scan_sessions')
    .update({ status: 'cancelled' })
    .eq('user_id', user.id)
    .eq('mobile_device_id', deviceId)
    .in('status', ['waiting_mobile', 'scanning']);

  redirect('/dashboard?pairingMessage=Dispositivo%20revogado.');
}
