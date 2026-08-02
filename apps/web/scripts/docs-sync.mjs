/**
 * Copies repo-root docs/ into apps/web/content/docs and builds docs-index.json.
 * Run via: pnpm --filter web docs:sync
 */
import { createJiti } from 'jiti';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '../..');
const sourceDocs = path.join(repoRoot, 'docs');
const contentRoot = path.join(webRoot, 'content');
const targetDocs = path.join(contentRoot, 'docs');
const indexPath = path.join(contentRoot, 'docs-index.json');

const jiti = createJiti(import.meta.url);
/** @type {typeof import('../lib/docs/docs-shared.js')} */
const shared = jiti('./../lib/docs/docs-shared.ts');
const { buildDocsIndexEntry } = shared;

/**
 * @param {string} dir
 * @param {string} [base]
 * @returns {string[]}
 */
function listMarkdownFiles(dir, base = '') {
  const entries = readdirSync(dir);
  /** @type {string[]} */
  const files = [];

  for (const name of entries) {
    const absolute = path.join(dir, name);
    const relative = base ? `${base}/${name}` : name;
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      files.push(...listMarkdownFiles(absolute, relative));
      continue;
    }
    if (stats.isFile() && name.toLowerCase().endsWith('.md')) {
      files.push(relative.replaceAll('\\', '/'));
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function syncDocs() {
  if (!existsSync(sourceDocs)) {
    throw new Error(`Docs source not found: ${sourceDocs}`);
  }

  mkdirSync(contentRoot, { recursive: true });
  if (existsSync(targetDocs)) {
    rmSync(targetDocs, { recursive: true, force: true });
  }
  mkdirSync(targetDocs, { recursive: true });
  cpSync(sourceDocs, targetDocs, { recursive: true });

  const relativeFiles = listMarkdownFiles(targetDocs);
  const index = relativeFiles.map((relativePath) => {
    const markdown = readFileSync(path.join(targetDocs, relativePath), 'utf8');
    return buildDocsIndexEntry(relativePath, markdown);
  });

  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

  console.log(
    `docs:sync copied ${relativeFiles.length} markdown files → content/docs and wrote docs-index.json`
  );
}

syncDocs();
