'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchWorkItemDevelopment,
  type GitHubWorkItemDevelopment,
} from '@/app/projects/_services/github.service.client';
import { updateWorkItemGitHubPRs } from '@/app/work-items/_services/workItem.service.client';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  Rocket,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Plus,
  Loader2,
} from '@repo/ui/lib/icons';
import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';

interface GitHubDevelopmentSectionProps {
  readonly projectId: string;
  readonly workItemId: string;
  readonly workItem: DbWorkItem;
  // eslint-disable-next-line no-unused-vars
  readonly onWorkItemPatched?: (updated: DbWorkItem) => void;
}

function getPullRequestBadgeClass(state: string): string {
  if (state === 'open') {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  }
  if (state === 'merged') {
    return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
  }
  return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
}

function getBuildStatusIcon(status: string) {
  if (status === 'success') {
    return <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />;
  }
  if (status === 'failure') {
    return <XCircle className="size-4 text-rose-600 dark:text-rose-400" />;
  }
  if (status === 'pending') {
    return <Loader2 className="size-4 text-amber-500 animate-spin" />;
  }
  return <span className="text-xs text-muted-foreground">No builds</span>;
}

export function GitHubDevelopmentSection({
  workItemId,
  workItem,
  onWorkItemPatched,
}: Readonly<GitHubDevelopmentSectionProps>) {
  const [devInfo, setDevInfo] = useState<GitHubWorkItemDevelopment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState<boolean>(false);
  const [linkingPrNumber, setLinkingPrNumber] = useState<number | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState<string>('');

  const getPRNumber = (input: string): number | null => {
    const trimmed = input.trim();
    if (/^\d+$/.test(trimmed)) {
      return Number.parseInt(trimmed, 10);
    }
    const match = /\/pull\/(\d+)/.exec(trimmed);
    if (match?.[1]) {
      return Number.parseInt(match[1], 10);
    }
    return null;
  };

  const handleLinkCustomPR = async () => {
    const prNumber = getPRNumber(customInput);
    if (!prNumber) return;
    await handleLinkPR(prNumber);
    setCustomInput('');
  };

  const loadDevInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await fetchWorkItemDevelopment(workItemId);
      setDevInfo(info);
    } catch (err) {
      console.error('Failed to load GitHub development stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch GitHub data');
    } finally {
      setLoading(false);
    }
  }, [workItemId]);

  useEffect(() => {
    loadDevInfo();
  }, [loadDevInfo]);



  const handleLinkPR = async (prNumber: number) => {
    setLinkingPrNumber(prNumber);
    setLinkError(null);
    try {
      // Decode current linked list
      const currentPrs: number[] = [];
      if (workItem.github_prs) {
        const parsed = typeof workItem.github_prs === 'string'
          ? JSON.parse(workItem.github_prs)
          : workItem.github_prs;
        if (Array.isArray(parsed)) {
          parsed.forEach((num) => {
            if (typeof num === 'number') currentPrs.push(num);
            else if (num && typeof num === 'object' && typeof num.number === 'number') {
              currentPrs.push(num.number);
            }
          });
        }
      }

      if (currentPrs.includes(prNumber)) {
        setLinkError('This pull request is already linked.');
        setLinkingPrNumber(null);
        return;
      }

      const updatedPrs = [...currentPrs, prNumber];

      // Patch the database
      const res = await updateWorkItemGitHubPRs(workItemId, updatedPrs, workItem.updated_at);
      if (res.error) {
        throw new Error(typeof res.error === 'string' ? res.error : 'Failed to link pull request');
      }

      // Notify parent to revalidate work item fields
      if (onWorkItemPatched && res.data) {
        onWorkItemPatched(res.data);
      }

      setIsLinkDialogOpen(false);
      loadDevInfo(); // refresh counts
    } catch (err) {
      console.error('Failed to link pull request:', err);
      setLinkError(err instanceof Error ? err.message : 'Failed to link pull request.');
    } finally {
      setLinkingPrNumber(null);
    }
  };



  if (loading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex justify-between items-center h-5">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-12 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="size-4 shrink-0" />
          <span>GitHub Sync Error</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground wrap-break-word">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={loadDevInfo}
          className="mt-3 flex h-8 items-center gap-1 text-xs"
        >
          <RefreshCw className="size-3" />
          Retry
        </Button>
      </div>
    );
  }

  if (!devInfo) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center text-sm">
        <GitBranch className="size-8 text-muted-foreground/60 mb-2" />
        <span className="font-semibold text-foreground">GitHub Not Connected</span>
        <p className="mt-1 text-xs text-muted-foreground max-w-50">
          Connect GitHub repository in Project Settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2 text-sm text-foreground">
      {/* Branches */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="text-muted-foreground size-4" />
          <span className="font-medium">
            {devInfo.branchesCount} branch{devInfo.branchesCount !== 1 ? 'es' : ''}
          </span>
        </div>
      </div>

      {/* Commits */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCommit className="text-muted-foreground size-4" />
          <span className="font-medium">
            {devInfo.commitsCount} commit{devInfo.commitsCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Pull Requests */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitPullRequest className="text-muted-foreground size-4" />
          <span className="font-medium">
            {devInfo.pullRequestsCount} pull request{devInfo.pullRequestsCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsLinkDialogOpen(true)}
            className="h-6 w-6 p-0 hover:bg-muted"
            title="Link Pull Request"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Pull Requests list */}
      {devInfo.linkedPRs.length > 0 && (
        <div className="pl-6 space-y-1.5 -mt-2 pb-1 max-h-40 overflow-y-auto border-l border-muted ml-2">
          {devInfo.linkedPRs.map((pr) => (
            <div key={pr.id} className="flex items-center justify-between text-xs animate-in fade-in slide-in-from-left-1 duration-200">
              <a
                href={pr.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline text-muted-foreground hover:text-foreground line-clamp-1 flex items-center gap-1 min-w-0"
                title={`#${pr.number} ${pr.title}`}
              >
                <span className="font-semibold shrink-0">#{pr.number}</span>
                <span className="truncate">{pr.title}</span>
                <ExternalLink className="size-2.5 shrink-0 inline opacity-60" />
              </a>
              <Badge
                variant="outline"
                className={`text-[9px] px-1 py-0 capitalize shrink-0 scale-90 ${getPullRequestBadgeClass(
                  pr.state
                )}`}
              >
                {pr.state}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Builds */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="text-muted-foreground size-4" />
          <span className="font-medium">Builds</span>
        </div>
        {getBuildStatusIcon(devInfo.buildsStatus)}
      </div>

      {/* Releases */}
      <div className="border-t pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Releases</span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-semibold">
              <Rocket className="text-muted-foreground size-3.5" />
              Production
            </span>
            {devInfo.releasesStatus === 'success' ? (
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <span className="text-xs text-muted-foreground">Not deployed</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2">
          <Button
            variant="link"
            size="sm"
            className="h-auto cursor-pointer p-0 text-xs font-medium text-emerald-600 hover:text-emerald-700"
          >
            + Add feature flag
          </Button>
          {devInfo.github_owner && devInfo.github_repo && (
            <a
              href={`https://github.com/${devInfo.github_owner}/${devInfo.github_repo}/deployments`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-auto inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground font-medium hover:underline p-0"
            >
              See all deployments
              <ExternalLink className="size-2.5" />
            </a>
          )}
        </div>
      </div>

      {/* Link PR Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="bg-card border border-border/80 shadow-lg sm:max-w-120">
          <DialogHeader>
            <DialogTitle>Link Pull Request</DialogTitle>
            <DialogDescription>
              Search repository pull requests or paste a direct PR link to associate it with this work item.
            </DialogDescription>
          </DialogHeader>

          {linkError && (
            <div className="rounded p-2.5 text-xs bg-destructive/10 text-destructive">
              {linkError}
            </div>
          )}

          <div className="space-y-4 my-2">
            <div className="space-y-2">
              <label htmlFor="link-pr-input" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Pull Request URL or Number
              </label>
              <div className="flex gap-2">
                <Input
                  id="link-pr-input"
                  placeholder="https://github.com/owner/repo/pull/123 or just 123"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  className="h-9 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleLinkCustomPR}
                  disabled={linkingPrNumber !== null || !getPRNumber(customInput)}
                  className="h-9 text-xs font-semibold shrink-0"
                >
                  {linkingPrNumber !== null ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : null}
                  Link PR
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsLinkDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
