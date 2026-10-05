# Day One local development setup

Status: **Living**

Last updated: 2026-10-05

Use this guide to clone Alice, configure its local environment, initialize its
Supabase database, and run the web and API applications. Run all commands from
the repository root unless a step says otherwise.

## Prerequisites

- Git
- Node.js 20.19+, 22.12+, or 24+. The devcontainer currently uses Node 24,
  while CI uses Node 20.
- pnpm 12.4.2, the version pinned by the root `package.json`
- Access to a Supabase project
- Access to a Pusher Channels app

Alice does not include a local Supabase `config.toml`; local development uses a
hosted or team-provided Supabase project. Docker is not required for the normal
local development flow.

## 1. Clone the repository

```bash
git clone https://github.com/lizardkingLK/alice.git
cd alice
```

## 2. Activate the pinned pnpm version

The repository's `packageManager` field pins pnpm 12.4.2. With Corepack
available, run:

```bash
corepack enable
corepack install
node --version
pnpm --version
```

`pnpm --version` should print `12.4.2`.

## 3. Install dependencies

```bash
pnpm install --frozen-lockfile
```

Install once at the repository root; pnpm installs every workspace package.

## 4. Collect service credentials

From the Supabase project, collect:

- Project URL
- anon key
- service-role key
- Direct Postgres connection string for migrations (`DIRECT_URL`)
- Supavisor **session-mode** connection string on port 5432 for the API
  (`DATABASE_URL`)

Do not use the Supavisor transaction-mode URL on port 6543 for
`DATABASE_URL`. From the Pusher Channels app, collect the app ID, key, secret,
and cluster.

Keep service-role, database, and Pusher secrets out of Git. The local env files
created below are ignored by the repository.

## 5. Create local environment files

Create the three app-specific env files from the committed templates.

macOS/Linux:

```bash
cp apps/web/sample.env apps/web/.env.local
cp apps/api/sample.env apps/api/.env
cp packages/db/sample.env packages/db/.env
```

PowerShell:

```powershell
Copy-Item apps/web/sample.env apps/web/.env.local
Copy-Item apps/api/sample.env apps/api/.env
Copy-Item packages/db/sample.env packages/db/.env
```

Replace template placeholders with the values below.

### `apps/web/.env.local`

Set these values:

```dotenv
NEXT_PUBLIC_API_URL="http://localhost:5000"
NEXT_PUBLIC_SUPABASE_URL="<Supabase project URL>"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<Supabase anon key>"
NEXT_PUBLIC_PUSHER_KEY="<Pusher key>"
NEXT_PUBLIC_PUSHER_CLUSTER="<Pusher cluster>"
SUPABASE_SERVICE_ROLE_KEY="<Supabase service-role key>"
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only despite being in the web app's env
file; never prefix it with `NEXT_PUBLIC_`. It is needed by server-rendered
allowlist, user, project, and chat operations.

`NEXT_PUBLIC_SITE_URL="http://localhost:3000"` is recommended for predictable
local authentication links. It is not required for startup; when it is unset,
the application falls back to the request origin.

The Google Auth secret, `DATA_READS_VIA_API`, and Cypress credentials in the
template are not required for normal Day One startup. Missing Google
configuration may produce a warning, but seeded email/password login still
works.

### `apps/api/.env`

Configure the required runtime values:

```dotenv
PORT="5000"
FRONTEND_URL="http://localhost:3000"
DATABASE_URL="<Supavisor session-mode URL on port 5432>"

SUPABASE_URL="<Supabase project URL>"
SUPABASE_ANON_KEY="<Supabase anon key>"
SUPABASE_SERVICE_ROLE_KEY="<Supabase service-role key>"

PUSHER_APP_ID="<Pusher app ID>"
PUSHER_KEY="<Pusher key>"
PUSHER_SECRET="<Pusher secret>"
PUSHER_CLUSTER="<Pusher cluster>"

CRON_SECRET="<a non-empty local secret>"

STORAGE_BUCKET_ATTACHMENTS="alice_storage_attachments"
STORAGE_BUCKET_CHAT_ATTACHMENTS="alice_storage_chat_attachments"
STORAGE_BUCKET_CHAT_HISTORY="alice_storage_chat_history"
STORAGE_BUCKET_PROFILE_COVERS="alice_storage_profile_covers"
STORAGE_BUCKET_PROFILE_PICTURES="alice_storage_profile_pictures"
STORAGE_BUCKET_PROJECT_COVERS="alice_storage_project_covers"
STORAGE_BUCKET_PROJECT_LOGOS="alice_storage_project_logos"
```

The Atlassian, GitHub, and integration-encryption variables are optional for
startup. If you are not developing those integrations, remove or comment out
their lines after copying `sample.env`. Do not leave `YOUR_*` placeholders in
place because the API treats non-empty placeholder strings as configured
values.

### `packages/db/.env`

Configure the Prisma/migration connection and seed credentials:

```dotenv
DIRECT_URL="<direct non-pooled Postgres URL>"
SUPABASE_URL="<Supabase project URL>"
SUPABASE_SERVICE_ROLE_KEY="<Supabase service-role key>"
SEED_USER_PASSWORD="<password for local seed accounts>"
```

`SEED_USER_PASSWORD` is required by `pnpm db seed` even though it is not
currently present in `packages/db/sample.env`. Do not put the API's pooled
`DATABASE_URL` in place of `DIRECT_URL`.

## 6. Initialize Supabase

Choose the path that matches the Supabase project you are using:

- **Already initialized Alice team project:** ask the team which provisioning
  steps are already complete. Do not repeat migrations, bucket creation, or
  initial seeding unnecessarily; run only the steps the team asks you to run.
- **Fresh or empty project:** complete the migration, storage, and seed steps
  below.

Never run `migrate:reset` or `seed:reset` against data you need to keep.

For a fresh project, or when the team asks you to provision an existing
project, continue with the following steps.

Apply all committed migrations:

```bash
pnpm db migrate:deploy
```

In Supabase Dashboard -> Storage, create the following buckets if they do not
already exist:

| Bucket                           | Access  |
| -------------------------------- | ------- |
| `alice_storage_attachments`      | Private |
| `alice_storage_chat_attachments` | Private |
| `alice_storage_chat_history`     | Private |
| `alice_storage_profile_pictures` | Public  |
| `alice_storage_profile_covers`   | Public  |
| `alice_storage_project_logos`    | Public  |
| `alice_storage_project_covers`   | Public  |

The API can create the two chat buckets on first use, but creating all seven
now makes every upload path available from the first run.

Seed an empty development project with login accounts and sample Alice data:

```bash
pnpm db seed
```

The seed is structurally idempotent, but rerunning it updates existing seeded
Auth users to the password currently set in `SEED_USER_PASSWORD`. Check with
the team before running it against a shared project. It creates these primary
accounts:

- `admin@alice.dev`
- `manager@alice.dev`
- `member@alice.dev`

It also allowlists the `alice.dev` domain, so these accounts can enter the
application. If you intentionally skip the seed, the app can start, but you
must provision an Auth user, a matching `public.users` row, and allowlist data
before protected pages are usable.

Google OAuth, custom SMTP, and Supabase email-template customization are not
required to start Alice or use the seeded accounts locally.

## 7. Run Alice

Start the full workspace:

```bash
pnpm dev
```

Turborepo builds required internal packages and starts:

- Web: `http://localhost:3000`
- API: `http://localhost:5000`

Keep this terminal running while developing.

## 8. Verify the setup

1. Confirm the API terminal logs `prisma connected` and a listener on port 5000.
2. Open `http://localhost:5000`; it should report that the API server is
   listening.
3. Open `http://localhost:3000` and sign in as `admin@alice.dev` with the
   configured seed password.
4. Confirm the dashboard loads the seeded Alice project and work items.
5. In another terminal, confirm the database has no pending migrations:

   ```bash
   pnpm db migrate:status
   ```

If startup fails environment validation, compare the reported variable with
the appropriate `sample.env`. If the API starts but database requests fail,
recheck that `DIRECT_URL` is the direct migration URL and `DATABASE_URL` is the
Supavisor session-mode URL on port 5432.
