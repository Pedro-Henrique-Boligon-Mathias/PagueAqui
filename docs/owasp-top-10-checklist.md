# OWASP Top 10 Checklist

## A01 Broken Access Control

- Supabase RLS is enabled on user-owned tables.
- API writes check authenticated `user.id`, device ownership, and session ownership.
- Tests cover rejecting another user's scan session.

## A02 Cryptographic Failures

- Secrets are not exposed through `NEXT_PUBLIC_` variables.
- Device tokens and pairing tokens are hashed before storage.
- Request IP and user-agent metadata are hashed in `security_events`.

## A03 Injection

- Database access uses Supabase query builders instead of string-built SQL.
- Realtime and API payloads are schema/shape validated before use.

## A04 Insecure Design

- Browser camera access requires HTTPS/user interaction.
- Realtime is scoped by scan session and role.
- Revoked devices are rejected before invoice persistence.

## A05 Security Misconfiguration

- CSP, frame, content-type, and referrer headers are set in middleware.
- CI includes dependency audit, Semgrep, and CodeQL.

## A06 Vulnerable and Outdated Components

- Dependabot monitors npm and GitHub Actions.
- CI runs `pnpm audit --audit-level=high`.

## A07 Identification and Authentication Failures

- Supabase Auth is the source of user identity.
- Protected pages redirect unauthenticated users to login.

## A08 Software and Data Integrity Failures

- CI uses `pnpm install --frozen-lockfile`.
- Pull requests require validation checks before merge.

## A09 Security Logging and Monitoring Failures

- Rejected device/session/payload attempts and successful scan persistence write `security_events`.

## A10 Server-Side Request Forgery

- The app does not fetch arbitrary invoice URLs server-side in this phase.
- Future external extraction must use allowlists and timeouts.
