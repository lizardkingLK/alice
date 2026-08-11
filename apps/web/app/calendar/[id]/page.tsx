import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { toShortId } from '@/app/_shared/utility';
import { getWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft } from '@repo/ui/lib/icons';
import { DescriptionView } from '@/app/work-items/_components/workItem-description-view';
import { toNameCase } from '@repo/types';

export default async function CalendarEventDetailsPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const workItem = await getWorkItem(id);

  if (!workItem) {
    notFound();
  }

  const shortId = toShortId(id);

  return (
    <DashboardShell
      description="Scheduled item details"
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Calendar', url: '/calendar' },
        { label: shortId, url: `/calendar/${id}` },
      ]}
    >
      <div className="p-6 space-y-6">
        <Link
          href="/calendar"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Calendar
        </Link>
        <Card className="max-w-2xl">
          <CardHeader>
            <div className="flex justify-between items-start gap-4">
              <div>
                <CardTitle className="text-2xl font-bold">{workItem.title}</CardTitle>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{toNameCase(workItem.type)}</Badge>
                  <Badge variant="secondary">{workItem.status}</Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm font-semibold text-muted-foreground block">Description</span>
              <div className="text-sm mt-1">
                {workItem.description ? (
                  <DescriptionView description={workItem.description} />
                ) : (
                  'No description provided.'
                )}
              </div>
            </div>
            {workItem.due_date && (
              <div>
                <span className="text-sm font-semibold text-muted-foreground block">Due Date</span>
                <span className="text-sm">{new Date(workItem.due_date).toLocaleDateString()}</span>
              </div>
            )}
            <div className="pt-4 border-t">
              <Link
                href={`/work-items/${workItem.id}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                View full Work Item details &rarr;
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
