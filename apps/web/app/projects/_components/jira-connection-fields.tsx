'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Loader2 } from '@repo/ui/lib/icons';
import {
  connectionLabel,
  type JiraCloudProject,
  type JiraConnection,
} from '../_services/jira.service';

function ConnectJiraButton({
  isConnecting,
  onConnect,
}: Readonly<{
  isConnecting: boolean;
  onConnect: () => void;
}>) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onConnect}
      disabled={isConnecting}
      className="w-full self-start sm:w-auto"
    >
      {isConnecting ? (
        <>
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          Redirecting...
        </>
      ) : (
        'Connect Jira'
      )}
    </Button>
  );
}

function jiraProjectSelectPlaceholder(
  jiraConnectionId: string,
  isLoadingProjects: boolean
): string {
  if (isLoadingProjects) {
    return 'Loading projects...';
  }
  if (jiraConnectionId) {
    return 'Select a Jira project';
  }
  return 'Select a site first';
}

export type JiraConnectionFieldsProps = {
  connections: JiraConnection[];
  jiraConnectionId: string;
  // eslint-disable-next-line no-unused-vars
  setJiraConnectionId: (id: string) => void;
  jiraProjects: JiraCloudProject[];
  isLoadingProjects: boolean;
  jiraProjectKey: string;
  // eslint-disable-next-line no-unused-vars
  setJiraProjectKey: (key: string) => void;
  isConnecting: boolean;
  onConnect: () => void;
  /** Shown under the selects (create wizard vs details can differ). */
  footerHint?: string;
  emptyHint?: string;
  /** When false, hide Connect button + connection count (details manages that separately). */
  showConnectChrome?: boolean;
};

/**
 * Shared site + Jira project selects used by create Imports and details Integrations.
 */
export function JiraConnectionFields({
  connections,
  jiraConnectionId,
  setJiraConnectionId,
  jiraProjects,
  isLoadingProjects,
  jiraProjectKey,
  setJiraProjectKey,
  isConnecting,
  onConnect,
  footerHint,
  emptyHint = 'Authorize Atlassian once, then pick a Jira project to link.',
  showConnectChrome = true,
}: Readonly<JiraConnectionFieldsProps>) {
  if (connections.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-xs">{emptyHint}</p>
        {showConnectChrome ? (
          <ConnectJiraButton
            isConnecting={isConnecting}
            onConnect={onConnect}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showConnectChrome ? (
        <div className="flex flex-wrap items-center gap-2">
          <ConnectJiraButton
            isConnecting={isConnecting}
            onConnect={onConnect}
          />
          <p className="text-muted-foreground text-xs">
            {connections.length} connection
            {connections.length === 1 ? '' : 's'} available
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="jiraConnection" className="text-xs font-medium">
          Jira site
        </Label>
        <Select
          value={jiraConnectionId || undefined}
          onValueChange={setJiraConnectionId}
        >
          <SelectTrigger id="jiraConnection" className="h-9 text-sm">
            <SelectValue placeholder="Select a connected site" />
          </SelectTrigger>
          <SelectContent>
            {connections.map((connection) => (
              <SelectItem key={connection.id} value={connection.id}>
                {connectionLabel(connection)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="jiraProjectKey" className="text-xs font-medium">
          Jira project
        </Label>
        <Select
          value={jiraProjectKey || undefined}
          onValueChange={setJiraProjectKey}
          disabled={!jiraConnectionId || isLoadingProjects}
        >
          <SelectTrigger id="jiraProjectKey" className="h-9 text-sm">
            <SelectValue
              placeholder={jiraProjectSelectPlaceholder(
                jiraConnectionId,
                isLoadingProjects
              )}
            />
          </SelectTrigger>
          <SelectContent>
            {jiraProjects.map((project) => (
              <SelectItem key={project.id} value={project.key}>
                {project.key} — {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {footerHint ? (
        <p className="text-muted-foreground text-xs">{footerHint}</p>
      ) : null}
    </div>
  );
}
