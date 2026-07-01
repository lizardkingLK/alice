# Entity-Relationship Diagram — 1BT-JIRA

## Document metadata

| Field        | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| Project      | Alice (1BT Project Management System / Jira Teams)                 |
| Source       | `1BT-JIRA Task Breakdown with Team Assignments.xlsx` (MVP 1–4)     |
| Status       | Implemented — `init_jira_domain` + `add_audit_metadata` migrations |
| Last updated | 2026-06-25                                                         |

Related:

- `docs/guidelines/DATABASE.md` — migrations and workflow
- `docs/database/AUDIT_COLUMNS.md` — audit column conventions and `@repo/types/audit` helpers
- `docs/features/users/USER_MANAGEMENT.md` — `public.users` (partially implemented)
- `docs/authorization/RBAC_AUTHORIZATION_SKELETON.md` — authorization rollout

---

## Design assumptions

| Topic               | Decision                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Identity            | Supabase `auth.users` for sign-in; `public.users` for app profile and RBAC                 |
| Roles               | `admin`, `manager`, `member` on `users.role` (S-09 seeds roles)                            |
| Backlog             | Not a separate table — `work_items` where `sprint_id IS NULL` (BL-01)                      |
| Sprint assignment   | `work_items.sprint_id`; assign/unassign via backlog and sprint APIs (BL-04, BL-05, SPR-03) |
| Work item hierarchy | Self-referential `parent_id` for Epic → Story → Task (WI-07)                               |
| Rich text           | `work_items.description` stored as JSON document (WI-02)                                   |
| Soft delete         | `projects.deleted_at` for soft delete; hard delete is Admin-only (PROJ-04)                 |
| Audit metadata      | All tables: `created_by`, `created_at`, `updated_by`, `updated_at`; see below              |

---

## ER diagram

```mermaid
erDiagram
    AUTH_USERS ||--|| USERS : "1:1 profile"
    USERS ||--o{ PROJECTS : "owns"
    USERS ||--o{ PROJECT_MEMBERS : "joins"
    PROJECTS ||--o{ PROJECT_MEMBERS : "has"
    USERS ||--o{ TEAMS : "manages"
    USERS ||--o{ TEAM_MEMBERS : "belongs to"
    TEAMS ||--o{ TEAM_MEMBERS : "has"
    PROJECTS ||--o{ SPRINTS : "contains"
    PROJECTS ||--o{ WORK_ITEMS : "contains"
    SPRINTS ||--o{ WORK_ITEMS : "includes"
    WORK_ITEMS ||--o{ WORK_ITEMS : "parent/child"
    USERS ||--o{ WORK_ITEMS : "assigned"
    USERS ||--o{ WORK_ITEMS : "reported"
    WORK_ITEMS ||--o{ COMMENTS : "has"
    USERS ||--o{ COMMENTS : "writes"
    COMMENTS ||--o{ COMMENTS : "replies to"
    WORK_ITEMS ||--o{ ATTACHMENTS : "has"
    USERS ||--o{ ATTACHMENTS : "uploads"
    USERS ||--o{ NOTIFICATIONS : "receives"

    AUTH_USERS {
        uuid id PK
        string email
        timestamptz created_at
    }

    USERS {
        uuid id PK,FK
        string email UK
        string name
        string role "admin|manager|member"
        boolean active
        string status "RecordStatus"
        string profile_picture "nullable"
        uuid created_by FK "nullable"
        timestamptz created_at
        uuid updated_by FK "nullable"
        timestamptz updated_at
    }

    PROJECTS {
        uuid id PK
        string name
        string key UK
        text description
        uuid owner_id FK
        date start_date
        date end_date
        string status "ProjectStatus"
        timestamptz deleted_at "soft delete"
        uuid created_by FK "nullable"
        timestamptz created_at
        uuid updated_by FK "nullable"
        timestamptz updated_at
    }

    PROJECT_MEMBERS {
        uuid project_id PK,FK
        uuid user_id PK,FK
        string status "RecordStatus"
        uuid created_by FK "nullable"
        timestamptz created_at
        uuid updated_by FK "nullable"
        timestamptz updated_at
    }

    TEAMS {
        uuid id PK
        string name
        text description
        uuid manager_id FK
        string tech_stack
        string status "RecordStatus"
        uuid created_by FK "nullable"
        timestamptz created_at
        uuid updated_by FK "nullable"
        timestamptz updated_at
    }

    TEAM_MEMBERS {
        uuid team_id PK,FK
        uuid user_id PK,FK
        string role
        string seniority
        int capacity
        int allocation
        uuid reporting_line FK "nullable"
        string status "RecordStatus"
        uuid created_by FK "nullable"
        timestamptz created_at
        uuid updated_by FK "nullable"
        timestamptz updated_at
    }

    SPRINTS {
        uuid id PK
        uuid project_id FK
        string name
        text goal
        date start_date
        date end_date
        string status "SprintStatus"
        json summary_report "nullable, on close"
        uuid created_by FK "nullable"
        timestamptz created_at
        uuid updated_by FK "nullable"
        timestamptz updated_at
    }

    WORK_ITEMS {
        uuid id PK
        uuid project_id FK
        uuid sprint_id FK "nullable = backlog"
        uuid parent_id FK "nullable, Epic hierarchy"
        string title
        string type "Epic|Story|Task"
        string priority
        json description "rich text JSON"
        uuid assignee_id FK "nullable"
        uuid reporter_id FK "nullable"
        date due_date "nullable"
        int story_points "nullable"
        string status "WorkItemStatus"
        uuid created_by FK "nullable"
        timestamptz created_at
        uuid updated_by FK "nullable"
        timestamptz updated_at
    }

    COMMENTS {
        uuid id PK
        uuid work_item_id FK
        uuid author_id FK
        uuid parent_id FK "nullable, threaded"
        text content
        boolean edited
        string status "RecordStatus"
        uuid created_by FK "nullable"
        timestamptz created_at
        uuid updated_by FK "nullable"
        timestamptz updated_at
    }

    ATTACHMENTS {
        uuid id PK
        uuid work_item_id FK
        uuid uploader_id FK
        string file_name
        string storage_path
        int file_size
        string mime_type
        string status "RecordStatus"
        uuid created_by FK "nullable"
        timestamptz created_at
        uuid updated_by FK "nullable"
        timestamptz updated_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        string type "assign|status|comment|mention|sprint|due_date"
        text message
        uuid related_item_id "work item / project ref"
        boolean read_status
        string status "RecordStatus"
        uuid created_by FK "nullable"
        timestamptz created_at
        uuid updated_by FK "nullable"
        timestamptz updated_at
    }
```

---

## Entity summary

| Entity            | Task references                 | Purpose                                                   |
| ----------------- | ------------------------------- | --------------------------------------------------------- |
| `auth.users`      | A-01, A-02                      | Supabase Auth identity (Google SSO, sessions)             |
| `users`           | S-08, U-01–U-03, A-05, PROF-01  | App profile, RBAC role, active flag                       |
| `projects`        | PROJ-01–PROJ-08                 | Project CRUD, members, soft/hard delete                   |
| `project_members` | PROJ-01, PROJ-02                | Users assigned to a project                               |
| `teams`           | TM-01–TM-06                     | Team CRUD and manager                                     |
| `team_members`    | TM-03–TM-04                     | Member attributes (capacity, seniority, allocation)       |
| `sprints`         | SPR-01–SPR-05                   | Sprint lifecycle, burndown, summary on close              |
| `work_items`      | WI-01–WI-08, WF-01, BL-01–BL-05 | Issues, hierarchy, workflow, backlog                      |
| `comments`        | CMT-01–CMT-05                   | Threaded comments and @mentions                           |
| `attachments`     | ATT-01–ATT-04                   | File uploads on work items                                |
| `notifications`   | NOTIF-01–NOTIF-04               | In-app alerts (assign, status, mention, sprint, due date) |

---

## Relationship overview

```
auth.users ──1:1──► users
users ──M:N──► projects        (via project_members)
users ──M:N──► teams           (via team_members)
projects ──1:N──► sprints
projects ──1:N──► work_items
sprints ──0:N──► work_items    (null sprint_id = backlog)
work_items ──self──► work_items (Epic → Story → Task)
work_items ──1:N──► comments, attachments
users ──1:N──► notifications
```

---

## Implementation status

| Entity                   | In `schema.prisma` today                        |
| ------------------------ | ----------------------------------------------- |
| `instruments`            | Yes — dev baseline with full audit columns      |
| `users`                  | Yes — `init_jira_domain` + `add_audit_metadata` |
| `projects`               | Yes — `init_jira_domain` + `add_audit_metadata` |
| `teams`, `sprints`, etc. | Yes — `init_jira_domain` + `add_audit_metadata` |

When implementing, add tables via `packages/db/prisma/schema.prisma` and `pnpm db create:migrate:win <name>`. Each migration appends Supabase grants automatically (see `docs/guidelines/DATABASE.md`).

---

## Audit metadata

Every table includes:

| Column       | Type        | Notes                                        |
| ------------ | ----------- | -------------------------------------------- |
| `created_by` | UUID FK     | Nullable → `users.id`, `ON DELETE SET NULL`  |
| `created_at` | timestamptz | Defaults to `now()`                          |
| `updated_by` | UUID FK     | Nullable → `users.id`, `ON DELETE SET NULL`  |
| `updated_at` | timestamptz | Set on write via `@repo/types/audit` helpers |

Full reference: [`AUDIT_COLUMNS.md`](./AUDIT_COLUMNS.md).

---

## Open questions

- Should `teams` link to `projects`, or remain org-wide?
- Store sprint summary as JSON on `sprints`, or a separate `sprint_reports` table?
- Should `notifications.related_item_id` use a polymorphic `(entity_type, entity_id)` pair?
- Add `user_activity` / audit log table for PROF-04, or derive from existing `created_by` / `updated_by` columns?
