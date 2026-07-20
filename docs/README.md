# Documentation

Central docs for **Alice** (branded as **Jira Teams**).

| Status        | Meaning                                                       |
| ------------- | ------------------------------------------------------------- |
| **Living**    | Matches current product / engineering practice — keep updated |
| **Plan**      | Design or rollout intent — may not be fully implemented       |
| **Reference** | Stable domain or schema notes                                 |

---

## Start here

| Doc                                          | Audience                             | Status |
| -------------------------------------------- | ------------------------------------ | ------ |
| [product/ARD.md](./product/ARD.md)           | Product / requirements               | Living |
| [architecture/TRD.md](./architecture/TRD.md) | Engineering / architecture           | Living |
| [guides/DATABASE.md](./guides/DATABASE.md)   | Anyone touching schema or migrations | Living |

---

## Map

### Product

Requirements and scope for Jira Teams.

- [ARD.md](./product/ARD.md) — Agile requirements, roles, stories, NFRs

### Architecture

How the monorepo fits together (apps, auth, deployment).

- [TRD.md](./architecture/TRD.md) — technical requirements and system design

### Features

One folder per product area. Prefer a local `README.md` as the index.

| Area       | Index                                          |
| ---------- | ---------------------------------------------- |
| Users      | [features/users/](./features/users/)           |
| Work items | [features/work-items/](./features/work-items/) |
| Board      | [features/board/](./features/board/)           |
| Projects   | [features/projects/](./features/projects/)     |
| Sprints    | [features/sprints/](./features/sprints/)       |
| Dashboard  | [features/dashboard/](./features/dashboard/)   |

### Database

Schema and domain notes (not the migration runbook — that lives under Guides).

- [ER_DIAGRAM.md](./database/ER_DIAGRAM.md) — entity model
- [AUDIT_COLUMNS.md](./database/AUDIT_COLUMNS.md) — audit metadata conventions
- [WORK_ITEM_DESCRIPTION.md](./database/WORK_ITEM_DESCRIPTION.md) — TipTap JSON for descriptions

### Auth

Authentication and authorization. Index: [auth/README.md](./auth/README.md).

- [AUTHENTICATION.md](./auth/AUTHENTICATION.md) — sign up, sign in, Google, linking, admin invite, password reset + sequence diagrams (**Living**)
- [RBAC_AUTHORIZATION_SKELETON.md](./auth/RBAC_AUTHORIZATION_SKELETON.md) — RBAC rollout (**Plan**)
- [FORGOT_PASSWORD_AUTH_PLAN.md](./auth/FORGOT_PASSWORD_AUTH_PLAN.md) — original recovery plan (**Plan**; see AUTHENTICATION.md §7 for as-built)

### Guides

How we work day to day.

- [DATABASE.md](./guides/DATABASE.md) — Prisma / Supabase workflow
- [DEBUGGING.md](./guides/DEBUGGING.md) — IDE debug configs
- [SEO.md](./guides/SEO.md) — metadata, sitemap, robots
- [SONAR.md](./guides/SONAR.md) — SonarQube / SonarCloud
- [INFRASTRUCTURE.md](./guides/INFRASTRUCTURE.md) — infra notes (AWS / Terraform)

---

## Conventions

1. Put **feature** docs under `features/<area>/` with a short README index.
2. Put **how-to** runbooks under `guides/`.
3. Put **schema / domain** notes under `database/`.
4. Label docs as Living, Plan, or Reference near the top when useful.
5. Link to code paths (`apps/web/...`, `packages/db/...`) instead of duplicating large file trees.
6. When a Plan ships, either mark it Living or add a short as-built note under the matching feature folder.
