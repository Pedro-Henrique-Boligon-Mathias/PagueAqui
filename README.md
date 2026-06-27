# Leitor NFC-e

Aplicacao web para leitura de QR Codes de notas fiscais pelo celular, com painel desktop e servico realtime para pareamento.

## Estrutura

- `apps/web`: frontend Next.js.
- `apps/realtime`: servico Node.js/Fastify.
- `packages/shared`: tipos, schemas e utilitarios compartilhados.
- `packages/config`: configuracoes compartilhadas de TypeScript, ESLint e Prettier.

## Comandos

```bash
corepack pnpm install
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## Desenvolvimento

```bash
npm run dev
```

Esse comando sobe o Next.js em `3000` e o realtime em `3333`.

Depois do primeiro pareamento, o botao "Escanear com celular" tenta reutilizar o
ultimo celular ativo. Se o celular estiver fechado/offline, o dashboard mostra um
link de leitura para abrir no dispositivo pareado. Dispositivos podem ser
revogados no proprio dashboard.

Para testar o QR Code no celular, o celular precisa acessar o computador pela rede.
O app tenta trocar `localhost` pelo IP local automaticamente. Se preferir controlar isso
manualmente, coloque uma URL acessivel no `.env.local`.

Para deixar o desktop em `localhost` e mandar o QR para o celular, prefira:

```bash
NEXT_PUBLIC_PAIRING_APP_URL=http://SEU_IP_LOCAL:3000
```

Com ngrok:

```bash
NEXT_PUBLIC_PAIRING_APP_URL=https://sua-url-web.ngrok-free.app
NEXT_PUBLIC_REALTIME_WS_URL=wss://sua-url-realtime.ngrok-free.app/ws
NEXT_ALLOWED_DEV_ORIGINS=https://sua-url-web.ngrok-free.app
```

Para o celular enviar a leitura de volta para o desktop via ngrok, exponha tambem
o realtime (`3333`) em um segundo tunnel e use a URL `wss://.../ws` acima. Se a
pagina estiver em HTTPS e o realtime ficar como `ws://localhost:3333/ws`, o
navegador do celular nao vai conseguir entregar o resultado para o desktop.

## Supabase

1. Copie `.env.example` para `.env.local`.
2. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Aplique as migrations em `supabase/migrations` no seu projeto Supabase.
4. Abra `/login` para criar conta ou entrar.

## CI/CD

Pull requests para `main` rodam o workflow `.github/workflows/pull-request.yml`, que executa:

- `corepack pnpm install --frozen-lockfile`
- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`
- `corepack pnpm test:e2e` em um job separado para a suite E2E/Playwright

Configure a protecao da branch `main` no GitHub em **Settings > Branches > Branch protection rules**:

1. Crie uma regra para `main`.
2. Ative **Require a pull request before merging**.
3. Ative **Require status checks to pass before merging**.
4. Marque os checks `Lint, Types, Tests and Build` e `E2E / Playwright` como obrigatorios.
5. Ative **Require branches to be up to date before merging**.

O template `.github/pull_request_template.md` exige checklist de validacao local em cada PR.
