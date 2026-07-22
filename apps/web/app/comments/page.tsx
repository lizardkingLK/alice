import { Suspense } from 'react';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { CommentsFeed } from './_components/comments-feed';
import { CommentItem } from './_services/comments.service';

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
    content: 'Reviewed the user registration service logic. The RLS policies look solid and session refresh behavior is verified.',
    edited: false,
    status: 'active',
    created_at: '2026-07-20T14:32:00Z',
    updated_at: '2026-07-20T14:32:00Z',
    author: {
      id: 'user-admin-1',
      name: 'Alana Admin',
      email: 'admin@alice.dev',
      role: 'admin',
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
    content: 'Great update! Let us ensure we add e2e test cases covering edge-case token expiration in Cypress.',
    edited: false,
    status: 'active',
    created_at: '2026-07-20T15:10:00Z',
    updated_at: '2026-07-20T15:10:00Z',
    author: {
      id: 'user-mgr-1',
      name: 'Marcus Lead',
      email: 'marcus@alice.dev',
      role: 'manager',
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
    content: 'Updated the drag-and-drop column transitions on the Kanban board. Column ordering persists smoothly now.',
    edited: true,
    status: 'active',
    created_at: '2026-07-21T09:15:00Z',
    updated_at: '2026-07-21T09:20:00Z',
    author: {
      id: 'user-dev-1',
      name: 'Devin Smith',
      email: 'devin@alice.dev',
      role: 'member',
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

const mockWorkItems = [
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
    type: 'Bug',
    project_id: 'proj-1',
    project_name: 'Jira Core Platform',
  },
];

async function CommentsData() {
  let commentsList: CommentItem[] = [];
  let workItemsList = mockWorkItems;

  try {
    const supabase = await createClient();

    // Fetch comments with author and work item
    const { data: dbComments, error: commentsError } = await supabase
      .from('comments')
      .select(
        `
        *,
        author:users!comments_author_id_fkey(id, name, email, role, profile_picture),
        work_item:work_items(id, title, type, project:projects(id, name, key))
      `
      )
      .order('created_at', { ascending: false });

    if (!commentsError && dbComments && dbComments.length > 0) {
      commentsList = dbComments as unknown as CommentItem[];
    }

    // Fetch work items for modal dropdown
    const { data: dbWorkItems, error: wiError } = await supabase
      .from('work_items')
      .select('id, title, type, project_id, project:projects(name, key)')
      .limit(50);

    type DbWorkItemRow = {
      id: string;
      title: string;
      type: string;
      project_id: string;
      project?: {
        name?: string;
        key?: string;
      } | null;
    };

    if (!wiError && dbWorkItems && dbWorkItems.length > 0) {
      workItemsList = (dbWorkItems as unknown as DbWorkItemRow[]).map((wi) => ({
        id: wi.id,
        title: wi.title,
        key: `${wi.project?.key || 'ITEM'}-${wi.id.slice(0, 4).toUpperCase()}`,
        type: wi.type,
        project_id: wi.project_id,
        project_name: wi.project?.name || 'Project',
      }));
    }
  } catch (err) {
    console.error('Error fetching comments from Supabase:', err);
  }

  // Fallback to seed comments if database has none
  if (commentsList.length === 0) {
    commentsList = mockSeedComments;
  }

  return <CommentsFeed initialComments={commentsList} workItems={workItemsList} />;
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
