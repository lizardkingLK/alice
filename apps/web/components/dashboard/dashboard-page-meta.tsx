'use client';

import { Info } from 'lucide-react';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@repo/ui/components/ui/breadcrumb';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';

type DashboardPageMetaProps = {
  title: string;
  description?: string;
};

export function DashboardPageMeta({
  title,
  description,
}: Readonly<DashboardPageMetaProps>) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard">Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {description ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors"
              aria-label="Page description"
            >
              <Info className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {description}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
