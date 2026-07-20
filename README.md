# Jira Teams

A cost-effective, feature-rich Jira alternative for planning and delivering software work.

Jira Teams helps teams manage projects, sprints, boards, backlogs, and work items in one place — with auth, files, dashboards, and shared UI primitives built for a real product workflow.

---

## Overview

This repository is an **Alice** monorepo that powers **Jira Teams**. It is organized as:

| Area     | Path                                                   | Role                                                                              |
| -------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Web app  | `apps/web`                                             | Next.js frontend (dashboard, board, backlog, work items, projects, auth, profile) |
| API      | `apps/api`                                             | Express.js TypeScript backend (REST, auth-aware routes, file uploads)             |
| UI kit   | `packages/ui`                                          | Shared shadcn/ui components and theme tokens                                      |
| Database | `packages/db`                                          | Prisma / Supabase migrations, seeds, and type generation                          |
| Types    | `packages/types`                                       | Shared TypeScript types (including generated DB types)                            |
| Tooling  | `packages/eslint-config`, `packages/typescript-config` | Shared lint and TS configs                                                        |

**Build system:** Turborepo + pnpm workspaces  
**Commits:** Conventional Commits (Commitizen / Commitlint + Husky)

### Product surfaces (web)

- **Dashboard** — customizable overview widgets (drag / resize)
- **Board** — kanban swimlanes backed by work-item status updates
- **Backlog** — sprint planning and unassigned work
- **Work items** — list, detail, rich description editor, inline title edit
- **Projects, sprints, users, files, profile** — supporting product areas
- **Auth** — sign in / sign up, password recovery, session handling

---

## Documentation

Project docs live under [`./docs`](./docs). Start with [`docs/README.md`](./docs/README.md).

- Product & architecture: `docs/product/ARD.md`, `docs/architecture/TRD.md`
- Database: `docs/database/`, `docs/guides/DATABASE.md`
- Features & auth: `docs/features/`, `docs/auth/`
- Guides (SEO, Sonar, infra, debugging): `docs/guides/`

---

## Requirements

- **Node.js** `>= 18`
- **pnpm** `9.x` (see `packageManager` in root `package.json`)

---

## First-time setup

### Install dependencies

```bash
pnpm install
```

Configure environment variables for `apps/web`, `apps/api`, and `packages/db` as needed (Supabase / API URLs, secrets). See `docs/guides/INFRASTRUCTURE.md` and `docs/guides/DATABASE.md` for deeper setup notes.

---

## Development

### Run everything

```bash
pnpm dev
```

### Run apps individually

```bash
# API (Express)
pnpm api dev

# Web (Next.js)
pnpm web dev
```

### Shared UI components

Scaffold shadcn components into `@repo/ui`:

```bash
pnpm ui:add <component_1> <component_2>
```

Example:

```bash
pnpm ui:add button dialog sonner
```

---

## Quality & build

### Format

```bash
pnpm format
```

### Typecheck

```bash
pnpm checktypes
```

### Lint

```bash
pnpm lint
```

### Build

```bash
pnpm build
```

Or build a single package / app with filters:

```bash
pnpm web build
pnpm api build
```

### Tests

```bash
pnpm test
```

Web e2e (Cypress):

```bash
pnpm test:e2e
pnpm cypress:open
```

---

## Commits

Use the interactive Commitizen flow (Conventional Commits):

```bash
pnpm commit
```

Husky + lint-staged run on commit to keep apps and packages lint-clean.

---

## Repository layout

```text
alice/
├── apps/
│   ├── web/          # Next.js app
│   └── api/          # Express API
├── packages/
│   ├── ui/           # @repo/ui (shadcn)
│   ├── db/           # @repo/db (Prisma / Supabase)
│   ├── types/        # @repo/types
│   ├── eslint-config/
│   └── typescript-config/
├── docs/             # Product & engineering documentation
└── package.json      # Workspace scripts (turbo, pnpm filters)
```

---

## Useful filters

```bash
pnpm web <script>     # e.g. pnpm web lint
pnpm api <script>
pnpm ui <script>
pnpm db <script>      # migrations, generate, seed
pnpm types <script>
```
