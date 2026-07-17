'use client';

import { useState, useTransition, useActionState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@repo/ui/components/ui/tabs';
import { addMemberAction, removeMemberAction } from './actions';
import type {
  Project,
  ProjectMemberWithUser,
} from '../../_services/projects.service';
import type { User } from '@/app/users/_services/users.service';
import {
  Info,
  Users,
  UserPlus,
  Trash2,
  Calendar,
  Shield,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Folder,
} from '@repo/ui/lib/icons';

interface ProjectDetailsWorkspaceProps {
  readonly project: Project;
  readonly members: ProjectMemberWithUser[];
  readonly allUsers: User[];
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
}

export function ProjectDetailsWorkspace({
  project,
  members,
  allUsers,
  currentUserId,
  currentUserRole,
}: Readonly<ProjectDetailsWorkspaceProps>) {
  const [activeTab, setActiveTab] = useState<'details' | 'members'>('details');
  const [error, setError] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isManagerOrAdmin =
    currentUserRole === 'admin' || currentUserRole === 'manager';

  // Filter out users who are already members of this project
  const memberUserIds = new Set(members.map((m) => m.user_id));
  const candidateUsers = allUsers.filter((u) => !memberUserIds.has(u.id));

  // Add Member Action State binding
  const boundAddMember = addMemberAction.bind(null, project.id);
  const [addFormState, executeAddAction, isAddPending] = useActionState(
    boundAddMember,
    { success: false, error: null }
  );

  const handleRemoveMember = (userId: string) => {
    setError(null);
    setDeletingUserId(userId);
    startTransition(async () => {
      const result = await removeMemberAction(project.id, userId);
      if (!result.success) {
        setError(result.error || 'Failed to remove member from project.');
      }
      setDeletingUserId(null);
    });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb / Back button */}
      <div className="flex items-center gap-2">
        <Link
          href="/projects"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
      </div>

      {/* Hero Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary/10 text-primary border-primary/20 flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-bold shadow-sm">
              {project.key.slice(0, 2)}
            </div>
            <h1 className="text-foreground text-3xl font-extrabold tracking-tight">
              {project.name}
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl text-sm">
            {project.description || 'No description provided for this project.'}
          </p>
        </div>
      </div>

      {/* Tabs Selector */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'details' | 'members')}
        className="w-full space-y-6"
      >
        <TabsList className="border-border flex h-auto justify-start gap-4 rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="details"
            className="border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground flex h-auto cursor-pointer items-center gap-1.5 rounded-none border-b-2 bg-transparent px-1 pt-0 pb-3 text-sm font-semibold whitespace-nowrap transition-all hover:bg-transparent focus:outline-none shadow-none data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            <Info className="h-4 w-4" />
            Project Details
          </TabsTrigger>
          <TabsTrigger
            value="members"
            className="border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground flex h-auto cursor-pointer items-center gap-1.5 rounded-none border-b-2 bg-transparent px-1 pt-0 pb-3 text-sm font-semibold whitespace-nowrap transition-all hover:bg-transparent focus:outline-none shadow-none data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            <Users className="h-4 w-4" />
            Project Members ({members.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="m-0 focus-visible:ring-0 focus-visible:ring-offset-0">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Info Card */}
          <Card className="border-border bg-card/50 backdrop-blur-md md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                <Folder className="text-primary h-5 w-5" />
                Project Information
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                Primary metadata and structural configuration of the project.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Project Name
                  </span>
                  <p className="text-foreground text-sm font-semibold">
                    {project.name}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Unique Key
                  </span>
                  <p className="text-foreground font-mono text-sm font-semibold">
                    {project.key}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Description
                </span>
                <p className="text-foreground text-sm leading-relaxed">
                  {project.description ||
                    'No description configures for this project.'}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Timeline Calendar
                  </span>
                  <p className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
                    <Calendar className="text-muted-foreground h-4 w-4 shrink-0" />
                    {project.start_date || project.end_date ? (
                      <>
                        {project.start_date
                          ? new Date(project.start_date).toLocaleDateString(
                              undefined,
                              {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              }
                            )
                          : 'Start Date'}
                        {' — '}
                        {project.end_date
                          ? new Date(project.end_date).toLocaleDateString(
                              undefined,
                              {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              }
                            )
                          : 'End Date'}
                      </>
                    ) : (
                      'No timeline configured'
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Record Status
                  </span>
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase transition-colors ${
                        project.status === 'active'
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
                          : 'border-amber-500/20 bg-amber-500/10 text-amber-600'
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar Ownership Card */}
          <Card className="border-border bg-card/50 h-fit backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                <Shield className="text-primary h-5 w-5" />
                Ownership
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                Project owner and administrator configurations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-primary/5 border-primary/10 flex items-start gap-3 rounded-lg border p-3">
                <div className="bg-primary/20 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                  {(project.owner?.name ?? 'U').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-semibold">
                    {project.owner?.name ?? 'Unknown Owner'}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {project.owner?.email ?? 'No email configured'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="members" className="m-0 focus-visible:ring-0 focus-visible:ring-offset-0">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Members Table Card */}
          <Card className="border-border bg-card/50 backdrop-blur-md md:col-span-2">
            <CardHeader>
              <CardTitle className="text-xl font-bold tracking-tight">
                Allocated Members
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                A list of engineering resources currently assigned to this
                project.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="text-destructive bg-destructive/10 border-destructive/20 relative flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                  <Button
                    variant="link"
                    onClick={() => setError(null)}
                    className="text-destructive ml-auto h-auto cursor-pointer p-0 text-xs hover:underline focus:outline-none"
                  >
                    Dismiss
                  </Button>
                </div>
              )}

              {members.length === 0 ? (
                <div className="text-muted-foreground flex h-40 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm">
                  <Users className="text-muted-foreground/45 h-8 w-8 stroke-1" />
                  <p>No project members assigned yet.</p>
                </div>
              ) : (
                <div className="divide-border divide-y">
                  {members.map((member) => {
                    const userName = member.user?.name ?? 'Unknown User';
                    const userEmail = member.user?.email ?? '';
                    const userRole = member.user?.role ?? 'member';
                    const isSelf = member.user_id === currentUserId;

                    return (
                      <div
                        key={member.user_id}
                        className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="bg-muted text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                            {userName.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
                              <span className="truncate">{userName}</span>
                              <span className="bg-muted border-border text-muted-foreground py-0.2 shrink-0 rounded-full border px-1.5 text-[10px] font-semibold tracking-wider uppercase">
                                {userRole}
                              </span>
                              {isSelf && (
                                <span className="bg-primary/20 text-primary py-0.2 shrink-0 rounded-full px-1.5 text-[9px] font-bold uppercase">
                                  You
                                </span>
                              )}
                            </p>
                            {userEmail && (
                              <p className="text-muted-foreground truncate text-xs">
                                {userEmail}
                              </p>
                            )}
                          </div>
                        </div>

                        {isManagerOrAdmin && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={isPending}
                            onClick={() => handleRemoveMember(member.user_id)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors disabled:opacity-50"
                            title={`Remove ${userName}`}
                          >
                            {isPending && deletingUserId === member.user_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Members Allocation Panel */}
          {isManagerOrAdmin && (
            <Card className="border-border bg-card/50 h-fit backdrop-blur-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                  <UserPlus className="text-primary h-5 w-5" />
                  Allocate Member
                </CardTitle>
                <CardDescription className="text-muted-foreground text-sm">
                  Assign a new engineering resource to the project.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {candidateUsers.length === 0 ? (
                  <p className="text-muted-foreground text-xs italic">
                    All available users are already assigned to this project.
                  </p>
                ) : (
                  <form action={executeAddAction} className="space-y-4">
                    <div className="space-y-1.5">
                      <Select name="userId" required>
                        <SelectTrigger
                          id="userId"
                          className="bg-background border-input h-10 w-full"
                        >
                          <SelectValue placeholder="Select User..." />
                        </SelectTrigger>
                        <SelectContent>
                          {candidateUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} ({u.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {addFormState.error && (
                      <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-1.5 rounded-lg border p-2.5 text-xs">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{addFormState.error}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={isAddPending}
                      className="w-full cursor-pointer font-semibold shadow-md transition-shadow hover:shadow-lg"
                    >
                      {isAddPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Allocating...
                        </>
                      ) : (
                        'Add to Project'
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>
    </Tabs>
    </div>
  );
}
