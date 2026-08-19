# Xolt

A patient/doctor healthcare platform: a Patient App and a Doctor App (Expo + React
Native), an internal Admin dashboard (Next.js), and a Supabase (Postgres) backend.
Core rule: the patient owns their medical data — a doctor only gets access after
the patient explicitly grants it, enforced at the database level via RLS.

## Repo structure

This is a pnpm workspace monorepo.

```
apps/
  patient/       Expo app (TypeScript, Expo Router) — the Patient App
  doctor/        Expo app (TypeScript, Expo Router) — the Doctor App
  admin/         Next.js app (TypeScript, App Router) — internal admin dashboard
packages/
  shared/        @xolt/shared — cross-app TypeScript (types, API clients, utils)
  ui-tokens/     @xolt/ui-tokens — design tokens shared by all three apps' UI
supabase/
  schema.sql     Consolidated schema snapshot
  migrations/    Timestamped SQL migrations (source of truth for schema changes)
  functions/     Supabase Edge Functions
```

`packages/*` are plain TypeScript packages with no build step — each app's
bundler (Metro for the Expo apps, Next's compiler for admin) compiles the
package's TS source directly, so editing a file in `packages/shared/src` is
immediately visible to every app that imports `@xolt/shared`.

### How the workspace linking works

- Root `pnpm-workspace.yaml` declares `apps/*` and `packages/*` as workspace
  packages; each app depends on `@xolt/shared`/`@xolt/ui-tokens` via
  `workspace:*`.
- Root `.npmrc` sets `node-linker=hoisted` so `node_modules` is laid out flat
  (npm/yarn-classic style). This matters specifically for the Expo apps —
  Metro's module resolution is unreliable with pnpm's default symlinked
  `node_modules`, so hoisting avoids that class of bug entirely.
- Each Expo app also has a `metro.config.js` that watches the whole monorepo
  and resolves modules from both its own and the workspace root's
  `node_modules`, so changes inside `packages/*` trigger a Metro refresh.
- `apps/admin/next.config.ts` lists `@xolt/shared` and `@xolt/ui-tokens` under
  `transpilePackages` so Next's compiler processes their TS source directly.
- Every app's `tsconfig.json` maps `@xolt/shared` / `@xolt/ui-tokens` to the
  packages' `src/` directories for editor/type-check resolution.

## Getting started

```bash
pnpm install
```

Run any app from the repo root with pnpm's `--filter`:

```bash
pnpm --filter patient start   # Expo dev server for the Patient App
pnpm --filter doctor start    # Expo dev server for the Doctor App
pnpm --filter admin dev       # Next.js dev server for the Admin dashboard
```

Lint and format the whole workspace from the root:

```bash
pnpm lint
pnpm format
```

## Backend

The Supabase schema lives in `supabase/migrations/` (one SQL file per
migration — that's the source of truth) with `supabase/schema.sql` as a
consolidated snapshot. `supabase/functions/` holds Edge Functions. There's no
Supabase CLI/Docker available in every dev environment, so always confirm
migrations against a real database before assuming they're correct.
