import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';

type ProjectWorkspaceAccessDeniedProps = {
  readonly projectName: string;
  readonly projectKey?: string | null;
};

/**
 * Shown when a signed-in user opens `/projects/[id]` without workspace access
 * (not admin, owner, or active project member).
 */
export function ProjectWorkspaceAccessDenied({
  projectName,
  projectKey,
}: Readonly<ProjectWorkspaceAccessDeniedProps>) {
  const title = projectKey ? `${projectKey} · ${projectName}` : projectName;

  return (
    <Card className="mx-auto max-w-lg shadow-none">
      <CardHeader>
        <CardTitle>No access to this project</CardTitle>
        <CardDescription>
          <TruncatedText className="block">{title}</TruncatedText>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          You need to be a project member (or the project owner) to open this
          workspace. Ask an admin or the owner to add you, or return to the
          projects list.
        </p>
        <Button asChild>
          <Link href="/projects">Back to projects</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
