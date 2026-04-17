# SwiftColis — Agent Instructions

## Stack
Next.js 15 + Prisma + PostgreSQL + next-auth + next-intl (i18n) + Tailwind + Stripe.
Deployed on Vercel. CI on GitHub Actions.

## General Constraints (all agents)
- DO NOT push automatically after commits. Always stop after `git commit` and wait for explicit user approval before pushing.
- DO NOT disable ESLint, TypeScript, or React rules unless the user explicitly requests it and accepts the tradeoff.
- DO NOT run destructive git commands (`git reset --hard`, `git checkout --`, `git push --force`, `git clean -fd`) without explicit user confirmation.
- DO NOT delete files or drop database tables without explicit confirmation.
- PREFER minimal, reversible changes over broad refactors.

## Build & Install
- `postinstall` must always be `node scripts/prisma-generate.mjs` — never bare `prisma generate`.
- `build` script must include `node scripts/ensure-proxy-only.mjs && node scripts/prisma-generate.mjs && next build`.
- `npm ci` for CI environments, `npm install` for local dev.
- Vercel env vars: `POSTGRES_PRISMA_URL` → `DATABASE_URL`, `POSTGRES_URL_NON_POOLING` → `DIRECT_DATABASE_URL`.

## Windows Specifics
- Use `[System.IO.File]::WriteAllText(..., UTF8Encoding(false))` when writing JSON/config files from PowerShell to avoid BOM.
- EPERM on `.node` binaries is caused by VS Code holding SWC/Prisma/Parcel watchers — close VS Code or use a separate terminal session.
- WSL2 requires BIOS virtualization (Intel VT-x / AMD SVM) to be enabled.

## Code Conventions
- Prisma: standard mode (`postgresql://`), migrations via `prisma migrate dev`.
- Auth: next-auth v5, RBAC via `src/lib/rbac.ts`.
- i18n: next-intl, locale in route prefix `[locale]`.
- API routes: always validate with Zod or `src/lib/validators.ts` at the boundary.
- Never expose raw Prisma errors or stack traces to the client.
