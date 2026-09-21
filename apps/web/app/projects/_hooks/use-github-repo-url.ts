'use client';

import { useEffect, useState } from 'react';
import { parseGithubRepoPath } from '@/lib/projects/github-repo-path';

export type UseGithubRepoUrlOptions = {
  githubOwner: string;
  // eslint-disable-next-line no-unused-vars
  setGithubOwner: (owner: string) => void;
  githubRepoName: string;
  // eslint-disable-next-line no-unused-vars
  setGithubRepoName: (repoName: string) => void;
};

export type UseGithubRepoUrlResult = {
  githubUrl: string;
  // eslint-disable-next-line no-unused-vars
  setGithubUrl: (url: string) => void;
  // eslint-disable-next-line no-unused-vars
  handleUrlChange: (value: string) => void;
};

/**
 * Synchronizes GitHub repository URL input with owner and repoName state,
 * parsing pasted or typed URLs automatically.
 */
export function useGithubRepoUrl({
  githubOwner,
  setGithubOwner,
  githubRepoName,
  setGithubRepoName,
}: Readonly<UseGithubRepoUrlOptions>): UseGithubRepoUrlResult {
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

  return {
    githubUrl,
    setGithubUrl,
    handleUrlChange,
  };
}
