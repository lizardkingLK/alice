/**
 * Generates P0 user-guide stub markdown + docs-publish.json.
 * Run: node apps/web/scripts/docs-user-guide-skeleton.mjs
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const userGuideRoot = path.join(repoRoot, 'docs/user-guide');

/** @type {Array<{ id: string; title: string; order: number; pages: Array<{ file: string; title: string; minimumRole?: string; links?: string[] }> }>} */
const TOPICS = [
  {
    id: 'overview',
    title: 'User guide',
    order: 0,
    pages: [
      {
        file: 'README.md',
        title: 'User guide',
        links: [
          './sign-in-and-account/README.md',
          './navigation/README.md',
          './users-and-access/README.md',
        ],
      },
    ],
  },
  {
    id: 'sign-in-and-account',
    title: 'Sign in & account',
    order: 1,
    pages: [
      { file: 'README.md', title: 'Sign in & account', links: ['./email-sign-in.md', './google-sign-in.md'] },
      { file: 'email-sign-in.md', title: 'Sign in with email' },
      { file: 'google-sign-in.md', title: 'Sign in with Google' },
      { file: 'sign-out.md', title: 'Sign out' },
      { file: 'forgot-password.md', title: 'Forgot password' },
      { file: 'request-access.md', title: 'Request access' },
    ],
  },
  {
    id: 'navigation',
    title: 'Navigation',
    order: 2,
    pages: [
      { file: 'README.md', title: 'Navigation', links: ['./dashboard-overview.md', './keyboard-shortcuts.md'] },
      { file: 'dashboard-overview.md', title: 'Dashboard overview' },
      { file: 'keyboard-shortcuts.md', title: 'Keyboard shortcuts' },
      { file: 'favorites-and-views.md', title: 'Favorites and views' },
    ],
  },
  {
    id: 'users-and-access',
    title: 'Users & access',
    order: 3,
    pages: [
      { file: 'README.md', title: 'Users & access', links: ['./user-directory.md', './allowlist.md'] },
      { file: 'user-directory.md', title: 'User directory' },
      { file: 'allowlist.md', title: 'Allowlist', minimumRole: 'admin' },
      { file: 'allowlist-domain.md', title: 'Allowlist by domain', minimumRole: 'admin' },
      { file: 'allowlist-email-guests.md', title: 'Email guests & project access', minimumRole: 'admin' },
      { file: 'access-requests.md', title: 'Access requests', minimumRole: 'admin' },
      { file: 'invite-users.md', title: 'Invite users', minimumRole: 'admin' },
      { file: 'deactivate-users.md', title: 'Deactivate users', minimumRole: 'admin' },
    ],
  },
  {
    id: 'projects',
    title: 'Projects',
    order: 4,
    pages: [
      { file: 'README.md', title: 'Projects', links: ['./browse-projects.md', './project-members.md'] },
      { file: 'browse-projects.md', title: 'Browse projects' },
      { file: 'create-project.md', title: 'Create a project', minimumRole: 'manager' },
      { file: 'project-settings.md', title: 'Project settings', minimumRole: 'manager' },
      { file: 'project-members.md', title: 'Project members', minimumRole: 'manager' },
      { file: 'project-integrations.md', title: 'Project integrations', minimumRole: 'manager' },
    ],
  },
  {
    id: 'work-items',
    title: 'Work items',
    order: 5,
    pages: [
      { file: 'README.md', title: 'Work items', links: ['./create-work-item.md', './edit-work-item.md'] },
      { file: 'create-work-item.md', title: 'Create a work item' },
      { file: 'edit-work-item.md', title: 'Edit a work item' },
      { file: 'assign-and-status.md', title: 'Assign and change status' },
      { file: 'labels-and-priority.md', title: 'Labels and priority' },
      { file: 'comments-and-activity.md', title: 'Comments and activity' },
      { file: 'attachments.md', title: 'Attachments' },
    ],
  },
  {
    id: 'board-and-planning',
    title: 'Board & planning',
    order: 6,
    pages: [
      { file: 'README.md', title: 'Board & planning', links: ['./kanban-board.md', './backlog.md'] },
      { file: 'kanban-board.md', title: 'Kanban board' },
      { file: 'calendar-view.md', title: 'Calendar view' },
      { file: 'backlog.md', title: 'Backlog' },
      { file: 'sprints.md', title: 'Sprints', minimumRole: 'manager' },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    order: 7,
    pages: [
      { file: 'README.md', title: 'Notifications', links: ['./dashboard-inbox.md'] },
      { file: 'dashboard-inbox.md', title: 'Dashboard inbox' },
    ],
  },
  {
    id: 'chat',
    title: 'Alice (AI chat)',
    order: 8,
    pages: [
      { file: 'README.md', title: 'Alice (AI chat)', links: ['./use-ai-assistant.md'] },
      { file: 'use-ai-assistant.md', title: 'Use the AI assistant' },
    ],
  },
  {
    id: 'profile-and-settings',
    title: 'Profile & settings',
    order: 9,
    pages: [
      { file: 'README.md', title: 'Profile & settings', links: ['./edit-profile.md'] },
      { file: 'edit-profile.md', title: 'Edit your profile' },
      { file: 'workspace-integrations.md', title: 'Workspace integrations' },
    ],
  },
];

const LEGACY_DIRS = [
  'getting-started',
  'board',
  'access',
  'projects',
  'work-items',
];

function roleLabel(minimumRole) {
  if (minimumRole === 'admin') {
    return 'Admins only';
  }
  if (minimumRole === 'manager') {
    return 'Managers and admins';
  }
  return 'All users';
}

/**
 * @param {{ title: string; minimumRole?: string; links?: string[] }} page
 */
function stubMarkdown(page) {
  const lines = [
    `# ${page.title}`,
    '',
    '**Status:** Stub',
    '',
    `**Audience:** ${roleLabel(page.minimumRole)}`,
    '',
    '## Summary',
    '',
    `TODO: add content for "${page.title}".`,
    '',
    '## Steps',
    '',
    '1. TODO',
    '',
  ];

  if (page.links?.length) {
    lines.push('## In this topic', '', '| Page | |', '| ---- | --- |');
    for (const link of page.links) {
      const label = path.basename(link, '.md').replace(/README/i, 'Overview').replaceAll('-', ' ');
      lines.push(`| [${label}](${link}) | |`);
    }
    lines.push('');
  }

  lines.push('## Related', '', '- See the topic index in this folder.', '');

  return lines.join('\n');
}

function writeTopicFiles() {
  for (const dir of LEGACY_DIRS) {
    rmSync(path.join(userGuideRoot, dir), { recursive: true, force: true });
  }

  for (const topic of TOPICS) {
    const topicDir =
      topic.id === 'overview'
        ? userGuideRoot
        : path.join(userGuideRoot, topic.id);

    mkdirSync(topicDir, { recursive: true });

    for (const page of topic.pages) {
      const absolute = path.join(topicDir, page.file);
      writeFileSync(absolute, stubMarkdown(page), 'utf8');
    }
  }
}

function buildManifest() {
  /** @type {{ version: 1; topics: unknown[] }} */
  const manifest = { version: 1, topics: [] };

  for (const topic of TOPICS) {
    const prefix =
      topic.id === 'overview' ? 'user-guide' : `user-guide/${topic.id}`;

    manifest.topics.push({
      id: topic.id,
      title: topic.title,
      order: topic.order,
      pages: topic.pages.map((page, index) => {
        const pagePath = `${prefix}/${page.file}`.replace('/README.md', '/README.md');
        /** @type {Record<string, unknown>} */
        const entry = {
          path: pagePath,
          order: index + 1,
        };
        if (page.minimumRole) {
          entry.minimumRole = page.minimumRole;
        }
        return entry;
      }),
    });
  }

  writeFileSync(
    path.join(repoRoot, 'docs/docs-publish.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
}

writeTopicFiles();
buildManifest();
console.log(
  `user-guide skeleton: ${TOPICS.length} topics, ${TOPICS.reduce((n, t) => n + t.pages.length, 0)} pages`
);
