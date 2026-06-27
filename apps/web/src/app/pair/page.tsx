import Link from 'next/link';

import { getSupabaseEnv } from '../../lib/env';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import { confirmPairing } from './actions';

type PairPageProps = {
  searchParams: Promise<{
    message?: string;
    token?: string;
  }>;
};

export default async function PairPage({ searchParams }: PairPageProps) {
  const { message, token } = await searchParams;
  const { isConfigured } = getSupabaseEnv();
  const supabase = isConfigured ? await createServerSupabaseClient() : null;
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="pair-title">
        <Link href="/" className="text-link">
          Leitor NFC-e
        </Link>
        <h1 id="pair-title">Parear celular</h1>
        <p className="muted">Confirme o vinculo deste celular com sua conta para iniciar leituras.</p>

        {message ? <p className="notice">{message}</p> : null}

        {!token ? <p className="notice">Token de pareamento ausente ou invalido.</p> : null}

        {token && !user ? (
          <p className="notice">
            Entre com a mesma conta do desktop para confirmar este pareamento.
          </p>
        ) : null}

        {token && !user ? (
          <Link className="button-link" href={`/login?next=${encodeURIComponent(`/pair?token=${token}`)}`}>
            Entrar
          </Link>
        ) : null}

        {token && user ? (
          <form className="auth-form" action={confirmPairing}>
            <input name="token" type="hidden" value={token} />
            <label>
              Nome do celular
              <input name="deviceName" type="text" defaultValue="Meu celular" required />
            </label>
            <button type="submit">Confirmar pareamento</button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
