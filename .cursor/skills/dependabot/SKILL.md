# Git-Remote Web Scan Dependabot Skill

## Purpose

Identify the repository owner and name via local Git remote configurations, and use web search tools to dynamically audit open Dependabot alerts or dependency vulnerabilities without requiring the GitHub CLI (`gh`).

## Instructions

1. **Extract Repository Metadata:** Run `git remote get-url origin` (or parse `.git/config`) to find the repository's host, owner, and repository name.
2. **Web Vulnerability Scan:**
   - Use web search engines to query publicly available GitHub security advisories or public vulnerability feeds matching the repository details (e.g., `site:github.com/{owner}/{repo}/security/advisories`).
   - If the repository is private or public data isn't indexed, fall back to checking local package manifest files (such as `package.json`, `requirements.txt`, `go.mod`) and perform web searches against the [GitHub Advisory Database](https://github.com) or [NVD](https://nist.gov) for known CVEs affecting those explicit version ranges.
3. **Resolve Dependencies:** Group the discovered vulnerabilities by package name and identify the minimum safe patch version via web queries.
4. **Apply and Verify Fixes:**
   - Update the vulnerable packages using the project’s local package manager.
   - Run the project's verification suite (e.g., `npm run build && npm test`) to confirm stability.
   - Output a comprehensive audit report summarizing the changes made.

## Constraints

- Do not attempt to run or look for the `gh` command-line tool.
- Always preserve lockfile integrity (`package-lock.json`, `pnpm-lock.yaml`, etc.) during updates.
- If a local build or test fails after upgrading a package, halt operations immediately and report the error to the user.
