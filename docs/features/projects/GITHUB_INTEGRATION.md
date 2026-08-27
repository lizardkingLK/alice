# GitHub integration — secrets & configuration

**Status:** Implemented (encrypt-at-rest + write-only client contract)  
**Related:** [Projects README](./README.md), [JIRA_INTEGRATION.md](./JIRA_INTEGRATION.md) (shared crypto), work-item PR link/list

## Model

| Concern            | Approach                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Credentials        | **Per-project** Personal Access Token (PAT) + `owner/repo`, configured in project create/edit / Integrations          |
| Shared product env | **None** — Alice does not use `GITHUB_TOKEN` / similar for product GitHub API calls (CI Actions tokens are unrelated) |
| Storage            | `projects.github_token` ciphertext; `projects.github_repo` plaintext                                                  |
| Client DTO         | Token **never** returned; `has_github_token: boolean` only                                                            |
| Usage              | API decrypts in-process when calling `api.github.com` for PR list/link                                                |

## What is a “32-byte base64” key?

AES-256 needs a **raw secret that is exactly 32 bytes** (256 bits) of random data.

We do **not** put those 32 raw bytes into `.env` as binary. Instead we **Base64-encode** them into a printable ASCII string and store that as `INTEGRATION_TOKEN_ENCRYPTION_KEY`.

| Term      | Meaning                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------- |
| 32 bytes  | Length of the **decoded** key material (required by AES-256)                                    |
| Base64    | Encoding that turns binary into text safe for env files (e.g. `k8x…==`)                         |
| Env value | The Base64 **string**; at runtime Alice `Buffer.from(env, 'base64')` and checks `length === 32` |

Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Example shape (do not reuse): `3q2+7vF9…` ≈ 44 characters of Base64 for 32 random bytes.

The same env key is used to:

1. **Encrypt/decrypt** GitHub PATs and Jira OAuth tokens (`token-crypto.ts`)
2. **HMAC-sign** Atlassian OAuth `state` (`resolveIntegrationEncryptionKey` → Jira 3LO CSRF binding)

Never expose this key as `NEXT_PUBLIC_*`.

## Encryption (how it works)

1. On **create/update**, if the client sends a new PAT, the API runs `encryptSecret(plaintext)`:
   - Random 12-byte IV
   - AES-256-GCM ciphertext + 16-byte auth tag
   - Store as `v1:` + base64(`iv ‖ tag ‖ ciphertext`) in `projects.github_token`
2. On **GitHub API** use (PR list/link), `decryptSecret` restores plaintext **only in the API process**, builds `Authorization: token …`, then discards it.
3. Legacy plaintext rows (no `v1:` prefix) decrypt as passthrough (lazy migration); the next write encrypts them.

Helper: `apps/api/src/lib/secrets/token-crypto.ts`  
Key resolver (shared with Jira HMAC): `resolveIntegrationEncryptionKey()`.

## Write-only client contract

| Client action               | `github_token` payload                                          |
| --------------------------- | --------------------------------------------------------------- |
| Create with PAT             | Non-empty string → encrypt & store                              |
| Create without PAT          | `null`                                                          |
| Edit, leave PAT field blank | **Omit** field (or empty string) → leave stored value unchanged |
| Edit, enter new PAT         | Non-empty string → encrypt & replace                            |
| Disable GitHub / clear repo | `github_token: null` → clear                                    |

UI must not prefill the real token. Show a mask when `has_github_token` is true.

Shared form fields: `apps/web/app/projects/_components/github-repo-fields.tsx` (create Source Control step + details Integrations).

## API / SSR secret stripping (how it works)

| Layer                     | Helper                                                                                | Behavior                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| API JSON responses        | `withoutIntegrationSecrets` from `@repo/types` (re-exported by `projects.repository`) | Deletes `github_token`, adds `has_github_token`                                                   |
| Web RSC / list / dropdown | `apps/web/lib/projects/sanitize-project-secrets.ts` → same `@repo/types` helper       | Same mapping for Supabase `select('*')` paths (`projects.service.server.ts`, `dropdown-cache.ts`) |

Browsers and RSC payloads therefore never see ciphertext or plaintext PATs—only a boolean.

## Follow-ups

- Envelope encryption / KMS
- Optional GitHub App installation (OAuth) instead of per-project PATs
