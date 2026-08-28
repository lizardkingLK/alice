'use client';

import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';

export type GithubRepoFieldsProps = {
  githubOwner: string;
  // eslint-disable-next-line no-unused-vars
  setGithubOwner: (owner: string) => void;
  githubRepoName: string;
  // eslint-disable-next-line no-unused-vars
  setGithubRepoName: (repoName: string) => void;
  githubToken: string;
  // eslint-disable-next-line no-unused-vars
  setGithubToken: (token: string) => void;
  /** Write-only hint when a PAT already exists server-side. */
  tokenPlaceholder?: string;
  required?: boolean;
};

/**
 * Shared owner / repo / optional PAT inputs for create Source Control and details Integrations.
 */
export function GithubRepoFields({
  githubOwner,
  setGithubOwner,
  githubRepoName,
  setGithubRepoName,
  githubToken,
  setGithubToken,
  tokenPlaceholder = 'e.g. ghp_xxxxxxxxxxxx',
  required = true,
}: Readonly<GithubRepoFieldsProps>) {
  return (
    <div className="flex flex-col justify-start space-y-4">
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
            required={required}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="githubRepoName" className="text-xs font-semibold">
            GitHub Repository Name
          </Label>
          <Input
            id="githubRepoName"
            value={githubRepoName}
            onChange={(e) => setGithubRepoName(e.target.value)}
            placeholder="e.g. react"
            className="bg-background/50 h-9 text-sm"
            required={required}
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
          placeholder={tokenPlaceholder}
          className="bg-background/50 custom-secret-text h-9 text-sm"
        />
      </div>
    </div>
  );
}
