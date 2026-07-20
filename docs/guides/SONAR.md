# SonarQube / SonarCloud

Alice uses **three complementary layers** for code quality and security analysis:

| Layer           | Tool                                                              | When                            |
| --------------- | ----------------------------------------------------------------- | ------------------------------- |
| Local lint      | ESLint + `eslint-plugin-sonarjs` in `@repo/eslint-config/base.js` | `pnpm lint`, pre-commit         |
| IDE (connected) | SonarQube for IDE extension                                       | While editing in Cursor/VS Code |
| CI gate         | SonarCloud scan on `dev`                                          | Push / PR to `dev`              |

ESLint catches many Sonar-style rules inside the TypeScript boundary. SonarCloud adds deeper security analysis, duplication, and quality-gate enforcement on the server.

Coverage is **disabled** for now (`sonar.coverage.exclusions=**/*` in `sonar-project.properties`).

## One-time setup (each developer)

### 1. Install extension

Install **SonarQube for IDE** (`SonarSource.sonarlint-vscode`) — listed in `.vscode/extensions.json`.

### 2. Create a SonarCloud token

1. Open [SonarCloud → Account → Security](https://sonarcloud.io/account/security)
2. Generate a token (name: e.g. `cursor-alice`)
3. Copy it — shown once

### 3. Add connection in **user** settings (not the repo)

Command Palette → **Preferences: Open User Settings (JSON)** and add:

```json
{
  "sonarlint.connectedMode.connections.sonarcloud": [
    {
      "connectionId": "lizardkinglk_alice",
      "organizationKey": "lizardkinglk",
      "token": "YOUR_SONARCLOUD_TOKEN"
    }
  ]
}
```

`connectionId` must match `.vscode/settings.json`:

```json
"sonarlint.connectedMode.project": {
  "connectionId": "lizardkinglk_alice",
  "projectKey": "lizardkingLK_alice"
}
```

Never commit the token.

### 4. Bind the project

Command Palette → **SonarQube: Update all bindings to SonarQube/SonarCloud**

Repo binding also comes from:

- `.sonarcloud.properties` — `sonar.organization`, `sonar.projectKey`
- `sonar-project.properties` — full scan scope for CI

### 5. Reload

Reload the window. Open a `.ts` file — SonarQube view in the sidebar should list project issues.

## Reviewing and fixing issues

### In Cursor (day to day)

1. Open **SonarQube** activity bar panel
2. Filter by severity, type (Bug / Vulnerability / Code Smell), or “On new code”
3. Click an issue → rule explanation and location
4. Fix in editor; squiggles update on save / re-analysis
5. For security hotspots: mark **Reviewed** / **Fixed** in the panel after verifying

### On SonarCloud (full backlog)

Project: [lizardkingLK_alice](https://sonarcloud.io/project/overview?id=lizardkingLK_alice)

1. **Issues** — triage entire backlog
2. **Security Hotspots** — manual security review queue
3. **Pull Requests** — decoration on PRs to `dev` (after CI scan)
4. **Quality Gate** — pass/fail for `dev` branch

### Fix workflow

1. Note the rule key (`typescript:Sxxxx`, `javascript:Sxxxx`, or ESLint `sonarjs/...`)
2. Fix code locally
3. Run `pnpm lint` (ESLint SonarJS subset)
4. Push to `dev` → `sonar_quality_gate` job re-scans
5. Confirm quality gate green on SonarCloud

### ESLint vs SonarCloud

| Source     | Example rule                   | Where to tune                         |
| ---------- | ------------------------------ | ------------------------------------- |
| ESLint     | `sonarjs/cognitive-complexity` | `packages/eslint-config/base.js`      |
| SonarCloud | `typescript:S3776`             | SonarCloud rule profile (or fix code) |

Prefer fixing code. Disable ESLint rules only when duplicated by SonarCloud and noisy.

## CI configuration

Job: `sonar_quality_gate` in `.github/workflows/deploy.yml`

- Runs on push/PR involving `dev`
- Reads `sonar-project.properties` at repo root
- Waits for quality gate (`sonar.qualitygate.wait=true`)
- PR decoration when `GITHUB_TOKEN` + `SONAR_TOKEN` secrets are set

**Required GitHub secrets:**

| Secret         | Purpose                             |
| -------------- | ----------------------------------- |
| `SONAR_TOKEN`  | SonarCloud analysis                 |
| `GITHUB_TOKEN` | PR decoration (provided by Actions) |

## Monorepo scan scope

`sonar-project.properties` defines:

- **Sources:** `apps`, `packages`
- **Exclusions:** `node_modules`, `.next`, `dist`, `generated`, Prisma migrations, lockfile
- **Tests:** `**/*.test.ts`, `**/*.spec.ts` under apps/packages

IDE settings mirror exclusions via `sonarlint.analyzerProperties` in `.vscode/settings.json`.

## Relationship to ESLint `base.js`

```javascript
sonarjs.configs.recommended,
```

Shared across all packages. `eslint-plugin-only-warn` downgrades ESLint severity to warnings; packages use `--max-warnings 0`, so warnings still fail CI lint.

SonarCloud runs **in addition** — not replaced by ESLint.

## Troubleshooting

| Problem                                         | Fix                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| Unknown Configuration Setting for `sonarlint.*` | Install SonarQube for IDE extension                              |
| No connected issues                             | Add user token connection; run Update all bindings               |
| Different issues in IDE vs CI                   | Run Update bindings; check `sonar-project.properties` exclusions |
| Quality gate failed on `dev`                    | Open SonarCloud → Quality Gate → see failed conditions           |
| Too much noise in generated files               | Confirm `**/generated/**` in exclusions                          |

## Future: enable coverage

When Vitest LCOV is exported in CI:

1. Remove blanket `sonar.coverage.exclusions=**/*`
2. Set `sonar.javascript.lcov.reportPaths` to LCOV output paths
3. Adjust quality gate in SonarCloud to require coverage on new code
