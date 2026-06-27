# Security Policy

## Supported Versions

This project is in early development. Security fixes are applied to the `main` branch.

## Reporting a Vulnerability

Do not open public issues for sensitive reports. Send the project owner a private report with:

- affected route, workflow, or table;
- steps to reproduce;
- expected and observed impact;
- screenshots or logs when useful;
- suggested fix, if known.

## Security Controls

- Supabase RLS protects user-owned rows.
- Authenticated API routes validate ownership before writes.
- Sensitive scan-result attempts are rate limited and logged to `security_events`.
- Realtime messages are schema validated, reject unknown payload shapes, and are rate limited.
- CI runs lint, typecheck, unit tests, build, dependency audit, Semgrep, and CodeQL.
- Frontend responses include CSP and common browser hardening headers.
