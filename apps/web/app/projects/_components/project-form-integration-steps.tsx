'use client';

import type { ReactNode } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Loader2 } from '@repo/ui/lib/icons';
import {
  GitHubLogo,
  JiraLogo,
} from '@/app/projects/[id]/_components/integration-brand-logos';

function IntegrationProviderOption({
  id,
  checked,
  onCheckedChange,
  logo,
  title,
  description,
  children,
}: Readonly<{
  id: string;
  checked: boolean;
  // eslint-disable-next-line no-unused-vars
  onCheckedChange: (checked: boolean) => void;
  logo: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}>) {
  return (
    <div className="space-y-3">
      <div className="border-border bg-muted/20 flex items-start gap-3 rounded-lg border p-4">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          className="mt-0.5 cursor-pointer"
        />
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="bg-background flex size-9 shrink-0 items-center justify-center rounded-md border">
            {logo}
          </div>
          <div className="grid min-w-0 gap-1 leading-none">
            <Label
              htmlFor={id}
              className="cursor-pointer text-sm font-semibold select-none"
            >
              {title}
            </Label>
            <p className="text-muted-foreground text-xs">{description}</p>
          </div>
        </div>
      </div>
      {checked ? children : null}
    </div>
  );
}

/* eslint-disable no-unused-vars */
export interface Step2ImportsProps {
  importFromJira: boolean;
  handleJiraCheckboxChange: (_checked: boolean) => void;
  jiraUrl: string;
  setJiraUrl: (_url: string) => void;
  jiraProjectKey: string;
  setJiraProjectKey: (_key: string) => void;
  handleTestConnection: () => Promise<void>;
  isTestingJira: boolean;
  jiraTestMessage: string | null;
  jiraTestError: boolean;
  previewIssues: Array<{ key: string; title: string; type: string }>;
}
/* eslint-enable no-unused-vars */

export function Step2Imports({
  importFromJira,
  handleJiraCheckboxChange,
  jiraUrl,
  setJiraUrl,
  jiraProjectKey,
  setJiraProjectKey,
  handleTestConnection,
  isTestingJira,
  jiraTestMessage,
  jiraTestError,
  previewIssues,
}: Readonly<Step2ImportsProps>) {
  return (
    <div className="animate-in fade-in slide-in-from-left-2 space-y-4 duration-300">
      <div className="space-y-1">
        <p className="text-sm font-medium">Import sources</p>
        <p className="text-muted-foreground text-xs">
          Choose product management systems to import work items from. More
          options can be added over time.
        </p>
      </div>

      <ul className="space-y-3">
        <li>
          <IntegrationProviderOption
            id="importFromJira"
            checked={importFromJira}
            onCheckedChange={handleJiraCheckboxChange}
            logo={<JiraLogo />}
            title="Jira"
            description="Import active issues and configure tracking from Atlassian Jira Cloud."
          >
            <div className="border-border/60 bg-muted/30 flex flex-col justify-start space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label htmlFor="jiraUrl" className="text-xs font-medium">
                  Jira Cloud URL / Domain
                </Label>
                <Input
                  id="jiraUrl"
                  value={jiraUrl}
                  onChange={(e) => setJiraUrl(e.target.value)}
                  placeholder="e.g. company.atlassian.net"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jiraProjectKey" className="text-xs font-medium">
                  Jira Project Key
                </Label>
                <Input
                  id="jiraProjectKey"
                  value={jiraProjectKey}
                  onChange={(e) => setJiraProjectKey(e.target.value)}
                  placeholder="e.g. PROJ"
                  className="h-9 text-sm uppercase"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={isTestingJira}
                  className="w-full self-start sm:w-auto"
                >
                  {isTestingJira ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Testing Connection...
                    </>
                  ) : (
                    'Test Connection & Preview'
                  )}
                </Button>

                {jiraTestMessage ? (
                  <p
                    className={`text-xs font-medium ${jiraTestError ? 'text-red-500' : 'text-green-600'}`}
                  >
                    {jiraTestMessage}
                  </p>
                ) : null}
              </div>

              {previewIssues.length > 0 ? (
                <div className="mt-2 flex min-h-0 flex-1 flex-col space-y-1">
                  <Label className="text-muted-foreground text-xs font-semibold">
                    Tasks Preview (to be imported):
                  </Label>
                  <div className="border-border/40 bg-background/50 divide-border/20 max-h-48 flex-1 divide-y overflow-y-auto rounded border p-2 text-xs">
                    {previewIssues.slice(0, 10).map((issue) => (
                      <div
                        key={issue.key}
                        className="flex justify-between gap-4 py-1.5"
                      >
                        <span className="text-muted-foreground shrink-0 font-mono">
                          {issue.key}
                        </span>
                        <span className="flex-1 truncate font-medium">
                          {issue.title}
                        </span>
                        <span className="text-muted-foreground bg-secondary/80 shrink-0 rounded px-1">
                          {issue.type}
                        </span>
                      </div>
                    ))}
                    {previewIssues.length > 10 ? (
                      <div className="text-muted-foreground py-1 text-center">
                        ... and {previewIssues.length - 10} more tasks.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </IntegrationProviderOption>
        </li>
      </ul>
    </div>
  );
}

/* eslint-disable no-unused-vars */
export interface Step3SourceControlProps {
  enableGithub: boolean;
  setEnableGithub: (_enable: boolean) => void;
  githubOwner: string;
  setGithubOwner: (_owner: string) => void;
  githubRepoName: string;
  setGithubRepoName: (_repoName: string) => void;
  githubToken: string;
  setGithubToken: (_token: string) => void;
}
/* eslint-enable no-unused-vars */

export function Step3SourceControl({
  enableGithub,
  setEnableGithub,
  githubOwner,
  setGithubOwner,
  githubRepoName,
  setGithubRepoName,
  githubToken,
  setGithubToken,
}: Readonly<Step3SourceControlProps>) {
  return (
    <div className="animate-in fade-in slide-in-from-left-2 space-y-4 duration-300">
      <div className="space-y-1">
        <p className="text-sm font-medium">Source control</p>
        <p className="text-muted-foreground text-xs">
          Connect a repository host to link pull requests, commits, and
          branches. More SCMs can be added over time.
        </p>
      </div>

      <ul className="space-y-3">
        <li>
          <IntegrationProviderOption
            id="enableGithub"
            checked={enableGithub}
            onCheckedChange={setEnableGithub}
            logo={<GitHubLogo />}
            title="GitHub"
            description="Link pull requests, view commits, and track branches inside your tasks."
          >
            <div className="border-border/60 bg-muted/30 flex flex-col justify-start space-y-4 rounded-lg border p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="githubOwner"
                    className="text-xs font-semibold"
                  >
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
            </div>
          </IntegrationProviderOption>
        </li>
      </ul>
    </div>
  );
}
