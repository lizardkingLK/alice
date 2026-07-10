# Agile Requirements Document (ARD)

## Jira Teams — Project Management Platform

**Project:** Alice (Jira Teams)  
**Version:** 1.4  
**Last Updated:** July 9, 2026  
**Status:** In development

## 1. Executive Summary

Jira Teams is a Jira-inspired project management application described in the README as a cost-effective alternative to Jira. Teams will use it to organize work into projects and track issues such as tasks, bugs, and stories.

The project is a Turborepo monorepo with a Next.js frontend (`apps/web`), an Express API backend (`apps/api`), and a shared UI package (`packages/ui`). Authentication is handled by Supabase Auth. Supabase (PostgreSQL) is the database for application data.

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
- Supabase Auth integration on the web app (SSR clients, session cookies, middleware session refresh, and auth actions).
- Supabase Auth on the API (`requireApiAuth` middleware validating Bearer access tokens).
- Home page at `/` with "Jira Teams" branding and email/password authentication (sign-in, sign-up, sign-out).
- Dashboard workspace shell (`/dashboard`) showing user activity overview.
- Sprints management workspace (`/sprints`) supporting active/archived sprint lists, creation, and status transitions.
- Project administration registry (`/projects`) supporting list, creation, editing, soft delete, restore, and hard delete.
- Custom Attributes management page (`/attributes`) to list custom field configuration schemas.
- User registry list and administration panel (`/users`) with admin-only user invite (via Supabase Auth emails) and active/deactivate controls.
- Global client-side and server-side pagination component and routing hooks.
- Express API with modular route structure under `src/routes/api/` (supporting health, users, notifications, files, projects, sprints, and attributes).
- `GET /api/health` — public health check.
- Shared UI components: Button, Card, Field, Input, Label, Separator.
- GitHub Actions workflow for lint, test, and Vercel deployment.
- Conventional Commits enforced via Husky, Commitlint, and Commitizen.
- Dev Container configuration (`.devcontainer/devcontainer.json`).
- Root script `pnpm ui:add` for adding shadcn components to `@repo/ui`.
- Public marketing pages at `/about` and `/contact`.
- SEO foundation: site metadata, `robots.txt`, `sitemap.xml`, favicon/OG assets, and crawler exclusion policy (metadata `noindex` and `robots.txt` disallow).

**Not yet implemented**

- Work item (issue) CRUD (backlog, creating work items, boards, assigning items, updating status, comments, attachments).
- Centralized custom database RBAC page-level enforcement helpers (e.g. `requireAdmin()` / `requireRole()`).

## 4. User Roles

Roles are stored in the application database `public.users` table:

- **admin** — Full administrative access, user creation/invite, active/deactivate controls, project mutations.
- **manager** — Access to `/manager` dashboard. Project management access (intended).
- **member** — Access to `/member` dashboard. Standard team member access (intended).

Users without a matching role are redirected to `/` when visiting a role-specific page.

## 5. User Stories

### Authentication

- **AUTH-1:** As a user, I want to sign in with email and password so that I can access my workspace.
  - Supabase Auth input fields and actions are available on the `/login` page.
  - Status: Done.

- **AUTH-2:** As an administrator, I want to invite team members via email.
  - Invitation is sent via Supabase Auth email from the `/users` dashboard.
  - Status: Done.

- **AUTH-3:** As a client, I want to call protected API endpoints with my JWT access token.
  - Endpoints validated via `requireApiAuth` middleware. Returns 401 when unauthenticated.
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

### Project & Sprints Administration

- **PROJ-1:** As a manager, I want to create, view, edit, and delete projects so that work is grouped.
  - Paginated `/projects` administration registry with Zod validation and soft/hard delete.
  - Status: Done.

- **SPR-1:** As a team member, I want to view active and archived sprints and manage status transitions.
  - Paginated `/sprints` list supporting status changes (planned, active, closed, archived).
  - Status: Done.

### Planned (not yet in codebase)

- **ISSUE-1:** As a team member, I want to create an issue with title, description, type, and priority so that work is tracked.
- **ISSUE-2:** As a team member, I want to update issue status so that progress is visible.

## 6. Functional Requirements

- **FR-1:** The system shall authenticate users via Supabase Auth on both the web app and API.
- **FR-2:** The system shall store application data in Supabase (PostgreSQL) using Prisma migrations.
- **FR-3:** The system shall expose a REST API from `apps/api` consumed by the Next.js frontend.
- **FR-4:** The system shall provide a web UI at `apps/web` using shared `@repo/ui` components.
- **FR-5:** The API shall expose a public health check at `GET /api/health`.
- **FR-6:** The API shall protect endpoints using `requireApiAuth` middleware validating Supabase access tokens.

## 7. Non-Functional Requirements

- **NFR-1:** TypeScript is used across all packages with strict typing.
- **NFR-2:** ESLint runs on CI via `pnpm turbo lint`.
- **NFR-3:** Tests run on CI via `pnpm turbo test`.
- **NFR-4:** Secrets are stored in environment variables, not in source control.
- **NFR-5:** The API is deployed as Vercel Serverless Functions (stateless; no in-memory persistence).
- **NFR-6:** Commits follow Conventional Commits via `pnpm commit`.
- **NFR-7:** Public marketing and entry pages shall be indexable by search engines; authenticated dashboards, role-specific areas, and internal utilities shall not appear in search results (enforced via `robots.txt`, `sitemap.xml` curation, and per-route `noindex` metadata — see `docs/guidelines/SEO.md`).

## 8. Assumptions & Dependencies

- **Authentication:** Supabase Auth (`@supabase/ssr` on web, `@supabase/supabase-js` on API)
- **Database:** Supabase (PostgreSQL) and Prisma ORM (migrations/seeding)
- **Hosting:** Vercel (separate projects for `web` and `api`)
- **Package manager:** pnpm 9.x
- **Node.js:** ≥ 18 (CI uses Node 20)
- **Build system:** Turborepo
- **Frontend:** Next.js 16.2, React 19.2, Tailwind CSS 4.3
- **Backend:** Express.js 4.22

## 9. Definition of Done

A story is done when:

1. Acceptance criteria are met.
2. UI uses shared components from `@repo/ui` where applicable.
3. Protected API routes use `requireApiAuth` where required.
4. Role pages enforce access via `getUserRole()` from [auth.ts](file:///c:/Users/Aux-219/Documents/Jira_Repo_Recent/alice/apps/web/lib/auth.ts).
5. `pnpm turbo lint` and `pnpm turbo test` pass.
6. Changes are committed with Conventional Commits (`pnpm commit`).
7. CI passes and deploys successfully on merge to `main`.
