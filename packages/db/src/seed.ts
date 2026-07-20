import 'dotenv/config';

import {
  auditCreate,
  auditCreateWithoutStatus,
  auditUpdate,
} from '@repo/types/audit';
import { createClient } from '@supabase/supabase-js';

import { env } from './env.js';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function getSeedUserPassword(): string {
  const password = process.env.SEED_USER_PASSWORD;
  if (!password) {
    throw new Error(
      'SEED_USER_PASSWORD is required in packages/db/.env to seed auth accounts.'
    );
  }
  return password;
}

const SEED_USERS = [
  {
    email: 'admin@alice.dev',
    name: 'Alice Admin',
    role: 'admin' as const,
  },
  {
    email: 'manager@alice.dev',
    name: 'Bob Manager',
    role: 'manager' as const,
  },
  {
    email: 'member@alice.dev',
    name: 'Carol Member',
    role: 'member' as const,
  },
] as const;

const DEFAULT_INSTRUMENTS = [
  'violin',
  'viola',
  'cello',
  'double bass',
] as const;

type TiptapMark = { type: string };

type TiptapTextNode = {
  type: 'text';
  text: string;
  marks?: TiptapMark[];
};

type TiptapBlockNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Array<TiptapBlockNode | TiptapTextNode>;
};

type TiptapDocument = {
  type: 'doc';
  content: TiptapBlockNode[];
};

function tiptapText(textValue: string, marks?: TiptapMark[]): TiptapTextNode {
  return marks
    ? { type: 'text', text: textValue, marks }
    : { type: 'text', text: textValue };
}

function tiptapParagraph(...content: TiptapTextNode[]): TiptapBlockNode {
  return { type: 'paragraph', content };
}

function tiptapHeading(
  level: 1 | 2 | 3,
  ...content: TiptapTextNode[]
): TiptapBlockNode {
  return { type: 'heading', attrs: { level }, content };
}

function tiptapBulletList(...items: TiptapTextNode[][]): TiptapBlockNode {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [tiptapParagraph(...item)],
    })),
  };
}

function tiptapDoc(...blocks: TiptapBlockNode[]): TiptapDocument {
  return { type: 'doc', content: blocks };
}

const SEED_WORK_ITEM_DESCRIPTIONS = {
  epic: tiptapDoc(
    tiptapHeading(2, tiptapText('User management epic')),
    tiptapParagraph(
      tiptapText(
        'Deliver admin-facing flows to invite, activate, and govern workspace users with role-based access.'
      )
    ),
    tiptapParagraph(tiptapText('Scope', [{ type: 'bold' }])),
    tiptapBulletList(
      [tiptapText('User registry with role assignment')],
      [tiptapText('Activation and deactivation controls')],
      [tiptapText('Audit-friendly profile updates')]
    ),
    tiptapParagraph(
      tiptapText('Out of scope for this epic: ', [{ type: 'italic' }]),
      tiptapText('self-service billing and org-wide SSO provisioning.')
    )
  ),
  story: tiptapDoc(
    tiptapHeading(2, tiptapText('Admin user registry screen')),
    tiptapParagraph(
      tiptapText(
        'Build the admin table view for listing users, filtering by role, and updating account state.'
      )
    ),
    tiptapParagraph(tiptapText('Acceptance criteria', [{ type: 'bold' }])),
    tiptapBulletList(
      [tiptapText('Admins can search users by name or email')],
      [
        tiptapText('Role changes persist to '),
        tiptapText('public.users', [{ type: 'code' }]),
      ],
      [tiptapText('Inactive users cannot access protected routes')]
    )
  ),
  task: tiptapDoc(
    tiptapHeading(2, tiptapText('Wire user list to Supabase')),
    tiptapParagraph(
      tiptapText(
        'Connect the registry table to the API using server-prefetched data and typed DTOs from '
      ),
      tiptapText('@repo/types', [{ type: 'code' }]),
      tiptapText('.')
    ),
    tiptapParagraph(tiptapText('Implementation notes', [{ type: 'bold' }])),
    tiptapBulletList(
      [
        tiptapText(
          'Use service-role only in server actions, never in client components'
        ),
      ],
      [tiptapText('Map API errors to actionable toast messages')],
      [tiptapText('Keep pagination ready even if MVP loads all rows')]
    )
  ),
  backlogStory: tiptapDoc(
    tiptapHeading(2, tiptapText('Kanban drag-and-drop board')),
    tiptapParagraph(
      tiptapText(
        'Backlog story for MVP 3: visualize sprint work in swimlanes and support drag-and-drop status changes.'
      )
    ),
    tiptapParagraph(tiptapText('Desired UX', [{ type: 'bold' }])),
    tiptapBulletList(
      [
        tiptapText('Columns driven by project '),
        tiptapText('workflow_config', [{ type: 'code' }]),
      ],
      [tiptapText('Cards show assignee, priority, and due date')],
      [tiptapText('Optimistic updates with rollback on API failure')]
    ),
    tiptapParagraph(
      tiptapText(
        'Depends on workflow configuration being stored per project in JSON.'
      )
    )
  ),
} as const;

type SeedUser = (typeof SEED_USERS)[number];

type UserIds = Record<(typeof SEED_USERS)[number]['email'], string>;

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    const match = data.users.find((user) => user.email === email);
    if (match) {
      return match.id;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function ensureAuthUser(user: SeedUser): Promise<string> {
  const password = getSeedUserPassword();
  const existingId = await findAuthUserIdByEmail(user.email);

  if (existingId) {
    // Keep seed password in sync so re-runs stay loginable after password drift.
    const { error } = await supabase.auth.admin.updateUserById(existingId, {
      password,
      email_confirm: true,
      user_metadata: { name: user.name },
    });

    if (error) {
      throw new Error(
        `Failed to update auth user "${user.email}": ${error.message}`
      );
    }

    return existingId;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
    user_metadata: { name: user.name },
  });

  if (error) {
    throw new Error(
      `Failed to create auth user "${user.email}": ${error.message}`
    );
  }

  return data.user.id;
}

async function seedUsers(): Promise<UserIds> {
  const ids = {} as UserIds;
  let adminId: string | undefined;

  for (const user of SEED_USERS) {
    const authId = await ensureAuthUser(user);

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();

    if (existing) {
      ids[user.email] = existing.id;
      if (user.role === 'admin') {
        adminId = existing.id;
      }
      continue;
    }

    const actorId = adminId ?? authId;

    const { error } = await supabase.from('users').insert({
      id: authId,
      email: user.email,
      name: user.name,
      role: user.role,
      active: true,
      ...auditCreate(actorId),
    });

    if (error) {
      throw new Error(`Failed to seed user "${user.email}": ${error.message}`);
    }

    ids[user.email] = authId;
    if (user.role === 'admin') {
      adminId = authId;
    }
  }

  return ids;
}

async function seedInstruments(actorId: string): Promise<void> {
  for (const name of DEFAULT_INSTRUMENTS) {
    const { data: existing } = await supabase
      .from('instruments')
      .select('id')
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      continue;
    }

    const { error } = await supabase
      .from('instruments')
      .insert({ name, ...auditCreate(actorId) });

    if (error) {
      throw new Error(`Failed to seed instrument "${name}": ${error.message}`);
    }
  }
}

async function seedTeam(userIds: UserIds, actorId: string): Promise<string> {
  const managerId = userIds['manager@alice.dev'];

  const { data: existing } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Platform Team')
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from('teams')
    .insert({
      name: 'Platform Team',
      description: 'Core platform squad for Alice JIRA',
      manager_id: managerId,
      tech_stack: 'Next.js, Express, Supabase',
      ...auditCreate(actorId),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to seed team: ${error.message}`);
  }

  return data.id;
}

async function seedTeamMembers(
  teamId: string,
  userIds: UserIds,
  actorId: string
): Promise<void> {
  const members = [
    {
      user_id: userIds['manager@alice.dev'],
      role: 'Engineering Manager',
      seniority: 'Senior',
      capacity: 40,
      allocation: 50,
      reporting_line: userIds['admin@alice.dev'],
    },
    {
      user_id: userIds['member@alice.dev'],
      role: 'Software Engineer',
      seniority: 'Mid',
      capacity: 40,
      allocation: 100,
      reporting_line: userIds['manager@alice.dev'],
    },
  ] as const;

  for (const member of members) {
    const { data: existing } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('team_id', teamId)
      .eq('user_id', member.user_id)
      .maybeSingle();

    if (existing) {
      continue;
    }

    const { error } = await supabase.from('team_members').insert({
      team_id: teamId,
      ...member,
      ...auditCreate(actorId),
    });

    if (error) {
      throw new Error(`Failed to seed team member: ${error.message}`);
    }
  }
}

async function seedProject(userIds: UserIds, actorId: string): Promise<string> {
  const ownerId = userIds['admin@alice.dev'];

  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('key', 'ALICE')
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: 'Alice Platform',
      key: 'ALICE',
      description: '1BT JIRA clone — sample project for local development',
      owner_id: ownerId,
      start_date: '2026-06-01',
      end_date: '2026-12-31',
      status: 'active',
      ...auditCreateWithoutStatus(actorId),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to seed project: ${error.message}`);
  }

  return data.id;
}

async function seedProjectMembers(
  projectId: string,
  userIds: UserIds,
  actorId: string
): Promise<void> {
  for (const email of Object.keys(userIds) as (keyof UserIds)[]) {
    const userId = userIds[email];

    const { data: existing } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      continue;
    }

    const { error } = await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: userId,
      ...auditCreate(actorId),
    });

    if (error) {
      throw new Error(`Failed to seed project member: ${error.message}`);
    }
  }
}

async function seedSprints(
  projectId: string,
  actorId: string
): Promise<{
  activeSprintId: string;
  plannedSprintId: string;
}> {
  const sprints = [
    {
      name: 'Sprint 1 — Auth & Users',
      goal: 'Deliver authentication and user management MVP',
      start_date: '2026-06-01',
      end_date: '2026-06-14',
      status: 'active' as const,
    },
    {
      name: 'Sprint 2 — Work Items',
      goal: 'Work item CRUD, backlog, and sprint planning',
      start_date: '2026-06-15',
      end_date: '2026-06-28',
      status: 'planned' as const,
    },
  ] as const;

  const ids: string[] = [];

  for (const sprint of sprints) {
    const { data: existing } = await supabase
      .from('sprints')
      .select('id')
      .eq('project_id', projectId)
      .eq('name', sprint.name)
      .maybeSingle();

    if (existing) {
      ids.push(existing.id);
      continue;
    }

    const { data, error } = await supabase
      .from('sprints')
      .insert({
        project_id: projectId,
        ...sprint,
        ...auditCreateWithoutStatus(actorId),
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(
        `Failed to seed sprint "${sprint.name}": ${error.message}`
      );
    }

    ids.push(data.id);
  }

  return {
    activeSprintId: ids[0]!,
    plannedSprintId: ids[1]!,
  };
}

async function ensureWorkItem(
  projectId: string,
  title: string,
  actorId: string,
  values: Record<string, unknown>
): Promise<string> {
  const { data: existing } = await supabase
    .from('work_items')
    .select('id')
    .eq('project_id', projectId)
    .eq('title', title)
    .maybeSingle();

  if (existing) {
    if (values.description !== undefined) {
      const { error: updateError } = await supabase
        .from('work_items')
        .update({
          description: values.description,
          ...auditUpdate(actorId),
        })
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(
          `Failed to refresh work item description "${title}": ${updateError.message}`
        );
      }
    }

    return existing.id;
  }

  const reporterId =
    typeof values.reporter_id === 'string' ? values.reporter_id : actorId;
  const auditActor = reporterId ?? actorId;

  const { data, error } = await supabase
    .from('work_items')
    .insert({
      project_id: projectId,
      title,
      ...values,
      ...auditCreateWithoutStatus(auditActor),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to seed work item "${title}": ${error.message}`);
  }

  return data.id;
}

async function seedWorkItems(
  projectId: string,
  sprintIds: { activeSprintId: string; plannedSprintId: string },
  userIds: UserIds
): Promise<{ storyId: string; taskId: string; backlogId: string }> {
  const adminId = userIds['admin@alice.dev'];
  const memberId = userIds['member@alice.dev'];

  const epicId = await ensureWorkItem(
    projectId,
    'User Management Epic',
    adminId,
    {
      type: 'Epic',
      priority: 'high',
      status: 'InProgress',
      reporter_id: adminId,
      description: SEED_WORK_ITEM_DESCRIPTIONS.epic,
    }
  );

  const storyId = await ensureWorkItem(
    projectId,
    'Admin user registry screen',
    adminId,
    {
      type: 'Story',
      priority: 'high',
      status: 'InProgress',
      parent_id: epicId,
      sprint_id: sprintIds.activeSprintId,
      assignee_id: memberId,
      reporter_id: adminId,
      story_points: 5,
      due_date: '2026-06-12',
      description: SEED_WORK_ITEM_DESCRIPTIONS.story,
    }
  );

  const taskId = await ensureWorkItem(
    projectId,
    'Wire user list to Supabase',
    adminId,
    {
      type: 'Task',
      priority: 'medium',
      status: 'ToDo',
      parent_id: storyId,
      sprint_id: sprintIds.activeSprintId,
      assignee_id: memberId,
      reporter_id: adminId,
      story_points: 3,
      description: SEED_WORK_ITEM_DESCRIPTIONS.task,
    }
  );

  const backlogId = await ensureWorkItem(
    projectId,
    'Kanban drag-and-drop board',
    adminId,
    {
      type: 'Story',
      priority: 'medium',
      status: 'New',
      reporter_id: adminId,
      story_points: 8,
      description: SEED_WORK_ITEM_DESCRIPTIONS.backlogStory,
    }
  );

  return { storyId, taskId, backlogId };
}

async function seedComments(
  workItemId: string,
  authorId: string
): Promise<string> {
  const content = 'Seed comment — ready for review.';

  const { data: existing } = await supabase
    .from('comments')
    .select('id')
    .eq('work_item_id', workItemId)
    .eq('content', content)
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      work_item_id: workItemId,
      author_id: authorId,
      content,
      ...auditCreate(authorId),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to seed comment: ${error.message}`);
  }

  return data.id;
}

async function seedCommentReply(
  workItemId: string,
  authorId: string,
  parentId: string
): Promise<void> {
  const content = 'Reply — acknowledged, will pick up in standup.';

  const { data: existing } = await supabase
    .from('comments')
    .select('id')
    .eq('work_item_id', workItemId)
    .eq('content', content)
    .maybeSingle();

  if (existing) {
    return;
  }

  const { error } = await supabase.from('comments').insert({
    work_item_id: workItemId,
    author_id: authorId,
    parent_id: parentId,
    content,
    ...auditCreate(authorId),
  });

  if (error) {
    throw new Error(`Failed to seed comment reply: ${error.message}`);
  }
}

async function seedAttachment(
  workItemId: string,
  uploaderId: string
): Promise<void> {
  const fileName = 'user-flow-diagram.png';

  const { data: existing } = await supabase
    .from('attachments')
    .select('id')
    .eq('work_item_id', workItemId)
    .eq('file_name', fileName)
    .maybeSingle();

  if (existing) {
    return;
  }

  const { error } = await supabase.from('attachments').insert({
    work_item_id: workItemId,
    uploader_id: uploaderId,
    file_name: fileName,
    storage_path: 'seed/user-flow-diagram.png',
    file_size: 245_760,
    mime_type: 'image/png',
    ...auditCreate(uploaderId),
  });

  if (error) {
    throw new Error(`Failed to seed attachment: ${error.message}`);
  }
}

type NotificationSeed = {
  user_id: string;
  type:
    'assign' | 'sprint' | 'status_change' | 'comment' | 'mention' | 'due_date';
  message: string;
  related_item_id: string;
  read_status: boolean;
};

async function seedNotifications(
  userIds: UserIds,
  relatedItemId: string,
  actorId: string
): Promise<void> {
  const notifications: NotificationSeed[] = [
    {
      user_id: userIds['member@alice.dev'],
      type: 'assign',
      message: 'You were assigned to "Admin user registry screen".',
      related_item_id: relatedItemId,
      read_status: false,
    },
    {
      user_id: userIds['manager@alice.dev'],
      type: 'sprint',
      message: 'Sprint 1 — Auth & Users is now active.',
      related_item_id: relatedItemId,
      read_status: true,
    },
  ];

  for (const notification of notifications) {
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', notification.user_id)
      .eq('message', notification.message)
      .maybeSingle();

    if (existing) {
      continue;
    }

    const { error } = await supabase
      .from('notifications')
      .insert({ ...notification, ...auditCreate(actorId) });

    if (error) {
      throw new Error(`Failed to seed notification: ${error.message}`);
    }
  }
}

async function main(): Promise<void> {
  console.log('info. seeding users and auth accounts...');
  const userIds = await seedUsers();
  const adminId = userIds['admin@alice.dev'];

  console.log('info. seeding instruments...');
  await seedInstruments(adminId);

  console.log('info. seeding team...');
  const teamId = await seedTeam(userIds, adminId);
  await seedTeamMembers(teamId, userIds, adminId);

  console.log('info. seeding project...');
  const projectId = await seedProject(userIds, adminId);
  await seedProjectMembers(projectId, userIds, adminId);

  console.log('info. seeding sprints...');
  const sprintIds = await seedSprints(projectId, adminId);

  console.log('info. seeding work items...');
  const workItems = await seedWorkItems(projectId, sprintIds, userIds);

  console.log('info. seeding comments, attachments, notifications...');
  const commentId = await seedComments(
    workItems.storyId,
    userIds['manager@alice.dev']
  );
  await seedCommentReply(
    workItems.storyId,
    userIds['member@alice.dev'],
    commentId
  );
  await seedAttachment(workItems.storyId, userIds['member@alice.dev']);
  await seedNotifications(userIds, workItems.storyId, adminId);

  console.log('info. seed completed.');
  console.log(
    'info. sample accounts (password from SEED_USER_PASSWORD in .env):'
  );
  for (const user of SEED_USERS) {
    console.log(`  - ${user.email} (${user.role})`);
  }
}

try {
  await main();
} catch (error: unknown) {
  console.error('error. seed failed.', error);
  process.exit(1);
}
