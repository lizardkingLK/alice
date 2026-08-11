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
  Database,
  RefreshCw,
  Edit,
  ExternalLink,
} from '@repo/ui/lib/icons';

const Github = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

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

// eslint-disable-next-line sonarjs/cognitive-complexity
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

  const [isEditingJira, setIsEditingJira] = useState(!project.jira_project_key);
  const [jiraUrl, setJiraUrl] = useState(project.jira_url || '');
  const [jiraProjectKey, setJiraProjectKey] = useState(
    project.jira_project_key || ''
  );
  const [isSavingJira, setIsSavingJira] = useState(false);
  const [isSyncingJira, setIsSyncingJira] = useState(false);
  const [jiraMessage, setJiraMessage] = useState<string | null>(null);
  const [isJiraError, setIsJiraError] = useState(false);

  const [isEditingGitHub, setIsEditingGitHub] = useState(!project.github_repo);
  const [githubOwner, setGithubOwner] = useState(project.github_owner || '');
  const [githubRepo, setGithubRepo] = useState(project.github_repo || '');
  const [githubToken, setGithubToken] = useState('');
  const [isSavingGitHub, setIsSavingGitHub] = useState(false);
  const [githubMessage, setGithubMessage] = useState<string | null>(null);
  const [isGitHubError, setIsGitHubError] = useState(false);

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

  const handleSaveGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGitHub(true);
    setGithubMessage(null);
    setIsGitHubError(false);

    try {
      const body: {
        github_owner: string | null;
        github_repo: string | null;
        github_token?: string;
        expectedUpdatedAt: string;
      } = {
        github_owner: githubOwner.trim() || null,
        github_repo: githubRepo.trim() || null,
        expectedUpdatedAt: project.updated_at,
      };
      if (githubToken.trim()) {
        body.github_token = githubToken.trim();
      }

      await apiFetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setGithubMessage('GitHub integration settings saved successfully!');
      setIsEditingGitHub(false);
      router.refresh();
    } catch (err) {
      console.error('Failed to save GitHub integration:', err);
      setGithubMessage(
        err instanceof Error ? err.message : 'Failed to save configuration'
      );
      setIsGitHubError(true);
    } finally {
      setIsSavingGitHub(false);
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
      <ProjectSummaryBanner project={project} />

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

            <Card className={`${REPORT_CARD_CLASS} md:col-span-3`}>
              <CardHeader>
                <CardTitle className="text-primary flex items-center gap-2 text-base font-semibold">
                  <Database className="h-5 w-5" />
                  Jira Cloud Integration
                </CardTitle>
                <CardDescription className="text-muted-foreground text-sm">
                  Configure your Jira Cloud connection to import issues and keep
                  tasks synced.
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
                        <Label
                          htmlFor="jiraUrl"
                          className="text-xs font-semibold"
                        >
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
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingJira(true)}
                        disabled={isSyncingJira}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Modify Connection
                      </Button>

                      <Button
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

            <Card className={`${REPORT_CARD_CLASS} md:col-span-3`}>
              <CardHeader>
                <CardTitle className="text-primary flex items-center gap-2 text-base font-semibold">
                  <Github className="h-5 w-5" />
                  GitHub Integration
                </CardTitle>
                <CardDescription className="text-muted-foreground text-sm">
                  Configure your GitHub repository to fetch and display Pull Requests and Issues in Work Item details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {githubMessage && (
                  <div
                    className={`rounded p-3 text-sm ${
                      isGitHubError
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-emerald-500/10 text-emerald-600'
                    }`}
                  >
                    {githubMessage}
                  </div>
                )}

                {isEditingGitHub ? (
                  <form onSubmit={handleSaveGitHub} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label
                          htmlFor="githubOwner"
                          className="text-xs font-semibold"
                        >
                          Repository Owner / Org
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
                          htmlFor="githubRepo"
                          className="text-xs font-semibold"
                        >
                          Repository Name
                        </Label>
                        <Input
                          id="githubRepo"
                          value={githubRepo}
                          onChange={(e) => setGithubRepo(e.target.value)}
                          placeholder="e.g. react"
                          className="bg-background/50 h-9 text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="githubToken"
                        className="text-xs font-semibold"
                      >
                        Personal Access Token (PAT)
                      </Label>
                      <Input
                        id="githubToken"
                        type="password"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        placeholder={project.github_owner && project.github_repo ? "•••••••••••• (Leave empty to keep existing)" : "ghp_..."}
                        className="bg-background/50 h-9 text-sm"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      {(project.github_owner || project.github_repo) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setGithubOwner(project.github_owner || '');
                            setGithubRepo(project.github_repo || '');
                            setGithubToken('');
                            setIsEditingGitHub(false);
                            setGithubMessage(null);
                          }}
                          disabled={isSavingGitHub}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button type="submit" size="sm" disabled={isSavingGitHub}>
                        {isSavingGitHub && (
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
                          GitHub Repository
                        </span>
                        <span className="text-foreground font-medium">
                          {project.github_owner && project.github_repo ? (
                            <a
                              href={`https://github.com/${project.github_owner}/${project.github_repo}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {project.github_owner}/{project.github_repo}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            'Not configured'
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs font-semibold tracking-wider uppercase">
                          Token Status
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            project.github_owner
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }
                        >
                          {project.github_owner ? 'Connected' : 'Not Connected'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingGitHub(true)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Modify Connection
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
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
            lockedProjectId={project.id}
            currentUserId={currentUserId}
            initialColumnVisibility={initialColumnVisibility}
            columnVisibilityHasCookie={columnVisibilityHasCookie}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
