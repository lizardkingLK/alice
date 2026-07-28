# Access feature documentation

Admission control: who may use the app (before RBAC roles apply).

| Document                                     | Description                                                         | Status |
| -------------------------------------------- | ------------------------------------------------------------------- | ------ |
| [ACCESS_ALLOWLIST.md](./ACCESS_ALLOWLIST.md) | Email domain + exact-email allowlist, denied page, footer, admin UI | Living |

Related:

- [AUTHENTICATION.md](../../auth/AUTHENTICATION.md)
- [RBAC plan](../../auth/RBAC_AUTHORIZATION_SKELETON.md)
- [User management](../users/) — allowlist admin UI lives under `/users?tab=allowlist`
- Testing guide: [TESTING_DEVELOPMENT_FLOW.md](../../guides/TESTING_DEVELOPMENT_FLOW.md)

## Unit tests (Vitest)

P0 coverage for the admission gate and admin form lives under `apps/web/tests/access/`:

| Spec                                 | Focus                                                 |
| ------------------------------------ | ----------------------------------------------------- |
| `access-allowlist.test.ts`           | Pure helpers (`isPublicAccessPath`, normalize/expiry) |
| `access-allowlist-gate.test.ts`      | `isEmailAllowed` with mocked admin client             |
| `access-allowlist-schema.test.ts`    | Shared Zod domain/email create schemas                |
| `accessAllowlist.service.test.ts`    | Web CRUD service factory (search + pagination)        |
| `access-allowlist-form.test.tsx`     | Admin create/edit form + Zod alerts                   |
| `access-allowlist-registry.test.tsx` | Debounced search, pagination, delete                  |
| `home-footer.test.tsx`               | Footer app-link gating                                |
| `contact-request-schema.test.ts`     | Contact request Zod schema                            |

Factory / mocks:

- `apps/web/tests/factories/accessAllowlist.factory.ts`
- `apps/web/tests/mocks/supabase-admin.ts`
