'use client';

import { useState, useTransition, useActionState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@repo/ui/components/ui/tabs';
import { addMemberAction, removeMemberAction } from './actions';
import { ProjectTeamsPanel } from '@/app/projects/[id]/_components/project-teams-panel';
import { ProjectSummaryBanner } from '@/app/projects/[id]/_components/project-summary-banner';
import { ProjectSummaryMetrics } from '@/app/projects/[id]/_components/project-summary-metrics';
import { SearchableSelect } from '@/components/searchable-select';
import type {
  Project,
  ProjectMemberWithUser,
} from '../../_services/projects.service';
import type { Team } from '@/app/manager/_services/teams.service';
import type { User } from '@/app/users/_services/users.service';
import WorkItemsWorkspace from '@/app/work-items/_components/workItems-workspace';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { formatDate } from '@/app/_shared/utility';
import {
  parseProjectDetailsTab,
  type ProjectDetailsTab,
} from '@/lib/search-params';
import { UNDERLINE_TAB_TRIGGER_CLASS } from '@/components/underline-tab-trigger';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { apiFetch } from '@/lib/api/api-client';
import type { VisibilityState } from '@tanstack/react-table';
import {
  Info,
  Users,
  UserPlus,
  Trash2,
  Calendar,
  Shield,
  Loader2,
  AlertTriangle,
  Folder,
  Network,
  ClipboardPenLine,
  RefreshCw,
  Edit,
  Plug,
} from '@repo/ui/lib/icons';
import {
  GitHubLogo,
  JiraLogo,
} from '@/app/projects/[id]/_components/integration-brand-logos';

const REPORT_CARD_CLASS = 'border-border/60 bg-card/50 backdrop-blur-sm';

interface ProjectWorkItemsProps {
  readonly initialWorkItems: DbWorkItem[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly search: string;
  readonly typeFilter: string;
  readonly assigneeFilter: string;
  readonly labelsFilter?: readonly string[];
  readonly listView: 'flat' | 'hierarchy';
  readonly tab: 'active' | 'archived';
}

interface ProjectTeamsProps {
  readonly items: Team[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly search: string;
  readonly status: 'active' | 'inactive' | 'archived';
}

interface ProjectDetailsWorkspaceProps {
  readonly project: Project;
  readonly members: ProjectMemberWithUser[];
  readonly allUsers: User[];
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
  readonly workItems: ProjectWorkItemsProps;
  readonly teams: ProjectTeamsProps;
  readonly initialColumnVisibility?: VisibilityState;
  readonly columnVisibilityHasCookie?: boolean;
}

export function ProjectDetailsWorkspace({
  project,
  members,
  allUsers,
  currentUserId,
  currentUserRole,
  workItems,
  teams,
  initialColumnVisibility,
  columnVisibilityHasCookie,
}: Readonly<ProjectDetailsWorkspaceProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = parseProjectDetailsTab(searchParams.get('tab'));

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

  const handleTabChange = (value: string) => {
    const nextTab = value as ProjectDetailsTab;
    const params = new URLSearchParams();
    if (nextTab !== 'details') {
      params.set('tab', nextTab);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

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
      <ProjectSummaryBanner
        project={project}
        canEditBranding={isManagerOrAdmin}
      />

      {/* Tabs Selector */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full space-y-6"
      >
        <TabsList className="border-border flex h-auto justify-start gap-4 rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="details" className={UNDERLINE_TAB_TRIGGER_CLASS}>
            <Info className="h-4 w-4" />
            Project Details
          </TabsTrigger>
          <TabsTrigger value="members" className={UNDERLINE_TAB_TRIGGER_CLASS}>
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="teams" className={UNDERLINE_TAB_TRIGGER_CLASS}>
            <Network className="h-4 w-4" />
            Teams
          </TabsTrigger>
          <TabsTrigger
            value="work-items"
            className={UNDERLINE_TAB_TRIGGER_CLASS}
          >
            <ClipboardPenLine className="h-4 w-4" />
            Work Items
          </TabsTrigger>
          <TabsTrigger
            value="integrations"
            className={UNDERLINE_TAB_TRIGGER_CLASS}
          >
            <Plug className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="details"
          className="m-0 space-y-6 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <ProjectSummaryMetrics
            memberCount={members.length}
            teamCount={teams.totalCount}
            workItemCount={workItems.totalCount}
          />

          <div className="grid gap-6 md:grid-cols-3">
            <Card className={`${REPORT_CARD_CLASS} md:col-span-2`}>
              <CardHeader>
                <CardTitle className="text-primary flex items-center gap-2 text-base font-semibold">
                  <Folder className="h-5 w-5" />
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
                  <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                    {project.description ||
                      'No description configured for this project.'}
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
                            ? formatDate(project.start_date)
                            : 'Start Date'}
                          {' — '}
                          {project.end_date
                            ? formatDate(project.end_date)
                            : 'End Date'}
                        </>
                      ) : (
                        'No timeline configured'
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground mr-4 text-xs font-semibold tracking-wider uppercase">
                      Record Status
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        project.status === 'active'
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }
                    >
                      {project.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`${REPORT_CARD_CLASS} h-fit`}>
              <CardHeader>
                <CardTitle className="text-primary flex items-center gap-2 text-base font-semibold">
                  <Shield className="h-5 w-5" />
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
                    <TruncatedText className="text-foreground text-sm font-semibold">
                      {project.owner?.name ?? 'Unknown Owner'}
                    </TruncatedText>
                    <TruncatedText className="text-muted-foreground text-xs">
                      {project.owner?.email ?? 'No email configured'}
                    </TruncatedText>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent
          value="integrations"
          className="m-0 space-y-6 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <JiraSettingsCard project={project} />
            <GithubSettingsCard project={project} />
          </div>
        </TabsContent>

        <TabsContent
          value="members"
          className="m-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <div className="grid gap-6 md:grid-cols-3">
            {/* Members Table Card */}
            <Card className={`${REPORT_CARD_CLASS} md:col-span-2`}>
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
                              <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                                <TruncatedText className="text-foreground min-w-0">
                                  {userName}
                                </TruncatedText>
                                <span className="bg-muted border-border text-muted-foreground py-0.2 shrink-0 rounded-full border px-1.5 text-[10px] font-semibold tracking-wider uppercase">
                                  {userRole}
                                </span>
                                {isSelf && (
                                  <span className="bg-primary/20 text-primary py-0.2 shrink-0 rounded-full px-1.5 text-[9px] font-bold uppercase">
                                    You
                                  </span>
                                )}
                              </div>
                              {userEmail ? (
                                <TruncatedText className="text-muted-foreground text-xs">
                                  {userEmail}
                                </TruncatedText>
                              ) : null}
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
                              {isPending &&
                              deletingUserId === member.user_id ? (
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
              <Card className={`${REPORT_CARD_CLASS} h-fit`}>
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
                        <SearchableSelect
                          id="userId"
                          name="userId"
                          required
                          placeholder="Search users…"
                          ariaLabel="Select user to allocate"
                          className="bg-background border-input h-10 w-full"
                          options={candidateUsers.map((u) => ({
                            value: u.id,
                            label: `${u.name} (${u.email})`,
                          }))}
                          emptyText="No matching users."
                        />
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

        <TabsContent
          value="teams"
          className="m-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <ProjectTeamsPanel
            project={project}
            members={members}
            teams={teams.items}
            totalCount={teams.totalCount}
            page={teams.page}
            limit={teams.limit}
            totalPages={teams.totalPages}
            tab={teams.status}
            search={teams.search}
            users={allUsers}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
          />
        </TabsContent>

        <TabsContent
          value="work-items"
          className="m-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <WorkItemsWorkspace
            projects={[project]}
            projectMembers={allUsers}
            sprints={[]}
            initialWorkItems={workItems.initialWorkItems}
            totalCount={workItems.totalCount}
            page={workItems.page}
            limit={workItems.limit}
            totalPages={workItems.totalPages}
            search={workItems.search}
            projectFilter={project.id}
            sprintFilter=""
            typeFilter={workItems.typeFilter}
            assigneeFilter={workItems.assigneeFilter}
            labelsFilter={workItems.labelsFilter ?? []}
            listView={workItems.listView}
            tab={workItems.tab}
            lockedProjectId={project.id}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole ?? undefined}
            initialColumnVisibility={initialColumnVisibility}
            columnVisibilityHasCookie={columnVisibilityHasCookie}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface JiraSettingsCardProps {
  readonly project: Project;
}

function JiraSettingsCard({ project }: JiraSettingsCardProps) {
  const router = useRouter();
  const [isEditingJira, setIsEditingJira] = useState(!project.jira_project_key);
  const [jiraUrl, setJiraUrl] = useState(project.jira_url || '');
  const [jiraProjectKey, setJiraProjectKey] = useState(
    project.jira_project_key || ''
  );
  const [isSavingJira, setIsSavingJira] = useState(false);
  const [isSyncingJira, setIsSyncingJira] = useState(false);
  const [jiraMessage, setJiraMessage] = useState<string | null>(null);
  const [isJiraError, setIsJiraError] = useState(false);

  const handleSaveJira = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingJira(true);
    setJiraMessage(null);
    setIsJiraError(false);

    try {
      await apiFetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          jira_url: jiraUrl.trim() || null,
          jira_project_key: jiraProjectKey.toUpperCase().trim() || null,
          expectedUpdatedAt: project.updated_at,
        }),
      });
      setJiraMessage('Jira integration settings saved successfully!');
      setIsEditingJira(false);
      router.refresh();
    } catch (err) {
      console.error('Failed to save Jira integration:', err);
      setJiraMessage(
        err instanceof Error ? err.message : 'Failed to save configuration'
      );
      setIsJiraError(true);
    } finally {
      setIsSavingJira(false);
    }
  };

  const handleSyncJira = async () => {
    setIsSyncingJira(true);
    setJiraMessage(null);
    setIsJiraError(false);

    try {
      setJiraMessage('Syncing tasks from Jira Cloud...');
      const res = await apiFetch<{ importedCount: number }>(
        '/api/projects/jira/import',
        {
          method: 'POST',
          body: JSON.stringify({
            projectId: project.id,
          }),
        }
      );
      setJiraMessage(
        `Successfully imported/synced ${res.importedCount} tasks from Jira!`
      );
      router.refresh();
    } catch (err) {
      console.error('Jira sync failed:', err);
      setJiraMessage(err instanceof Error ? err.message : 'Sync failed');
      setIsJiraError(true);
    } finally {
      setIsSyncingJira(false);
    }
  };

  return (
    <Card className={REPORT_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-primary flex items-center gap-2 text-base font-semibold">
          <JiraLogo />
          Jira Cloud Integration
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          Configure your Jira Cloud connection to import issues and keep tasks
          synced.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {jiraMessage && (
          <div
            className={`rounded p-3 text-sm ${
              isJiraError
                ? 'bg-destructive/10 text-destructive'
                : 'bg-emerald-500/10 text-emerald-600'
            }`}
          >
            {jiraMessage}
          </div>
        )}

        {isEditingJira ? (
          <form onSubmit={handleSaveJira} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="jiraUrl" className="text-xs font-semibold">
                  Jira Cloud URL / Domain
                </Label>
                <Input
                  id="jiraUrl"
                  value={jiraUrl}
                  onChange={(e) => setJiraUrl(e.target.value)}
                  placeholder="e.g. company.atlassian.net"
                  className="bg-background/50 h-9 text-sm"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="jiraProjectKey"
                  className="text-xs font-semibold"
                >
                  Jira Project Key
                </Label>
                <Input
                  id="jiraProjectKey"
                  value={jiraProjectKey}
                  onChange={(e) => setJiraProjectKey(e.target.value)}
                  placeholder="e.g. PROJ"
                  className="bg-background/50 h-9 text-sm uppercase"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {project.jira_project_key && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setJiraUrl(project.jira_url || '');
                    setJiraProjectKey(project.jira_project_key || '');
                    setIsEditingJira(false);
                    setJiraMessage(null);
                  }}
                  disabled={isSavingJira}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" size="sm" disabled={isSavingJira}>
                {isSavingJira && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Connection
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/20 border-border/40 grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground block text-xs font-semibold tracking-wider uppercase">
                  Jira URL
                </span>
                <span className="text-foreground font-medium">
                  {project.jira_url || 'Not configured'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs font-semibold tracking-wider uppercase">
                  Project Key
                </span>
                <span className="text-foreground font-mono font-medium">
                  {project.jira_project_key || 'Not configured'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditingJira(true)}
                disabled={isSyncingJira}
              >
                <Edit className="mr-2 h-4 w-4" />
                Modify Connection
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleSyncJira}
                disabled={isSyncingJira || !project.jira_project_key}
                className="animate-fade-in bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {isSyncingJira ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync / Import Tasks
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface GithubSettingsCardProps {
  readonly project: Project;
}

function GithubSettingsCard({ project }: GithubSettingsCardProps) {
  const router = useRouter();
  const initialOwner = project.github_repo
    ? (project.github_repo.split('/')[0] ?? '')
    : '';
  const initialRepoName = project.github_repo
    ? (project.github_repo.split('/')[1] ?? '')
    : '';

  const [isEditingGithub, setIsEditingGithub] = useState(!project.github_repo);
  // useState is a React Hook used to store and update component state.
  // It returns the current value and a function to update that value.
  // When the state changes, React re-renders the component.
  const [githubOwner, setGithubOwner] = useState(initialOwner);
  const [githubRepoName, setGithubRepoName] = useState(initialRepoName);
  const [githubToken, setGithubToken] = useState(project.github_token || '');
  const [isSavingGithub, setIsSavingGithub] = useState(false);
  const [githubMessage, setGithubMessage] = useState<string | null>(null);
  const [isGithubError, setIsGithubError] = useState(false);

  const handleSaveGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGithub(true);
    setGithubMessage(null);
    setIsGithubError(false);

    try {
      //trim used to remove unnecessary spaces at the beginning and end.
      const repoPath =
        githubOwner.trim() && githubRepoName.trim()
          ? `${githubOwner.trim()}/${githubRepoName.trim()}`
          : null;

      await apiFetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          github_repo: repoPath,
          github_token: githubToken.trim() || null,
          expectedUpdatedAt: project.updated_at,
        }),
      });
      setGithubMessage('GitHub integration settings saved successfully!');
      setIsEditingGithub(false);
      router.refresh();
    } catch (err) {
      console.error('Failed to save GitHub integration:', err);
      setGithubMessage(
        err instanceof Error ? err.message : 'Failed to save configuration'
      );
      setIsGithubError(true);
    } finally {
      setIsSavingGithub(false);
    }
  };

  return (
    <Card className={REPORT_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-primary flex items-center gap-2 text-base font-semibold">
          <GitHubLogo />
          GitHub Integration
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          Configure your GitHub repository to link Pull Requests, view commits,
          and track branches.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {githubMessage && (
          <div
            className={`rounded p-3 text-sm ${
              isGithubError
                ? 'bg-destructive/10 text-destructive'
                : 'bg-emerald-500/10 text-emerald-600'
            }`}
          >
            {githubMessage}
          </div>
        )}

        {isEditingGithub ? (
          <form onSubmit={handleSaveGithub} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="githubOwner" className="text-xs font-semibold">
                  GitHub Owner / Organization
                </Label>
                <Input
                  id="githubOwner"
                  value={githubOwner}
                  onChange={(e) => setGithubOwner(e.target.value)}
                  placeholder="e.g. facebook"
                  className="bg-background/50 h-9 text-sm"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="githubRepoName"
                  className="text-xs font-semibold"
                >
                  GitHub Repository Name
                </Label>
                <Input
                  id="githubRepoName"
                  value={githubRepoName}
                  onChange={(e) => setGithubRepoName(e.target.value)}
                  placeholder="e.g. react"
                  className="bg-background/50 h-9 text-sm"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="githubToken" className="text-xs font-semibold">
                Personal Access Token (optional)
              </Label>
              <Input
                id="githubToken"
                type="text"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="e.g. ghp_xxxxxxxxxxxx"
                className="bg-background/50 custom-secret-text h-9 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {project.github_repo && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const parts = (project.github_repo || '').split('/');
                    setGithubOwner(parts[0] ?? '');
                    setGithubRepoName(parts[1] ?? '');
                    setGithubToken(project.github_token || '');
                    setIsEditingGithub(false);
                    setGithubMessage(null);
                  }}
                  disabled={isSavingGithub}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" size="sm" disabled={isSavingGithub}>
                {isSavingGithub && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save GitHub Configuration
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/20 border-border/40 grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground block text-xs font-semibold tracking-wider uppercase">
                  GitHub Repository
                </span>
                <span className="text-foreground font-medium">
                  {project.github_repo || 'Not configured'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs font-semibold tracking-wider uppercase">
                  Access Token
                </span>
                <span className="text-foreground font-mono font-medium">
                  {project.github_token
                    ? '••••••••••••••••'
                    : 'Not configured (Public repos only)'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditingGithub(true)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Modify GitHub Settings
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
