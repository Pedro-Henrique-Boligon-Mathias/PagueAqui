'use server';

import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '../../lib/supabase/server';

const defaultNextPath = '/dashboard';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getNextPath(formData: FormData) {
  const next = getString(formData, 'next');
  return next.startsWith('/') && !next.startsWith('//') ? next : defaultNextPath;
}

function redirectWithMessage(message: string, next = defaultNextPath): never {
  const params = new URLSearchParams({ message });

  if (next !== defaultNextPath) {
    params.set('next', next);
  }

  redirect(`/login?${params.toString()}`);
}

function getAuthErrorMessage(error: { code?: string; message: string }) {
  if (error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message)) {
    return 'Seu email ainda nao foi confirmado. Abra o email do Supabase e confirme a conta antes de entrar.';
  }

  if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) {
    return 'Email ou senha incorretos. Se voce acabou de criar a conta, confirme o email antes de entrar.';
  }

  if (error.code === 'weak_password') {
    return 'A senha esta fraca demais para as regras do Supabase.';
  }

  if (error.code === 'signup_disabled') {
    return 'Cadastro desativado no Supabase.';
  }

  return `Supabase retornou: ${error.message}`;
}

export async function signIn(formData: FormData) {
  const email = getString(formData, 'email');
  const password = getString(formData, 'password');
  const next = getNextPath(formData);

  if (!email || !password) {
    redirectWithMessage('Informe email e senha.', next);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirectWithMessage(getAuthErrorMessage(error), next);
  }

  redirect(next);
}

export async function signUp(formData: FormData) {
  const email = getString(formData, 'email');
  const password = getString(formData, 'password');
  const next = getNextPath(formData);

  if (!email || !password) {
    redirectWithMessage('Informe email e senha para criar a conta.', next);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirectWithMessage(getAuthErrorMessage(error), next);
  }

  if (!data.session) {
    redirectWithMessage(
      'Conta criada. Agora confirme seu email pelo link enviado pelo Supabase antes de entrar.',
      next,
    );
  }

  redirect(next);
}
