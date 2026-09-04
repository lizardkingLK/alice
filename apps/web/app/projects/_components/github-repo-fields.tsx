'use client';

import { useEffect, useState } from 'react';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { parseGithubRepoPath } from '@/lib/projects/github-repo-path';

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
 * Shared repository URL & optional PAT inputs for Source Control integration.
 * Users enter the GitHub Repository URL, which is automatically split into owner & repoName.
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
  const [githubUrl, setGithubUrl] = useState(() => {
    if (githubOwner && githubRepoName) {
      return `https://github.com/${githubOwner}/${githubRepoName}`;
    }
    return '';
  });

  useEffect(() => {
    if (githubOwner && githubRepoName) {
      const currentParsed = parseGithubRepoPath(githubUrl);
      if (
        currentParsed.owner !== githubOwner ||
        currentParsed.repoName !== githubRepoName
      ) {
        setGithubUrl(`https://github.com/${githubOwner}/${githubRepoName}`);
      }
    } else if (!githubOwner && !githubRepoName && githubUrl) {
      setGithubUrl('');
    }
  }, [githubOwner, githubRepoName, githubUrl]);

  const handleUrlChange = (value: string) => {
    setGithubUrl(value);
    const { owner, repoName } = parseGithubRepoPath(value);
    setGithubOwner(owner);
    setGithubRepoName(repoName);
  };

  return (
    <div className="flex flex-col justify-start space-y-4">
      <div className="space-y-2">
        <Label htmlFor="githubUrl" className="text-xs font-semibold">
          GitHub Repository URL
        </Label>
        <Input
          id="githubUrl"
          value={githubUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="e.g. https://github.com/facebook/react"
          className="bg-background/50 h-9 text-sm"
          required={required}
        />
        <p className="text-muted-foreground text-[11px]">
          Enter or paste a GitHub repository URL (e.g.
          https://github.com/owner/repository).
        </p>
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
