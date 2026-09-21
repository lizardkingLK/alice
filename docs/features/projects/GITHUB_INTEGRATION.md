# GitHub Integration — OAuth 2.1 & Secrets Configuration

**Status:** Implemented (GitHub OAuth 2.1/OIDC with AES-256-GCM encryption-at-rest & JIT refresh)  
**Related:** [Projects README](./README.md), [JIRA_INTEGRATION.md](./JIRA_INTEGRATION.md) (shared crypto and popup UX pattern), work-item PR link/list

---

## Architecture & Model

GitHub integration enables Alice workspaces to link pull requests, commits, and branches to work items, following the same OAuth UX pattern established by the Jira integration.

| Concern | Approach |
| --- | --- |
| **Authentication Flow** | **GitHub OAuth 2.1 / OIDC Authorization Code Flow** with signed HMAC state parameter for CSRF protection |
| **Client Credentials** | Configured via environment variables: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI` |
| **Requested Scopes** | Least privilege: `repo read:user` (or `repo:status read:user`) |
| **Token Storage** | Stored in the `integrations` table (`provider: 'github'`, `category: 'productivity'`). Both `access_token` and `refresh_token` are encrypted at rest with AES-256-GCM (`v1:...`) |
| **Project Binding** | `projects.github_repo` stores the target repository path (`owner/repo`). Pull requests and repository links resolve credentials through the user's active GitHub OAuth integration |
| **Token Refresh** | **Just-In-Time (JIT) refresh**: `getValidAccessToken()` validates expiration with clock skew buffer (60s) and automatically refreshes tokens via GitHub OAuth refresh endpoint before making upstream requests |
| **Client DTO** | Decrypted tokens are **never** returned to the browser or logged. The frontend only receives connection metadata (`GithubConnectionDto`: `id`, `name`, `status`, `account_login`, `account_avatar_url`, `scopes`) |
| **Backward Compatibility** | Legacy project-level encrypted PATs in `projects.github_token` are supported as fallback if no OAuth connection exists for the user |

---

## Environment Configuration

Store client credentials securely in `.env` (never commit secrets or client secrets):

```bash
# GitHub OAuth App Credentials
GITHUB_CLIENT_ID=gh_client_id_xxxxxx
GITHUB_CLIENT_SECRET=gh_client_secret_xxxxxx
GITHUB_REDIRECT_URI=http://localhost:3000/api/github/oauth/callback

# Master Key for Encrypting Tokens at Rest (32-byte Base64)
INTEGRATION_TOKEN_ENCRYPTION_KEY=3q2+7vF9...
```

To generate a new 32-byte base64 encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## OAuth UX Flow (Jira Parity)

1. **Connection Status**:
   - The project form (Step 3: Source Control) and Project Details Integrations card inspect active GitHub connections using `useGithubConnectionPicker()`.
   - If not connected, an amber "Status: Not connected" badge and a **"Connect GitHub"** button are displayed.
2. **Popup Authorization**:
   - Clicking "Connect GitHub" opens a new window/tab synchronously (`about:blank`) to prevent browser popup blockers.
   - The client calls `GET /api/github/oauth/start` to obtain the signed GitHub authorization URL (HMAC-SHA256 signed `state`).
   - The popup navigates to GitHub for user consent.
3. **Callback & Completion**:
   - GitHub redirects to `GET /api/github/oauth/callback?code=...&state=...`.
   - The backend validates the HMAC state signature, exchanges the code for tokens, retrieves the authenticated user's profile (`@login`, avatar, scopes), encrypts the tokens with AES-256-GCM, and upserts the connection into `integrations`.
   - The backend redirects the popup to `/integrations/github/done`, which calls `window.close()`.
4. **Auto-Detection**:
   - The parent form listens to `focus` and `visibilitychange` events and auto-refreshes connection status without manual page reload.
5. **Connected State & Repository Selection**:
   - When connected, the UI displays the authenticated GitHub identity (`@account_login`, avatar, green "Connected" badge).
   - The user can switch accounts or disconnect via the **Disconnect** button (`DELETE /api/github/connections/:id`).
   - A searchable repository dropdown automatically fetches repositories the user has access to (`GET /api/github/repositories`), or accepts manual entry/paste of a repository URL.
   - **No Personal Access Token (PAT) is required or entered.**

---

## Security & Token Encryption

1. **Encryption at Rest**:
   - Tokens are encrypted using AES-256-GCM with a random 12-byte IV and 16-byte authentication tag: `v1:<iv>:<tag>:<ciphertext>`.
   - Implemented in `apps/api/src/lib/secrets/token-crypto.ts`.
2. **Backend-Only Decryption**:
   - Decryption and scope validation take place strictly in `GithubService` and `WorkItemService` within the backend API service layer.
   - Decrypted tokens are never serialized, never sent to the client, and stripped from logging.
3. **Error Handling**:
   - `GithubReauthorizationRequiredError`: Triggered when refresh tokens expire or user revokes consent.
   - `GithubInsufficientScopeError`: Triggered when the granted scopes lack repository access (`repo read:user`).
