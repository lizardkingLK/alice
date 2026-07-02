# Debugging

Cursor uses the same debugger as VS Code. Configurations live in `.vscode/launch.json`.

## Quick start

1. Open **Run and Debug** (`Ctrl+Shift+D` / `Cmd+Shift+D`).
2. Pick a configuration from the dropdown.
3. Press **F5** and set breakpoints in source.

## Available configurations

| Configuration                 | Debug target                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Web: Next.js (server)**     | RSC, Server Actions, route handlers, `lib/supabase/server.ts` (launches `next dev` via Node — no `node-terminal`) |
| **Web: Next.js (client)**     | Client components (`'use client'`) via Chrome                                                                     |
| **Web: Next.js (full stack)** | Server + auto-opens Chrome when dev server is ready                                                               |
| **API: Express**              | Express routes, middleware, services (`apps/api`)                                                                 |
| **API: attach**               | Attach to a Node process started with `--inspect` on port 9229                                                    |
| **DB: seed**                  | `packages/db/src/seed.ts`                                                                                         |
| **Full stack: Web + API**     | Runs web and API debuggers together — opens **two** integrated-terminal tabs                                      |

## Per-app requirements

Each configuration sets its own `cwd`. Env loading differs by app:

| App     | Working directory | Env loading                                                                                                                            |
| ------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Web     | `apps/web`        | Next.js loads `.env.local` / `.env` from `cwd` automatically — no `envFile` in launch.json (avoids ENOENT if only `.env.local` exists) |
| API     | `apps/api`        | `envFile`: `apps/api/.env` (copy from `sample.env`)                                                                                    |
| DB seed | `packages/db`     | `envFile`: `packages/db/.env` (copy from `sample.env`)                                                                                 |

For web, copy `apps/web/sample.env` → `apps/web/.env.local` before debugging.

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

| Issue                                         | Fix                                                                                                                                                                                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Debugger fails immediately (ENOENT / envFile) | Web configs no longer use `envFile`; ensure `apps/web/.env.local` exists. API/DB need their `.env` files.                                                                                                      |
| `Cannot find module ... bootloader.js`        | Caused by `node-terminal` + stale `NODE_OPTIONS` from VS Code/Cursor debug. Web configs use `type: "node"` instead. Close old debug terminals, reload the window, or run `$env:NODE_OPTIONS=""` in PowerShell. |
| Breakpoints stay grey / unbound               | Start the matching debug config first; ensure source maps and `cwd` match the app                                                                                                                              |
| API port not 3001                             | API uses `detect-port`; check terminal output for the actual port                                                                                                                                              |
| API not visible when debugging                | Use **Full stack: Web + API** (not Web alone). Check the second terminal tab for `info. listening on http://localhost:...`. If it exits immediately, fix `apps/api/.env` (copy from `sample.env`).             |
| Next.js client config fails                   | Start dev server first, or use **full stack** config                                                                                                                                                           |
| Env vars missing at runtime                   | Ensure the app `.env` file exists for that configuration's `envFile`                                                                                                                                           |
