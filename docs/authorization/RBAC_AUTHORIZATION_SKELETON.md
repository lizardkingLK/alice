# RBAC and Dashboard Authorization Plan (Skeleton)

## Document Metadata

- Project: Alice (Jira Teams)
- Area: Web Authorization (`apps/web`)
- Version: 0.1 (Draft)
- Status: Proposed
- Owner: TBD
- Last Updated: 2026-06-25

## 1. Understood Requirements

This document captures the agreed direction:

- Keep Clerk for authentication only (sign-in/session identity).
- Remove authorization dependency on Clerk role/organization metadata.
- Implement custom RBAC in application-owned data models.
- Add route-level authorization checks to decide whether a signed-in user can access a requested page.
- Add dashboard access checks to block outside users from internal workspace routes.

## 2. Problem Statement

- Current role checks were tied to vendor metadata and increase lock-in.
- Authorization rules must be portable, explicit, and owned by this codebase.
- Access decisions need a single standard pattern for all protected routes.

## 3. Scope

### In Scope

- Custom RBAC model design (users, roles, memberships, grants).
- Authorization guard utilities for Next.js App Router pages/layouts.
- Dashboard gate for outside/internal user classification.
- Audit/logging hooks for denied access events.

### Out of Scope (for initial rollout)

- Fine-grained field-level permissions.
- Multi-tenant billing/entitlement policy engine.
- UI for full admin permission matrix editing.

## 4. Terminology

- **Authenticated User:** Identity verified by Clerk.
- **Authorized User:** Authenticated user allowed by app RBAC policy.
- **Outside User:** Signed-in identity without internal membership permission.
- **Role:** Named permission grouping (example: `admin`, `manager`, `member`).
- **Permission:** Atomic action grant (example: `project.read`, `issue.write`).

## 5. Proposed Architecture (Skeleton)

- Auth source: Clerk user/session ID.
- Authorization source: App database tables.
- Decision point: Shared server-side guard functions used by routes/layouts.
- Enforcement layer:
  - Page-level route guard.
  - API-level guard middleware/service checks.

## 6. Data Model Draft (Skeleton)

## 7. Route Guard Design (Skeleton)

- Shared server-side authorization helpers for App Router pages/layouts.
- Route-level checks for role membership and internal-user dashboard access.
- UI shell uses shared `@repo/ui` primitives (`sidebar`, `breadcrumb`, `separator`, `skeleton`, `card`).

## 8. Dashboard Access Policy (Skeleton)

## 9. Error Handling and UX (Skeleton)

## 10. Security Considerations (Skeleton)

## 11. Rollout Plan (Skeleton)

## 12. Test Plan (Skeleton)

## 13. Open Questions

- Where should source-of-truth RBAC data live first (Supabase table design)?
- Do we need temporary role seeding for local development?
- What is the first minimal permission set needed for dashboard and role routes?

