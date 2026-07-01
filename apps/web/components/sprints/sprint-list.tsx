import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';

export function SprintList() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Sprints</CardTitle>
        <CardDescription>
          Active and upcoming sprints will appear here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-muted-foreground bg-muted/30 flex min-h-64 items-center justify-center rounded-lg border border-dashed text-sm">
          No sprints yet. Create your first sprint to get started.
        </div>
      </CardContent>
    </Card>
  );
}
