import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '../../../lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device');

  if (!deviceId) {
    return NextResponse.json({ error: 'Dispositivo ausente.' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Usuario nao autenticado.' }, { status: 401 });
  }

  const { data: pairedDevice } = await supabase
    .from('paired_devices')
    .select('id')
    .eq('id', deviceId)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .maybeSingle();

  if (!pairedDevice) {
    return NextResponse.json({ error: 'Dispositivo nao pareado.' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { data: latestSession } = await supabase
    .from('scan_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('mobile_device_id', deviceId)
    .in('status', ['waiting_mobile', 'scanning'])
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestSession) {
    return NextResponse.json({ scanUrl: null });
  }

  return NextResponse.json({
    scanUrl: `/scan?session=${encodeURIComponent(latestSession.id)}&device=${encodeURIComponent(deviceId)}`,
  });
}
