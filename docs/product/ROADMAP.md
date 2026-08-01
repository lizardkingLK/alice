# Product roadmap

**Status:** Plan  
**Last updated:** August 1, 2026

Future direction for **Jira Teams** beyond the current board, backlog, work items, sprints, and admin surfaces. The in-app **Roadmap** page (`/roadmap`) surfaces this plan for authenticated users.

---

## AI

| Idea                          | Intent                                                                |
| ----------------------------- | --------------------------------------------------------------------- |
| Smart triage                  | Suggest assignee, priority, sprint, and labels from title/description |
| Natural-language backlog      | Queries such as “show blockers in this sprint older than 5 days”      |
| Standup / status digests      | Auto-summarize sprint progress, risks, and stale items                |
| Estimate assist               | Story-point or hour suggestions from similar past work                |
| Duplicate / related detection | Surface near-duplicate or dependent work items                        |
| Writing help                  | Refine acceptance criteria; break epics into subtasks                 |
| Meeting → work                | Turn notes or transcripts into draft issues with links                |

## Integrations

| Idea                  | Intent                                                     |
| --------------------- | ---------------------------------------------------------- |
| SCM (GitHub / GitLab) | Branches, PRs, commits, and deploy status on the work item |
| Chat (Slack / Teams)  | Create issues, sprint reminders, mentions → comments       |
| CI/CD                 | Build/test/deploy badges and failure deep-links            |
| Calendar              | Sprint dates, release windows, PTO vs capacity             |
| Identity (SSO / SCIM) | Enterprise user provisioning under System                  |
| Webhooks + public API | Outbound events and inbound sync for custom tools          |
| Import / export       | Jira / Linear CSV or API migration paths                   |

## Differentiation

Capabilities that go beyond generic “AI + Zapier” overlays:

| Idea                   | Intent                                             |
| ---------------------- | -------------------------------------------------- |
| Capacity & forecasting | Team velocity + leave → sprint load warnings       |
| Dependency graph       | Cross-project blockers with critical path          |
| Goals / OKRs           | Link epics to outcomes, not only tickets           |
| Automation rules       | No-code rules (e.g. Done with no worklog → remind) |
| Audit & compliance     | Change history, retention, export for reviews      |

---

## Near-term priority

Highest leverage next to the current product:

1. **SCM on the work item** — Development section is primed for branches/PRs/builds
2. **Natural-language search / filters** — faster triage without new screens
3. **Slack / Teams notifications** — keep board and backlog in the daily loop

---

## Related

- [ARD.md](./ARD.md) — current requirements and scope
- [TRD.md](../architecture/TRD.md) — technical design
- In-app: `/roadmap` (Help → Roadmap)
