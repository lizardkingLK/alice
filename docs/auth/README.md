# Auth documentation

Identity and access docs for Alice. Start with the living authentication guide.

| Document                                                           | Description                                                                                       | Status                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [AUTHENTICATION.md](./AUTHENTICATION.md)                           | Sign up, sign in, Google, identity linking, admin invite, password reset — with sequence diagrams | Living                                                        |
| [FORGOT_PASSWORD_AUTH_PLAN.md](./FORGOT_PASSWORD_AUTH_PLAN.md)     | Original password-reset design notes                                                              | Plan (superseded for as-built detail by AUTHENTICATION.md §7) |
| [RBAC_AUTHORIZATION_SKELETON.md](./RBAC_AUTHORIZATION_SKELETON.md) | Phase-1 role route matrix (admin / manager / member)                                              | Implemented                                                   |

Related feature docs:

- [User management](../features/users/) — registry UI, roles, activate/deactivate; allowlist admin tab
- [Account deactivation](../features/users/ACCOUNT_DEACTIVATION.md) — offboarding (admin / self done; webhook planned)
- [Access allowlist](../features/access/) — email domain / email admission gate (**Living**)
