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
const publishManifestPath = path.join(sourceDocs, 'docs-publish.json');
const contentRoot = path.join(webRoot, 'content');
const targetDocs = path.join(contentRoot, 'docs');
const indexPath = path.join(contentRoot, 'docs-index.json');

const jiti = createJiti(import.meta.url);
/** @type {typeof import('../lib/docs/docs-shared.js')} */
const shared = jiti('./../lib/docs/docs-shared.ts');
/** @type {typeof import('../lib/docs/docs-publish.js')} */
const publish = jiti('./../lib/docs/docs-publish.ts');
const {
  buildDocsIndexEntry,
  applyDocsPublishEnrichment,
} = shared;
const {
  flattenDocsPublishManifest,
  normalizePublishPath,
  parseDocsPublishManifest,
} = publish;

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
  const publishByPath = loadPublishManifest();

  const index = relativeFiles.map((relativePath) => {
    const normalizedPath = normalizePublishPath(relativePath);
    const markdown = readFileSync(path.join(targetDocs, relativePath), 'utf8');
    const entry = buildDocsIndexEntry(relativePath, markdown);
    const published = publishByPath.get(normalizedPath);

    if (!published) {
      return entry;
    }

    return applyDocsPublishEnrichment(entry, {
      audience: 'user-guide',
      section: published.topicTitle,
      title: published.title,
      topicOrder: published.topicOrder,
      pageOrder: published.order,
      minimumRole: published.minimumRole ?? 'member',
    });
  });

  validatePublishManifestPaths(publishByPath, relativeFiles);

  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

  console.log(
    `docs:sync copied ${relativeFiles.length} markdown files → content/docs and wrote docs-index.json`
  );
}

function loadPublishManifest() {
  if (!existsSync(publishManifestPath)) {
    throw new Error(`Docs publish manifest not found: ${publishManifestPath}`);
  }

  const raw = JSON.parse(readFileSync(publishManifestPath, 'utf8'));
  const manifest = parseDocsPublishManifest(raw);
  return flattenDocsPublishManifest(manifest);
}

/**
 * @param {Map<string, import('../lib/docs/docs-publish.ts').DocsPublishPageRef>} publishByPath
 * @param {string[]} relativeFiles
 */
function validatePublishManifestPaths(publishByPath, relativeFiles) {
  const available = new Set(relativeFiles.map((path) => normalizePublishPath(path)));

  for (const path of publishByPath.keys()) {
    if (!available.has(path)) {
      throw new Error(
        `docs-publish.json references missing markdown file: ${path}`
      );
    }
  }
}

syncDocs();
