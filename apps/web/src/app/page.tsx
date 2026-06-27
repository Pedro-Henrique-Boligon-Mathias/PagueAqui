import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">Leitor NFC-e</p>
        <h1 id="hero-title">Notas fiscais organizadas a partir do QR Code.</h1>
        <p className="summary">
          Base inicial do painel web para conectar desktop, celular e leitura de notas fiscais.
        </p>
        <div className="button-row">
          <Link className="button-link" href="/login">
            Entrar
          </Link>
          <Link className="button-link secondary" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
