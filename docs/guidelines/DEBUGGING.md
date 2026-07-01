# Debugging

Cursor uses the same debugger as VS Code. Configurations live in `.vscode/launch.json`.

## Quick start

1. Open **Run and Debug** (`Ctrl+Shift+D` / `Cmd+Shift+D`).
2. Pick a configuration from the dropdown.
3. Press **F5** and set breakpoints in source.

## Available configurations

| Configuration                 | Debug target                                                   |
| ----------------------------- | -------------------------------------------------------------- |
| **Web: Next.js (server)**     | RSC, Server Actions, route handlers, `lib/supabase/server.ts`  |
| **Web: Next.js (client)**     | Client components (`'use client'`) via Chrome                  |
| **Web: Next.js (full stack)** | Server + auto-opens Chrome when dev server is ready            |
| **API: Express**              | Express routes, middleware, services (`apps/api`)              |
| **API: attach**               | Attach to a Node process started with `--inspect` on port 9229 |
| **DB: seed**                  | `packages/db/src/seed.ts`                                      |
| **Full stack: Web + API**     | Runs web and API debuggers together                            |

## Per-app requirements

Each configuration sets its own `cwd` and `envFile`:

| App     | Working directory | Env file           |
| ------- | ----------------- | ------------------ |
| Web     | `apps/web`        | `apps/web/.env`    |
| API     | `apps/api`        | `apps/api/.env`    |
| DB seed | `packages/db`     | `packages/db/.env` |

## Monorepo notes

- Debug **individual apps**, not `pnpm dev` at the root — Turbo runs multiple processes and attach points get messy.
- Shared package breakpoints (`@repo/ui`, `@repo/types`) work when `resolveSourceMapLocations` includes the workspace root (already set for API).
- **Server vs client in Next.js:** use the server config for RSC/Server Actions; use the client config (or full stack) for browser-side React.

## Vitest (planned)

Vitest debug configs are **not** added yet. Add them after each package has a `vitest.config.ts`. Suggested shape:

```json
{
  "name": "API: Vitest",
  "type": "node",
  "request": "launch",
  "cwd": "${workspaceFolder}/apps/api",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run", "${relativeFile}"],
  "console": "integratedTerminal",
  "envFile": "${workspaceFolder}/apps/api/.env"
}
```

Repeat for `apps/web` and `packages/ui` as needed.

> **Reminder:** Add Vitest debug launch configs to `.vscode/launch.json` once each package has a `vitest.config.ts`. Use the suggested shape above as a starting point; wire `envFile` per app the same way as the existing API/Web debug entries.

## SonarQube for IDE (SonarLint)

See **`docs/guidelines/SONAR.md`** for full setup (user token, connected mode, CI, triage workflow).

Workspace project binding: `.vscode/settings.json` + `.sonarcloud.properties`. Connection token stays in **user** settings only.

## Troubleshooting

| Issue                           | Fix                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Breakpoints stay grey / unbound | Start the matching debug config first; ensure source maps and `cwd` match the app |
| API port not 3001               | API uses `detect-port`; check terminal output for the actual port                 |
| Next.js client config fails     | Start dev server first, or use **full stack** config                              |
| Env vars missing at runtime     | Ensure the app `.env` file exists for that configuration's `envFile`              |
