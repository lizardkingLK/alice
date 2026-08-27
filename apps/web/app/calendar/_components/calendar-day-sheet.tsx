'use client';

import { useState } from 'react';
import { CheckSquare, Plus } from '@repo/ui/lib/icons';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@repo/ui/components/ui/sheet';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/ui/components/ui/tabs';
import type { Project } from '@/app/projects/_services/projects.service';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type { User } from '@/app/users/_services/users.service';
import { WorkItemForm } from '@/app/work-items/_components/workItem-form';
import { Pagination } from '@/components/pagination';
import { QUERY_FILTER_ALL_VALUE } from '@/hooks/use-query-filter';
import { CalendarDayItem } from '@/app/calendar/_components/calendar-day-item';

type CalendarDaySheetProps = {
  readonly selectedDateStr: string | null;
  // eslint-disable-next-line no-unused-vars -- open change
  readonly onOpenChange: (open: boolean) => void;
  readonly itemsByDate: Readonly<Record<string, DbWorkItem[]>>;
  readonly projects: Project[];
  readonly users: User[];
  readonly projectValue: string;
  readonly sprintValue: string;
  // eslint-disable-next-line no-unused-vars -- open item
  readonly onOpenItem: (item: DbWorkItem) => void;
  // eslint-disable-next-line no-unused-vars -- created item
  readonly onCreated: (workItem: DbWorkItem) => void;
};

export function CalendarDaySheet({
  selectedDateStr,
  onOpenChange,
  itemsByDate,
  projects,
  users,
  projectValue,
  sprintValue,
  onOpenItem,
  onCreated,
}: Readonly<CalendarDaySheetProps>) {
  const [activeTab, setActiveTab] = useState('due');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const dayItems = selectedDateStr ? (itemsByDate[selectedDateStr] ?? []) : [];
  const totalCount = dayItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedItems = dayItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const scopedProjects =
    projectValue && projectValue !== QUERY_FILTER_ALL_VALUE
      ? projects.filter((p) => p.id === projectValue)
      : projects;

  return (
    <Sheet open={!!selectedDateStr} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border/80 flex h-full flex-col p-0 data-[side=right]:sm:max-w-2xl">
        {selectedDateStr ? (
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            orientation="horizontal"
            className="flex h-full w-full min-w-0 flex-col"
          >
            <SheetHeader className="flex flex-row items-center justify-between gap-4 border-b p-6 pr-14 pb-4">
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-xl font-bold">
                  {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString(
                    undefined,
                    { dateStyle: 'full' }
                  )}
                </SheetTitle>
                <SheetDescription className="text-muted-foreground truncate text-xs">
                  View work items due on this date or create a new one.
                </SheetDescription>
              </div>
              <TabsList className="shrink-0">
                <TabsTrigger value="due" className="gap-2">
                  <CheckSquare className="size-4 shrink-0" />
                  <span>Due ({dayItems.length})</span>
                </TabsTrigger>
                <TabsTrigger value="create" className="gap-2">
                  <Plus className="size-4 shrink-0" />
                  <span>Create</span>
                </TabsTrigger>
              </TabsList>
            </SheetHeader>
            <div className="no-scrollbar h-full min-h-0 w-full min-w-0 flex-1 overflow-y-auto p-6">
              <TabsContent
                value="due"
                className="mt-0 h-full w-full space-y-3 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                {dayItems.length === 0 ? (
                  <div className="text-muted-foreground py-12 text-center text-sm">
                    No work items due on this date.
                  </div>
                ) : (
                  <div className="flex h-full flex-col justify-between gap-4">
                    <div className="w-full space-y-3">
                      {paginatedItems.map((item) => (
                        <CalendarDayItem
                          key={item.id}
                          item={item}
                          compact={false}
                          projects={projects}
                          isDragging={false}
                          isPending={false}
                          onDragStart={() => undefined}
                          onDragEnd={() => undefined}
                          onOpen={onOpenItem}
                        />
                      ))}
                    </div>
                    {totalCount > 0 ? (
                      <Pagination
                        totalCount={totalCount}
                        page={currentPage}
                        limit={pageSize}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        onLimitChange={(limit) => {
                          setPageSize(limit);
                          setCurrentPage(1);
                        }}
                        label="work items"
                      />
                    ) : null}
                  </div>
                )}
              </TabsContent>
              <TabsContent
                value="create"
                className="mt-0 w-full outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                <WorkItemForm
                  projects={scopedProjects}
                  projectMembers={users}
                  defaultSprintId={
                    sprintValue && sprintValue !== QUERY_FILTER_ALL_VALUE
                      ? sprintValue
                      : null
                  }
                  lockProject={
                    Boolean(projectValue) &&
                    projectValue !== QUERY_FILTER_ALL_VALUE
                  }
                  onSuccess={(newWI) => {
                    onCreated(newWI);
                    setActiveTab('due');
                    setCurrentPage(1);
                    setPageSize(5);
                  }}
                />
              </TabsContent>
            </div>
          </Tabs>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
