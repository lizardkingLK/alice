import { Suspense } from 'react';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { getDbUser } from '@/lib/auth';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { CommentsFeed } from './_components/comments-feed';
import {
  listComments,
  listCommentWorkItemOptions,
} from './_services/comments.reads.server';
import type {
  CommentItem,
  CommentWorkItemOption,
} from './_services/comments.mutations.client';

function CommentsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

// Default rich seed comments fallback
const mockSeedComments: CommentItem[] = [
  {
    id: 'comment-seed-1',
    work_item_id: 'wi-101',
    author_id: 'user-admin-1',
    parent_id: null,
    content:
      'Reviewed the user registration service logic. The RLS policies look solid and session refresh behavior is verified.',
    edited: false,
    status: 'active',
    created_at: '2026-07-20T14:32:00Z',
    updated_at: '2026-07-20T14:32:00Z',
    author: {
      id: 'user-admin-1',
      name: 'Alana Admin',
      email: 'admin@alice.dev',
      role: 'admin',
      profile_picture: null,
    },
    work_item: {
      id: 'wi-101',
      title: 'Auth & Session Cookie Handling',
      key: 'ALICE-101',
      type: 'Story',
      project: {
        id: 'proj-1',
        name: 'Jira Core Platform',
        key: 'ALICE',
      },
    },
  },
  {
    id: 'comment-seed-2',
    work_item_id: 'wi-101',
    author_id: 'user-mgr-1',
    parent_id: 'comment-seed-1',
    content:
      'Great update! Let us ensure we add e2e test cases covering edge-case token expiration in Cypress.',
    edited: false,
    status: 'active',
    created_at: '2026-07-20T15:10:00Z',
    updated_at: '2026-07-20T15:10:00Z',
    author: {
      id: 'user-mgr-1',
      name: 'Marcus Lead',
      email: 'marcus@alice.dev',
      role: 'manager',
      profile_picture: null,
    },
    work_item: {
      id: 'wi-101',
      title: 'Auth & Session Cookie Handling',
      key: 'ALICE-101',
      type: 'Story',
    },
  },
  {
    id: 'comment-seed-3',
    work_item_id: 'wi-102',
    author_id: 'user-dev-1',
    parent_id: null,
    content:
      'Updated the drag-and-drop column transitions on the Kanban board. Column ordering persists smoothly now.',
    edited: true,
    status: 'active',
    created_at: '2026-07-21T09:15:00Z',
    updated_at: '2026-07-21T09:20:00Z',
    author: {
      id: 'user-dev-1',
      name: 'Devin Smith',
      email: 'devin@alice.dev',
      role: 'member',
      profile_picture: null,
    },
    work_item: {
      id: 'wi-102',
      title: 'Kanban Column Smooth Animations',
      key: 'ALICE-102',
      type: 'Task',
      project: {
        id: 'proj-1',
        name: 'Jira Core Platform',
        key: 'ALICE',
      },
    },
  },
];

const mockWorkItems: CommentWorkItemOption[] = [
  {
    id: 'wi-101',
    title: 'Auth & Session Cookie Handling',
    key: 'ALICE-101',
    type: 'Story',
    project_id: 'proj-1',
    project_name: 'Jira Core Platform',
  },
  {
    id: 'wi-102',
    title: 'Kanban Column Smooth Animations',
    key: 'ALICE-102',
    type: 'Task',
    project_id: 'proj-1',
    project_name: 'Jira Core Platform',
  },
  {
    id: 'wi-103',
    title: 'Sprint Planning Burndown Chart Bug',
    key: 'ALICE-103',
    type: 'Task',
    project_id: 'proj-1',
    project_name: 'Jira Core Platform',
  },
];

async function CommentsData() {
  const [commentsResult, workItemsResult] = await Promise.all([
    safeServerFetch(listComments(), [], 'fetch comments list'),
    safeServerFetch(
      listCommentWorkItemOptions(),
      [],
      'fetch work items for comments dropdown'
    ),
  ]);

  const commentsList =
    commentsResult.length > 0 ? commentsResult : mockSeedComments;
  const workItemsList =
    workItemsResult.length > 0 ? workItemsResult : mockWorkItems;

  const dbUser = await getDbUser();
  const currentUserId = dbUser?.id ?? 'user-admin-1';

  return (
    <CommentsFeed
      initialComments={commentsList}
      workItems={workItemsList}
      currentUserId={currentUserId}
    />
  );
}

export default async function CommentsPage() {
  return (
    <DashboardShell description="View, search, and manage discussions across all project work items.">
      <Suspense fallback={<CommentsSkeleton />}>
        <CommentsData />
      </Suspense>
    </DashboardShell>
  );
}
