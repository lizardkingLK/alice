---
name: sonar-new-code-prescan
description: >-
  Explicit-only SonarCloud new-code hygiene check. Invoke with
  /sonar-new-code-prescan. Scans local diffs for duplication and recurring
  Sonar TypeScript smells (duplicate imports, optional chain, etc.) before
  they hit the PR quality gate.
disable-model-invocation: true
---

# Sonar new-code prescan

Catch **SonarCloud new-code** problems in local changes before CI. This skill is
**explicit-only** — load via `/sonar-new-code-prescan` or user confirmation after
the QA Dev Member offer (see `.cursor/rules/07-qa-dev-member.mdc`).

Related:

- Duplication-only sibling: `.cursor/skills/sonar-duplication-prescan/SKILL.md`
- Project Sonar docs: `docs/guides/SONAR.md`
- Scan scope: `sonar-project.properties`

Do **not** open a Cursor browser tab for SonarCloud unless the user explicitly
asks for browser automation. Prefer the public SonarCloud Web API
(`https://sonarcloud.io/api/issues/search?...`) via fetch/curl when a PR number
is known.

---

## Invocation

Run when:

- User invokes `/sonar-new-code-prescan` (or asks to check Sonar smells / PR issues)
- User confirms the post-edit offer from `07-qa-dev-member`

Default scope: **staged + unstaged** + commits since `origin/dev` (or `main`).

---

## Workflow

```
Sonar new-code prescan:
- [ ] Step 1: Collect changed files (apps/ + packages/)
- [ ] Step 2: Exclude generated / lockfile / dist paths
- [ ] Step 3: Duplication pass (same heuristics as sonar-duplication-prescan)
- [ ] Step 4: Recurring smell pass (checklist below)
- [ ] Step 5: Optional — pull open PR issues from SonarCloud API
- [ ] Step 6: Report + fix only if the user asked to fix
```

### Step 1–2: Files

Same as duplication skill: merge `git diff`, `git diff --cached`, and
`git diff --name-only $(git merge-base HEAD origin/dev)..HEAD`. Skip
`node_modules`, `.next`, `dist`, `generated`, migrations, lockfiles.

### Step 3: Duplication

Follow `.cursor/skills/sonar-duplication-prescan/SKILL.md` Steps 3–4
(≥10 similar lines / ≥100 tokens). Report in the same severity table.

### Step 4: Recurring Sonar TypeScript smells

Scan **changed** TS/TSX for patterns that repeatedly fail this repo’s gate
(rules seen on PRs; not exhaustive):

| Rule (Sonar)                                               | Smell                      | What to look for                                            |
| ---------------------------------------------------------- | -------------------------- | ----------------------------------------------------------- |
| `typescript:S3863`                                         | Same module imported twice | Two `from 'X'` lines for the same specifier — merge imports |
| `typescript:S6582`                                         | Prefer optional chain      | `foo && foo.bar` / `foo != null && foo.bar` → `foo?.bar`    |
| `typescript:S2004`                                         | Nested functions too deep  | Extract helpers (often alongside cognitive-complexity)      |
| `typescript:S3776` / ESLint `sonarjs/cognitive-complexity` | High complexity            | Extract private methods / pure helpers                      |
| `typescript:S3358`                                         | Nested ternary             | Prefer `if` / early return                                  |
| `typescript:S1871`                                         | Duplicate branches         | Same body in if/else or switch cases                        |

Also check ESLint would already fail (`pnpm --filter <pkg> lint -- <files>`).

### Step 5: SonarCloud API (optional, when PR known)

If the user names a PR (e.g. `#558`) and network is available:

```bash
curl -sS "https://sonarcloud.io/api/issues/search?componentKeys=lizardkingLK_alice&pullRequest=<N>&resolved=false&sinceLeakPeriod=true&ps=50"
```

Map each issue to `component` + `line` + `rule` + `message`. Prefer fixing those
exact locations over a vague repo-wide hunt.

Do **not** use the Cursor IDE browser for this unless the user says to.

### Step 6: Report

```
| Severity | Rule | Location | Finding | Suggestion |
| -------- | ---- | -------- | ------- | ---------- |
| High     | S3863 | path:line | … | Merge imports |
```

If the user asked to **fix**, apply minimal patches, lint affected packages,
and run focused unit tests. **Do not push** unless they explicitly ask.

---

## Relationship to other layers

| Layer             | Role                                                      |
| ----------------- | --------------------------------------------------------- |
| ESLint + sonarjs  | Local gate on many Sonar-style rules                      |
| This skill        | Agent checklist + optional Sonar API for PR new-code      |
| SonarCloud CI     | Authoritative quality gate on `dev` PRs                   |
| SonarQube for IDE | Connected mode while editing (see `docs/guides/SONAR.md`) |

Prefer enabling/fixing ESLint when a smell is noisy and already has an ESLint
equivalent — agent prescans are a safety net, not a substitute for lint.
