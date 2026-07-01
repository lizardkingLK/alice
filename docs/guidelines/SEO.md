# SEO

Search-engine setup for `apps/web` uses Next.js App Router metadata conventions, centralized site values, and a two-layer crawler exclusion policy for protected routes.

## Architecture

```
apps/web/app/
├── layout.tsx              # metadataBase, default title & description
├── robots.ts               # /robots.txt
├── sitemap.ts              # /sitemap.xml
├── shared/values.ts        # baseUrl, appTitle, appDescription
├── favicon.ico
├── icon.svg
├── apple-icon.png
├── opengraph-image.png
└── <route>/
    └── layout.tsx          # robots: noindex on forbidden routes
```

| Concern                     | Source                                       |
| --------------------------- | -------------------------------------------- |
| Production URL              | `baseUrl` in `apps/web/app/shared/values.ts` |
| Default title / description | Root `layout.tsx` imports from `values.ts`   |
| Crawler allow/disallow      | `robots.ts`                                  |
| Discoverable URLs           | `sitemap.ts` (public routes only)            |
| Per-route indexing          | `metadata.robots` on forbidden route layouts |

Agent and code-review rules live in `.cursor/rules/06-seo-optimizer.mdc`.

## Site constants

`apps/web/app/shared/values.ts`:

```typescript
export const baseUrl = 'https://alice-web-seven.vercel.app';
export const appTitle = 'Jira Teams';
export const appTitleTemplate = '%s | Jira Teams';
export const appDescription = 'A Jira Clone';
```

Update `baseUrl` when the canonical production domain changes. `metadataBase` in the root layout resolves relative OG and icon URLs against this value.

## File-based metadata assets

Next.js automatically serves these from `app/`:

| File                  | Role                         |
| --------------------- | ---------------------------- |
| `favicon.ico`         | Legacy browser favicon       |
| `icon.svg`            | Vector app icon              |
| `apple-icon.png`      | Apple touch icon             |
| `opengraph-image.png` | Default social sharing image |

Replace assets in place; no route handler is required.

## Route classification

### Public routes (indexable)

Included in `sitemap.ts` and allowed in `robots.ts`:

| Path       | Notes                                        |
| ---------- | -------------------------------------------- |
| `/`        | Home / marketing landing                     |
| `/about`   | About page                                   |
| `/contact` | Contact page                                 |
| `/login`   | Sign-in entry (low priority in sitemap)      |
| `/signup`  | Registration entry (low priority in sitemap) |

### Forbidden routes (no indexing)

Must **not** appear in `sitemap.ts`. Must be blocked in `robots.ts` and carry `robots: { index: false, follow: false }` in route metadata.

| Path           | Reason                                              |
| -------------- | --------------------------------------------------- |
| `/dashboard`   | Authenticated hub                                   |
| `/admin`       | Admin role dashboard                                |
| `/manager`     | Manager role dashboard                              |
| `/member`      | Member role dashboard                               |
| `/instruments` | Internal Supabase example                           |
| `/files`       | Authenticated file upload                           |
| `/*?*`         | Query-string URLs (filters, tokens, session params) |

**Defense in depth:** `robots.txt` tells well-behaved crawlers not to fetch a path; page-level `robots` metadata prevents indexing if a URL is linked from elsewhere.

## Adding a new route

### Public marketing page

1. Create the page under `apps/web/app/<segment>/page.tsx`.
2. Export page metadata with a descriptive `title` (and `description` if needed).
3. Add an entry to `sitemap.ts` with `url`, `lastModified`, `changeFrequency`, and `priority`.
4. Confirm the path is not listed in `robots.ts` `disallow`.

### Protected or internal page

1. Create the page (and prefer a `layout.tsx` for the segment).
2. Export metadata with `robots: { index: false, follow: false }`.
3. Add the path prefix to `disallow` in `robots.ts`.
4. Do **not** add the path to `sitemap.ts`.

## Verification

With the dev server running (`pnpm web dev` from the repo root):

```bash
# Crawler policy
curl -s http://localhost:3000/robots.txt

# Public URL list
curl -s http://localhost:3000/sitemap.xml
```

Expected `robots.txt` behavior (production uses `baseUrl` for the sitemap line):

```
User-Agent: *
Allow: /
Disallow: /dashboard
Disallow: /admin
Disallow: /manager
Disallow: /member
Disallow: /instruments
Disallow: /files
Disallow: /*?*

Sitemap: https://alice-web-seven.vercel.app/sitemap.xml
```

When new forbidden routes are added, extend `Disallow` lines and add a segment `layout.tsx` with `robots: { index: false, follow: false }`.

### Manual checks

- Open a forbidden route (e.g. `/dashboard`) and inspect the HTML `<meta name="robots" content="noindex, nofollow">` in page source.
- Use [Google Search Console](https://search.google.com/search-console) URL Inspection after deploy to confirm indexing status.
- Ensure OG previews render correctly (root `opengraph-image.png` or page-specific overrides).

## Related documentation

- Technical architecture: `docs/TRD.md` §9.1
- Product requirements: `docs/ARD.md` (NFR-7)
- Cursor agent rules: `.cursor/rules/06-seo-optimizer.mdc`
