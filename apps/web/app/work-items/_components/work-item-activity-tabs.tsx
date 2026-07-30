'use client';

import { formatDate } from '@/app/_shared/utility';
import { CommentsFeed } from '@/app/comments/_components/comments-feed';
import type { CommentItem } from '@/app/comments/_services/comments.service';
import { WorkItemWorkLogPanel } from '@/app/work-items/_components/work-item-work-log-panel';
import type { WorkItemWorkLog } from '@repo/types';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/ui/components/ui/tabs';
import { History } from '@repo/ui/lib/icons';
import { useLayoutEffect, useRef, type FormEvent } from 'react';

export type WorkItemActivityTab = 'discussion' | 'activity' | 'work-log';

const ACTIVITY_TAB_TRIGGER_CLASS =
  'data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none';

type WorkItemActivityTabsProps = {
  activeTab: WorkItemActivityTab;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onActiveTabChange: (tab: WorkItemActivityTab) => void;
  initialComments: CommentItem[];
  workItem: DbWorkItem;
  discussionWorkItems: Array<{
    id: string;
    title: string;
    key: string;
    type: DbWorkItem['type'];
    project_id: string;
  }>;
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
}: Readonly<WorkItemActivityTabsProps>) {
  const captureScrollBeforeTabChange = usePreserveScrollOnTabChange(activeTab);

  const handleTabChange = (value: string) => {
    captureScrollBeforeTabChange();
    onActiveTabChange(value as WorkItemActivityTab);
  };

  return (
    <section className="space-y-3 [overflow-anchor:none]">
      <h2 className="text-sm font-semibold">Activity</h2>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="h-auto w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="discussion"
            className={ACTIVITY_TAB_TRIGGER_CLASS}
          >
            Discussion
          </TabsTrigger>
          <TabsTrigger value="activity" className={ACTIVITY_TAB_TRIGGER_CLASS}>
            Activity
          </TabsTrigger>
          <TabsTrigger value="work-log" className={ACTIVITY_TAB_TRIGGER_CLASS}>
            Work Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discussion" className="mt-4">
          <CommentsFeed
            embedded
            initialComments={initialComments}
            workItemId={workItem.id}
            workItems={discussionWorkItems}
            currentUserId={currentUserId}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card className="border-dashed">
            <CardContent className="space-y-3 py-12 text-center">
              <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
                <History className="text-muted-foreground size-6" />
              </div>
              <h3 className="text-foreground text-base font-semibold">
                No activity yet
              </h3>
              <p className="text-muted-foreground mx-auto max-w-sm text-sm">
                Status changes, field updates, and transitions will appear here.
              </p>
              <p className="text-muted-foreground text-xs">
                Last updated {formatDate(workItem.updated_at)}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="work-log" className="mt-4">
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
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
