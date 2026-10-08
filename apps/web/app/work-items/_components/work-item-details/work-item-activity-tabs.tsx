'use client';

import { CommentsFeed } from '@/app/comments/_components/comments-feed';
import { CommentsSortMenu } from '@/app/comments/_components/comments-sort-menu';
import type { CommentsSortOrder } from '@/app/comments/_components/comments-feed-helpers';
import type { CommentItem } from '@/app/comments/_services/comments.mutations.client';
import type { CommentWorkItemOption } from '@/app/comments/_services/comments.mutations.shared';
import { WorkItemActivityFeed } from '@/app/work-items/_components/work-item-details/work-item-activity-feed';
import { WorkItemWorkLogPanel } from '@/app/work-items/_components/work-item-work-logs/work-item-work-log-panel';
import type { WorkItemActivity, WorkItemWorkLog } from '@repo/types';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { Button } from '@repo/ui/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/ui/components/ui/tabs';
import { Maximize2, Minimize2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

export type WorkItemActivityTab = 'discussion' | 'activity' | 'work-log';

const ACTIVITY_TAB_TRIGGER_CLASS =
  'data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none';

type WorkItemActivityTabsProps = {
  activeTab: WorkItemActivityTab;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onActiveTabChange: (tab: WorkItemActivityTab) => void;
  initialComments: CommentItem[];
  initialActivities?: WorkItemActivity[];
  workItem: DbWorkItem;
  discussionWorkItems: CommentWorkItemOption[];
  currentUserId?: string;
  workLogs: WorkItemWorkLog[];
  loggedHoursInput: string;
  loggedAtInput: string;
  workLogCommentInput: string;
  isLoggingWork: boolean;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onLoggedHoursChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onLoggedAtChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onWorkLogCommentChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onWorkLogSubmit: (event: FormEvent) => void;
  /** When true, hide work-log form (Done work items). Discussion stays available. */
  readOnly?: boolean;
};

/**
 * Radix Tabs focuses the newly active panel, which makes the browser
 * scroll that panel into view. Capture/restore scroll so tab switches
 * don't jump the page.
 */
function usePreserveScrollOnTabChange(activeTab: WorkItemActivityTab) {
  const pendingScrollYRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (pendingScrollYRef.current === null) {
      return;
    }

    const y = pendingScrollYRef.current;
    pendingScrollYRef.current = null;
    window.scrollTo({ top: y, left: 0 });

    // Focus-into-view can run after layout; re-apply once on the next frame.
    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: y, left: 0 });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab]);

  return () => {
    pendingScrollYRef.current = window.scrollY;
  };
}

export function WorkItemActivityTabs({
  activeTab,
  onActiveTabChange,
  initialComments,
  initialActivities = [],
  workItem,
  discussionWorkItems,
  currentUserId,
  workLogs,
  loggedHoursInput,
  loggedAtInput,
  workLogCommentInput,
  isLoggingWork,
  onLoggedHoursChange,
  onLoggedAtChange,
  onWorkLogCommentChange,
  onWorkLogSubmit,
  readOnly = false,
}: Readonly<WorkItemActivityTabsProps>) {
  const captureScrollBeforeTabChange = usePreserveScrollOnTabChange(activeTab);
  const [commentsSortOrder, setCommentsSortOrder] =
    useState<CommentsSortOrder>('newest');
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isMaximized) {
      return;
    }

    const originalStyle = globalThis.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isMaximized]);

  const handleTabChange = (value: string) => {
    captureScrollBeforeTabChange();
    onActiveTabChange(value as WorkItemActivityTab);
  };

  return (
    <section
      className={cn(
        'space-y-3 [overflow-anchor:none]',
        isMaximized &&
          'bg-background fixed inset-0 z-50 flex h-screen w-screen flex-col gap-4 overflow-y-auto rounded-none p-6'
      )}
    >
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className={cn(isMaximized && 'flex min-h-0 flex-1 flex-col')}
      >
        <div className="flex items-center gap-2 border-b">
          <TabsList className="h-auto justify-start rounded-none border-0 bg-transparent p-0">
            <TabsTrigger
              value="discussion"
              className={ACTIVITY_TAB_TRIGGER_CLASS}
            >
              Discussion
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className={ACTIVITY_TAB_TRIGGER_CLASS}
            >
              Activity
            </TabsTrigger>
            <TabsTrigger
              value="work-log"
              className={ACTIVITY_TAB_TRIGGER_CLASS}
            >
              Work Log
            </TabsTrigger>
          </TabsList>

          {activeTab === 'discussion' ? (
            <CommentsSortMenu
              sortOrder={commentsSortOrder}
              onSortOrderChange={setCommentsSortOrder}
            />
          ) : null}

          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="ml-auto"
            title={isMaximized ? 'Minimize section' : 'Maximize section'}
            aria-label={isMaximized ? 'Minimize section' : 'Maximize section'}
            onClick={() => setIsMaximized((prev) => !prev)}
          >
            {isMaximized ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>

        <TabsContent
          value="discussion"
          className={cn('mt-4 pb-6', isMaximized && 'min-h-0 flex-1')}
        >
          <CommentsFeed
            embedded
            hideSortControl
            sortOrder={commentsSortOrder}
            onSortOrderChange={setCommentsSortOrder}
            initialComments={initialComments}
            workItemId={workItem.id}
            workItems={discussionWorkItems}
            currentUserId={currentUserId}
          />
        </TabsContent>

        <TabsContent
          value="activity"
          className={cn('mt-4 pb-6', isMaximized && 'min-h-0 flex-1')}
        >
          <WorkItemActivityFeed activities={initialActivities} />
        </TabsContent>

        <TabsContent
          value="work-log"
          className={cn('mt-4 pb-6', isMaximized && 'min-h-0 flex-1')}
        >
          <WorkItemWorkLogPanel
            workLogs={workLogs}
            currentUserId={currentUserId}
            loggedHoursInput={loggedHoursInput}
            loggedAtInput={loggedAtInput}
            workLogCommentInput={workLogCommentInput}
            isLoggingWork={isLoggingWork}
            onLoggedHoursChange={onLoggedHoursChange}
            onLoggedAtChange={onLoggedAtChange}
            onWorkLogCommentChange={onWorkLogCommentChange}
            onSubmit={onWorkLogSubmit}
            readOnly={readOnly}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
