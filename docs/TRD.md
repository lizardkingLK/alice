# Technical Requirements Document (TRD)

## Jira Teams — Project Management Platform

**Project:** Alice (Jira Teams)  
**Version:** 1.1  
**Last Updated:** June 23, 2026  
**Status:** In development

## 1. Purpose

This document describes the technical architecture and implementation of Alice (branded as Jira Teams) based on the current codebase. The API is described in `apps/api/package.json` as a Jira clone.

## 2. System Overview

Alice is a pnpm + Turborepo monorepo. The browser loads the Next.js web app (`apps/web`). The web app authenticates users via Clerk and can call the Express API (`apps/api`) using `NEXT_PUBLIC_API_URL`. Application data will be stored in Supabase (PostgreSQL) once integrated.

Both apps deploy to Vercel. The API runs as Vercel Serverless Functions with Clerk middleware on every request.

## 3. Repository Structure

**Root**

- `package.json` — workspace scripts (`dev`, `build`, `lint`, `test`, `commit`, `ui:add`)
- `turbo.json` — Turborepo task configuration
- `pnpm-workspace.yaml` — workspace packages under `apps/*` and `packages/*`
- `tsconfig.json` — root path alias for `@repo/ui/*`
- `.github/workflows/deploy.yml` — CI/CD pipeline
- `.devcontainer/devcontainer.json` — Dev Container for Node.js and TypeScript
- `docs/` — project documentation

**apps/api**

- `src/index.ts` — Express app entry, CORS, JSON parsing, Clerk middleware, route mounting
- `src/server.ts` — port detection for local development
- `src/routes/api/health/index.ts` — health check router
- `src/routes/api/users/index.ts` — users router with protected endpoint
- `src/middlewares/auth/index.ts` — `requireApiAuth` middleware
- `vercel.json` — Vercel serverless routing (all requests to `src/index.ts`)

**apps/web**

- `app/page.tsx` — home page with Clerk auth controls
- `app/layout.tsx` — root layout with `ClerkProvider`
- `app/dashboard/page.tsx` — role-based redirect hub
- `app/admin/page.tsx` — admin-only dashboard
- `app/manager/page.tsx` — manager-only dashboard
- `app/member/page.tsx` — member-only dashboard
- `lib/auth.ts` — `getUserRole()` helper reading Clerk `publicMetadata.role`
- `proxy.ts` — Clerk middleware for Next.js (replaces traditional `middleware.ts`)
- `sample.env` — environment variable template

**packages/ui**

- Shared React components under `src/components/ui/`: Button, Card, Field, Input, Label, Separator
- Utility: `src/lib/utils.ts` (`cn` helper)
- Styles: `src/globals.css` (exported as `@repo/ui/globals.css`)

**packages/eslint-config** — shared ESLint configs  
**packages/typescript-config** — shared TypeScript configs

## 4. Technology Stack

**Monorepo and tooling**

- Turborepo ^2.9
- pnpm 9.0.0
- TypeScript 5.9.x
- Prettier, ESLint 9, Husky, lint-staged, Commitizen, Commitlint

**Frontend (`apps/web`)**

- Next.js 16.2 (App Router)
- React 19.2
- Tailwind CSS 4.3
- `@clerk/nextjs` ^7.5.7
- shadcn/ui components via `@repo/ui`
- Vitest for tests

**Backend (`apps/api`)**

- Express.js 4.19
- `@clerk/express` ^2.1.31
- cors, express.json middleware
- Vitest for tests

**Database**

- Supabase (PostgreSQL) — planned, not yet integrated in source code

**Hosting and CI**

- Vercel (web and api as separate projects)
- GitHub Actions (lint, test, deploy on `main`)

## 5. Authentication — Clerk

### Web app

- `ClerkProvider` wraps the app in `app/layout.tsx`.
- `proxy.ts` exports `clerkMiddleware()` with a matcher for all non-static routes.
- `lib/auth.ts` provides `getUserRole()` which reads `user.publicMetadata.role` from the Clerk user object.

**Environment variables (`apps/web/sample.env`):**

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

### API

- `clerkMiddleware()` is applied globally in `src/index.ts`.
- `requireApiAuth` in `src/middlewares/auth/index.ts` uses `getAuth(req)` from `@clerk/express` and returns 401 if `userId` is missing.

## 6. Role-Based Access

Roles are stored as lowercase strings in Clerk user `publicMetadata.role`:

- `admin` — `/admin`
- `manager` — `/manager`
- `member` — `/member`

**Flow:**

1. User visits `/dashboard`.
2. Server reads `userId` via `auth()`; unauthenticated users redirect to `/`.
3. Server fetches the Clerk user and reads `publicMetadata.role`.
4. User is redirected to `/admin`, `/manager`, or `/member` (defaults to `/member` if role is not admin or manager).

Each role page independently calls `getUserRole()` and redirects to `/` if the role does not match.

## 7. Database — Supabase

Supabase (PostgreSQL) is the intended database for application data. It is referenced in project rules but not yet present in the codebase (no Prisma schema, migrations, or Supabase client).

Planned environment variables:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 8. API

**Conventions**

- Base path: `/api`
- JSON request and response bodies
- CORS enabled globally
- Clerk middleware applied to all requests

**Implemented endpoints**

- `GET /api/health` — public. Returns `{ "status": "ok", "runtime": "express" }`.
- `GET /api/users/api/secure` — protected by `requireApiAuth`. Returns `{ "message": "Welcome to your private dashboard!" }`. Returns 401 with `{ "error": "Unauthorized", "message": "..." }` when unauthenticated.

**Route mounting (`src/index.ts`)**

- `/api/health` → `healthRouter`
- `/api/users` → `usersRouter`

**Local development**

- Default port: 3001 (auto-increments if occupied via `detect-port` in `server.ts`)

**Backend patterns (from project rules, partially applied)**

- Routes are organized in modular routers under `src/routes/api/`.
- Auth middleware is extracted to `src/middlewares/auth/`.
- Planned: service/repository pattern, `catchAsync`, `AppError`, Zod validation.

## 9. Frontend

**Routes**

- `/` — home page ("Jira Teams", "A Jira Clone") with Sign Up, Dashboard buttons and Clerk `SignInButton`, `SignOutButton`, `UserButton`
- `/dashboard` — authenticated role router
- `/admin` — admin dashboard (role guard)
- `/manager` — manager dashboard (role guard)
- `/member` — member dashboard (role guard)

**Shared UI**

Components are imported from `@repo/ui`:

```typescript
import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';
```

**Local development**

- Default port: 3000 (Next.js dev server)

## 10. Deployment

**Vercel projects**

- Web frontend: `apps/web`
- API backend: `apps/api` (Node.js Serverless, configured in `vercel.json`)

**Serverless constraints**

- No WebSockets
- No in-memory storage that must persist between requests
- All durable state must live in Supabase once integrated

**CI/CD (`.github/workflows/deploy.yml`)**

On push and pull request to `main`:

- `pnpm turbo lint`
- `pnpm turbo test`

On push to `main` only (after validation passes):

- Deploy `apps/api` to Vercel
- Deploy `apps/web` to Vercel

**Required GitHub secrets**

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID_API`
- `VERCEL_PROJECT_ID_WEB`

## 11. Development Workflow

**Prerequisites**

- Node.js ≥ 18
- pnpm 9.x
- Clerk application with publishable and secret keys
- Optional: Dev Container (`.devcontainer/devcontainer.json`)

**Commands (run from repository root)**

```bash
pnpm install              # install dependencies
pnpm dev                  # start web and api concurrently
pnpm api dev              # api only
pnpm web dev              # web only
pnpm turbo lint           # lint all packages
pnpm turbo test           # run all tests
pnpm turbo check-types
pnpm turbo build
pnpm ui:add <component>   # add shadcn component to @repo/ui
pnpm commit               # conventional commit (interactive)
```

## 12. Testing

- Vitest is configured in `apps/web`, `apps/api`, and `packages/ui`.
- CI runs `pnpm turbo test` on every push and pull request to `main`.
- The Turborepo `test` task depends on `build`.

## 13. Current Implementation Status

**Implemented**

- Turborepo monorepo with pnpm workspaces
- Clerk authentication on web and API
- Role-based dashboard routing (admin, manager, member)
- Express API with modular routes and auth middleware
- Next.js frontend with home page and role dashboards
- Shared UI package (`@repo/ui`)
- Dev Container configuration
- ESLint, Prettier, Husky, Commitlint, Commitizen
- GitHub Actions CI and Vercel deployment

**Not yet implemented**

- Supabase schema and data access from the API
- Project and issue domain routes and services
- Admin UI for assigning roles (roles are set in Clerk `publicMetadata` manually)
- Zod request validation on API routes
