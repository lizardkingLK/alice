import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';

const stats = [
  {
    title: 'Open Issues',
    value: '12',
    description: 'Assigned to you',
  },
  {
    title: 'In Progress',
    value: '4',
    description: 'Active this sprint',
  },
  {
    title: 'Completed',
    value: '28',
    description: 'Closed this month',
  },
  {
    title: 'Team Members',
    value: '8',
    description: 'Across your projects',
  },
] as const;

export function DashboardOverview() {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader>
              <CardDescription>{stat.title}</CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums">
                {stat.value}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Your latest updates will appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground bg-muted/30 flex h-40 items-center justify-center rounded-lg border border-dashed text-sm">
            No activity yet — this area is ready for your project feed.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
