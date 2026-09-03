import { describe, it, expect } from 'vitest';
import {
  parseGithubRepoPath,
  formatGithubRepoPath,
} from '@/lib/projects/github-repo-path';

describe('github-repo-path utilities', () => {
  describe('parseGithubRepoPath', () => {
    it('returns empty strings for null, undefined, or empty input', () => {
      expect(parseGithubRepoPath(null)).toEqual({ owner: '', repoName: '' });
      expect(parseGithubRepoPath(undefined)).toEqual({ owner: '', repoName: '' });
      expect(parseGithubRepoPath('')).toEqual({ owner: '', repoName: '' });
      expect(parseGithubRepoPath('   ')).toEqual({ owner: '', repoName: '' });
    });

    it('parses owner/repo path', () => {
      expect(parseGithubRepoPath('facebook/react')).toEqual({
        owner: 'facebook',
        repoName: 'react',
      });
    });

    it('parses full https and http URLs', () => {
      expect(
        parseGithubRepoPath('https://github.com/facebook/react')
      ).toEqual({
        owner: 'facebook',
        repoName: 'react',
      });

      expect(
        parseGithubRepoPath('https://github.com/vercel/next.js')
      ).toEqual({
        owner: 'vercel',
        repoName: 'next.js',
      });
    });

    it('parses URLs with .git extension, query params, and trailing slashes', () => {
      expect(
        parseGithubRepoPath('https://github.com/facebook/react.git/')
      ).toEqual({
        owner: 'facebook',
        repoName: 'react',
      });

      expect(
        parseGithubRepoPath('https://github.com/tailwindlabs/tailwindcss?tab=readme-ov-file#readme')
      ).toEqual({
        owner: 'tailwindlabs',
        repoName: 'tailwindcss',
      });
    });

    it('parses git SSH format URIs', () => {
      expect(
        parseGithubRepoPath('git@github.com:facebook/react.git')
      ).toEqual({
        owner: 'facebook',
        repoName: 'react',
      });
    });

    it('parses URLs with extra path components', () => {
      expect(
        parseGithubRepoPath('https://github.com/facebook/react/pull/123')
      ).toEqual({
        owner: 'facebook',
        repoName: 'react',
      });
    });
  });

  describe('formatGithubRepoPath', () => {
    it('joins owner and repoName', () => {
      expect(formatGithubRepoPath('facebook', 'react')).toBe('facebook/react');
    });

    it('handles owner string that contains full URL', () => {
      expect(
        formatGithubRepoPath('https://github.com/facebook/react', '')
      ).toBe('facebook/react');
    });

    it('returns null if either side is missing', () => {
      expect(formatGithubRepoPath('facebook', '')).toBeNull();
      expect(formatGithubRepoPath('', 'react')).toBeNull();
    });
  });
});
