import { Card, CardContent, CardHeader } from '@repo/ui/components/ui/card';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { skeletonKeys } from '@/components/skeleton-keys';

type RegistryPageSkeletonProps = {
  /** Number of table columns (including actions). */
  columnCount?: number;
  /** Number of placeholder rows. */
  rowCount?: number;
  /** Show tab-pill placeholders in the toolbar (projects, teams, sprints). */
  showTabs?: boolean;
};

export function RegistryPageSkeleton({
  columnCount = 5,
  rowCount = 8,
  showTabs = false,
}: Readonly<RegistryPageSkeletonProps>) {
  const headerKeys = skeletonKeys('header', columnCount);
  const rowKeys = skeletonKeys('row', rowCount);

  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading page content"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="flex items-center gap-2">
          {showTabs ? <Skeleton className="h-10 w-40" /> : null}
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      <Card className="border-border bg-card/50 backdrop-blur-md">
        <CardHeader className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {headerKeys.map((key) => (
                    <TableHead key={key}>
                      <Skeleton className="h-4 w-20" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowKeys.map((rowKey) => (
                  <TableRow key={rowKey}>
                    {skeletonKeys(`cell-${rowKey}`, columnCount).map(
                      (cellKey, colIndex) => (
                        <TableCell key={cellKey}>
                          <Skeleton
                            className={
                              colIndex === 0
                                ? 'h-10 w-full max-w-48'
                                : 'h-4 w-24'
                            }
                          />
                        </TableCell>
                      )
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
