# Browse projects

Open the project registry and jump into a project workspace.

**Audience:** All users (Members, Managers, and Admins)

---

## Open the registry

1. Sign in to your account.
2. In the sidebar, select **Projects**.

You'll land on the project list (`/projects`).

---

## What you see

The list shows projects you can access:

| Your role   | Projects shown                                            |
| ----------- | --------------------------------------------------------- |
| **Admin**   | All projects in the workspace                             |
| **Manager** | Projects you **own** or are an active **member** of       |
| **Member**  | Projects you are an active **member** of (or allowlisted) |

Projects you can't access are **hidden** from the list (not shown as locked
rows).

Use search and pagination when the registry is large.

---

## Open a project

1. Select a project from the list.
2. You'll open the project workspace at `/projects/{KEY}` (for example
   `/projects/ABC`) with overview cards and a sidebar for **Details**,
   **Members**, **Teams**, **Work items**, **Sprints**, and settings tabs.
3. On **Details**, use the **Board**, **Backlog**, and **My Work** cards to
   open those workspaces in a **new browser tab** (they use their own layout,
   so opening them in-place would leave the project shell).

In-project surfaces use the same key in the path, for example:

| Area             | Path                                                    |
| ---------------- | ------------------------------------------------------- |
| Board            | `/projects/ABC/board` (Details card → new tab)          |
| Backlog          | `/projects/ABC/backlog` (Details card → new tab)        |
| My Work          | `/projects/ABC/member` (Details card → new tab)         |
| Work items       | `/projects/ABC?tab=work-items` (stays in project shell) |
| Work item detail | `/projects/ABC/work-items/{slug}`                       |
| Sprints          | `/projects/ABC?tab=sprints` (stays in project shell)    |
| Sprint summary   | `/projects/ABC/sprints/{slug}/summary-report`           |

If you're not a member and not an admin, the workspace shows **No access to
this project** — ask the owner to add you via
[Project members](./project-members.md).

---

## Share a project link

Each project has a short key (for example `ABC`). You can share:

`/projects/ABC`

1. Open the project and stay on **Details**.
2. Next to the key badge, select the copy icon to copy the full share URL.
3. Anyone who opens that link signs in first (if needed), then lands on the
   same key URL in the address bar.

Older UUID-style links still work and redirect to the project key URL. Sprint
and work-item UUID detail links redirect into the slug form under the project
tree when possible.

---

## Empty list?

- **Create** a new project if your role allows it, or
- Ask an admin or project owner to add you as a member.

---

## Related

- [Role-based project & chat access](./project-registry-and-chat-access.md)
- [Project members](./project-members.md)
- [Users & access](../users-and-access/README.md)
