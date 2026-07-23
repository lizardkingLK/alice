---
name: sonar-duplication-prescan
description: >-
  Explicit-only duplication prescan before commit. Invoke with
  /sonar-duplication-prescan or @sonar-duplication-prescan. Detects SonarQube-style
  duplicated code blocks in staged or branch changes under apps/ and packages/.
disable-model-invocation: true
---

# Pre-commit SonarQube duplication prescan (dedup enforcer)

Identify **code duplication** in local changes before they reach SonarCloud. This skill is **explicit-only** — load it via `/sonar-duplication-prescan` or `@sonar-duplication-prescan`. Do not auto-run the prescan workflow without user confirmation.

Related project docs:

- `docs/guides/SONAR.md` — SonarCloud + ESLint SonarJS layers
- `sonar-project.properties` — scan scope and exclusions

---

## Invocation

Run only when:

- the user invokes `/sonar-duplication-prescan` or `@sonar-duplication-prescan`
- the user confirms after the agent offers a post-task prescan (see `.cursor/rules/07-sonar-dedup-offer.mdc`)

Do **not** start the prescan silently at the end of unrelated tasks.

Default scope: **staged + unstaged** changes on the current branch. If the user says "staged only", limit to `git diff --cached`.

---

## Prescan workflow

Copy and track:

```
Duplication prescan:
- [ ] Step 1: Collect changed files
- [ ] Step 2: Exclude out-of-scope paths
- [ ] Step 3: Find duplicate blocks
- [ ] Step 4: Report findings
- [ ] Step 5: Propose extractions (if asked)
```

### Step 1: Collect changed files

From repo root, prefer:

```bash
git diff --name-only
git diff --cached --name-only
git diff --name-only $(git merge-base HEAD origin/dev 2>/dev/null || git merge-base HEAD main 2>/dev/null || echo HEAD~1)..HEAD
```

Merge the file lists. Focus on `apps/` and `packages/` source files.

### Step 2: Exclude out-of-scope paths

Skip files matching Sonar exclusions (see `sonar-project.properties`):

- `**/node_modules/**`
- `**/.next/**`, `**/dist/**`, `**/coverage/**`
- `**/generated/**`
- `**/prisma/migrations/**`
- lockfiles and config-only churn unless the user asks otherwise

### Step 3: Find duplicate blocks

Within changed files, look for duplication SonarCloud would flag:

| Signal                      | Examples in this monorepo                                                 |
| --------------------------- | ------------------------------------------------------------------------- |
| Copy-pasted handlers        | repeated server-action boilerplate across `apps/web/app/**/actions.ts`    |
| Repeated validation/parsing | duplicate Zod or `FormData` parsing in forms                              |
| Near-identical components   | registry + form pairs with shared layout/logic                            |
| Repeated repository queries | same Supabase `.select()` / error handling in multiple routes             |
| Repeated audit spreads      | manual `created_by` / `updated_at` instead of `@repo/types/audit` helpers |

Heuristics (align with Sonar duplication defaults):

- **≥ 10 duplicated lines** or **≥ 100 tokens** of substantially identical logic
- Same structure with renamed variables still counts
- Imports + one-liner wrappers do not count alone

Compare duplicates:

1. **Within** a single changed file (internal duplication)
2. **Across** changed files in the same PR/commit
3. **Against** existing shared modules — if similar logic already exists in `apps/web/lib/`, `packages/types/`, or `apps/api/src/lib/`, flag reuse instead of a third copy

Use `Grep` / targeted reads; do not paste entire files into the report.

### Step 4: Report findings

If no duplication found:

> Duplication prescan: no blocks meeting the threshold in current changes.

If issues found, use this table:

| Severity | Location   | Duplicated with | Suggestion     |
| -------- | ---------- | --------------- | -------------- |
| High     | `path:a–b` | `other:c–d`     | Extract to `…` |

Severity guide:

- **High** — same block in 2+ places, or duplicates existing shared helper
- **Medium** — partial overlap; extract function or shared module
- **Low** — small repeated pattern; optional helper

### Step 5: Propose extractions (when user wants fixes)

Follow monorepo conventions:

| Duplication type      | Prefer extraction to                                                |
| --------------------- | ------------------------------------------------------------------- |
| Web server actions    | `apps/web/lib/server-actions.ts` or domain `apps/web/lib/<domain>/` |
| Admin/project CRUD    | `apps/web/lib/projects/` (see existing `admin-project.ts` pattern)  |
| API route boilerplate | service + repository under `apps/api/src/routes/api/<domain>/`      |
| Shared types/audit    | `@repo/types` or `@repo/types/audit`                                |
| UI primitives         | `@repo/ui` when reusable across apps                                |

After proposing extractions, run `pnpm lint` on affected packages if code was changed.

---

## Relationship to other quality layers

| Layer              | What it does                                  | This skill                                  |
| ------------------ | --------------------------------------------- | ------------------------------------------- |
| Husky `pre-commit` | Runs `lint-staged` (ESLint)                   | Does not auto-run on commit                 |
| ESLint `sonarjs/*` | Some Sonar-style rules at lint time           | Complements; not full duplication detection |
| SonarCloud CI      | Server-side duplication metric + quality gate | This skill catches issues **before** push   |

Optional later: wire `jscpd` or Sonar scanner into Husky — separate from this agent skill.

---

## Do not

- Block `git commit` automatically (agent skills are not git hooks)
- Run full SonarCloud analysis locally unless the user has scanner tooling configured
- Refactor duplication unless the user asks to fix findings
- Flag generated files, migrations, or lockfiles
- Auto-run this workflow without explicit user invocation or confirmation
