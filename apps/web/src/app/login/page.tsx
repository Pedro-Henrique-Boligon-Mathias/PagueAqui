import Link from 'next/link';

import { getSupabaseEnv } from '../../lib/env';
import { signIn, signUp } from './actions';

type LoginPageProps = {
  searchParams: Promise<{
    message?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { message, next } = await searchParams;
  const { isConfigured } = getSupabaseEnv();
  const nextPath = next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="login-title">
        <Link href="/" className="text-link">
          Leitor NFC-e
        </Link>
        <h1 id="login-title">Entrar no painel</h1>
        <p className="muted">Use sua conta para acessar suas notas fiscais e dispositivos pareados.</p>

        {!isConfigured ? (
          <p className="notice">
            Configure o Supabase no arquivo .env.local antes de usar login e cadastro.
          </p>
        ) : null}

        {message ? <p className="notice">{message}</p> : null}

        <form className="auth-form">
          <input name="next" type="hidden" value={nextPath} />
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Senha
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <div className="button-row">
            <button formAction={signIn} type="submit" disabled={!isConfigured}>
              Entrar
            </button>
            <button formAction={signUp} type="submit" disabled={!isConfigured} className="secondary">
              Criar conta
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
