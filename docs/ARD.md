# Agile Requirements Document (ARD)

## Jira Teams — Project Management Platform

**Project:** Alice (Jira Teams)  
**Version:** 1.2  
**Last Updated:** June 30, 2026  
**Status:** In development

## 1. Executive Summary

Jira Teams is a Jira-inspired project management application described in the README as a cost-effective alternative to Jira. Teams will use it to organize work into projects and track issues such as tasks, bugs, and stories.

The project is a Turborepo monorepo with a Next.js frontend (`apps/web`), an Express API backend (`apps/api`), and a shared UI package (`packages/ui`). Authentication is handled by Clerk. Supabase (PostgreSQL) is the planned database for application data.

## 2. Product Vision

**Vision:** Give teams a simple way to plan, track, and deliver software work.

**Goals:**

- Authenticated users can sign in and access role-based dashboards.
- Role-based access controls who can view admin, manager, and member areas.
- A responsive web UI built with shared components from `@repo/ui`.
- Automated lint, test, and deployment pipelines on merge to `main`.

## 3. Current Scope

**Implemented**

- Monorepo setup with Turborepo and pnpm workspaces.
- Clerk authentication on the web app (`ClerkProvider`, `proxy.ts` middleware).
- Clerk authentication on the API (`clerkMiddleware`, `requireApiAuth` middleware).
- Home page at `/` with "Jira Teams" branding and Clerk sign-in, sign-out, and user controls.
- Role-based dashboard routing:
  - `/dashboard` — reads the user's Clerk `publicMetadata.role` and redirects to the correct dashboard.
  - `/admin` — accessible only when role is `admin`.
  - `/manager` — accessible only when role is `manager`.
  - `/member` — accessible only when role is `member`.
- Express API with modular route structure under `src/routes/api/`.
- `GET /api/health` — public health check.
- `GET /api/users/api/secure` — protected endpoint requiring a valid Clerk token.
- Shared UI components: Button, Card, Field, Input, Label, Separator.
- GitHub Actions workflow for lint, test, and Vercel deployment.
- Conventional Commits enforced via Husky, Commitlint, and Commitizen.
- Dev Container configuration (`.devcontainer/devcontainer.json`).
- Root script `pnpm ui:add` for adding shadcn components to `@repo/ui`.
- Public marketing pages at `/about` and `/contact`.
- SEO foundation: site metadata, `robots.txt`, `sitemap.xml`, favicon/OG assets, and crawler exclusion for `/dashboard`.

**Not yet implemented**

- Supabase database schema, migrations, and API data access.
- Project and issue CRUD.
- Persistent role assignment UI (roles are read from Clerk `publicMetadata.role`).

## 4. User Roles

Roles are stored in Clerk user `publicMetadata.role`:

- **admin** — Access to `/admin` dashboard. Full administrative access (intended).
- **manager** — Access to `/manager` dashboard. Project management access (intended).
- **member** — Access to `/member` dashboard. Standard team member access (intended).

Users without a matching role are redirected to `/` when visiting a role-specific page.

## 5. User Stories

### Authentication

- **AUTH-1:** As a user, I want to sign in so that I can access my workspace.
  - Clerk `SignInButton` and `UserButton` are available on the home page.
  - Status: Done.

- **AUTH-2:** As a signed-in user, I want to be routed to the correct dashboard based on my role.
  - `/dashboard` redirects to `/admin`, `/manager`, or `/member` based on `publicMetadata.role`.
  - Status: Done.

- **AUTH-3:** As a user, I want role-specific pages to block unauthorized access.
  - Each role page checks the user's role and redirects to `/` if it does not match.
  - Status: Done.

- **AUTH-4:** As a client, I want to call protected API endpoints with my auth token.
  - `GET /api/users/api/secure` returns a welcome message when a valid Clerk token is provided.
  - Returns 401 when unauthenticated.
  - Status: Done.

### Platform

- **OPS-1:** As a developer, I want a health-check endpoint so that deployments can be verified.
  - `GET /api/health` returns `{ "status": "ok", "runtime": "express" }`.
  - Status: Done.

- **OPS-2:** As a developer, I want lint and test gates in CI so that broken code is not merged.
  - GitHub Actions runs `pnpm turbo lint` and `pnpm turbo test` on push and pull requests to `main`.
  - Status: Done.

- **OPS-3:** As a developer, I want automated deployment to Vercel on merge to `main`.
  - Separate Vercel projects for `apps/api` and `apps/web`.
  - Status: Done.

- **OPS-4:** As a product owner, I want public pages discoverable by search engines while authenticated areas stay private.
  - `sitemap.xml` lists public routes (`/`, `/about`, `/contact`, `/login`, `/signup`).
  - `robots.txt` disallows protected paths; forbidden routes use `noindex` page metadata.
  - Status: Done.

### Planned (not yet in codebase)

- **PROJ-1:** As a project manager, I want to create a project so that work is grouped.
- **ISSUE-1:** As a team member, I want to create an issue with title, description, type, and priority so that work is tracked.
- **ISSUE-2:** As a team member, I want to update issue status so that progress is visible.

## 6. Functional Requirements

- **FR-1:** The system shall authenticate users via Clerk on both the web app and API.
- **FR-2:** The system shall route authenticated users to role-based dashboards (`admin`, `manager`, `member`).
- **FR-3:** The system shall store application data in Supabase (PostgreSQL) once implemented.
- **FR-4:** The system shall expose a REST API from `apps/api` consumed by the Next.js frontend.
- **FR-5:** The system shall provide a web UI at `apps/web` using shared `@repo/ui` components.
- **FR-6:** The API shall expose a public health check at `GET /api/health`.
- **FR-7:** The API shall protect endpoints using `requireApiAuth` middleware.

## 7. Non-Functional Requirements

- **NFR-1:** TypeScript is used across all packages with strict typing.
- **NFR-2:** ESLint runs on CI via `pnpm turbo lint`.
- **NFR-3:** Tests run on CI via `pnpm turbo test`.
- **NFR-4:** Secrets are stored in environment variables, not in source control.
- **NFR-5:** The API is deployed as Vercel Serverless Functions (stateless; no in-memory persistence).
- **NFR-6:** Commits follow Conventional Commits via `pnpm commit`.
- **NFR-7:** Public marketing and entry pages shall be indexable by search engines; authenticated dashboards, role-specific areas, and internal utilities shall not appear in search results (enforced via `robots.txt`, `sitemap.xml` curation, and per-route `noindex` metadata — see `docs/guidelines/SEO.md`).

## 8. Assumptions & Dependencies

- **Authentication:** Clerk (`@clerk/nextjs` on web, `@clerk/express` on API)
- **Database:** Supabase (PostgreSQL) — planned, not yet integrated
- **Hosting:** Vercel (separate projects for `web` and `api`)
- **Package manager:** pnpm 9.x
- **Node.js:** ≥ 18 (CI uses Node 20)
- **Build system:** Turborepo
- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **Backend:** Express.js 4

## 9. Definition of Done

A story is done when:

1. Acceptance criteria are met.
2. UI uses shared components from `@repo/ui` where applicable.
3. Protected API routes use `requireApiAuth` where required.
4. Role pages enforce access via `getUserRole()` from `apps/web/lib/auth.ts`.
5. `pnpm turbo lint` and `pnpm turbo test` pass.
6. Changes are committed with Conventional Commits (`pnpm commit`).
7. CI passes and deploys successfully on merge to `main`.
