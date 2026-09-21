import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JiraOAuthDonePage from '@/app/integrations/jira/done/page';
import GithubOAuthDonePage from '@/app/integrations/github/done/page';
import {
  IntegrationOAuthProvider,
  OAuthCompletionStatus,
  OAuthMessageType,
  subscribeToOAuthCompletion,
  createOAuthCompletionMessage,
} from '@/app/integrations/_types/oauth-completion.types';

let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

describe('OAuth Completion Pages', () => {
  const originalClose = window.close;
  let postMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    window.close = vi.fn();
    postMessageSpy = vi.fn();
    window.opener = {
      closed: false,
      postMessage: postMessageSpy,
    } as unknown as Window;
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.close = originalClose;
    delete (window as unknown as { opener?: unknown }).opener;
  });

  describe('JiraOAuthDonePage (/integrations/jira/done)', () => {
    it('shows Connected Successfully message and notifies opener when jira=connected', () => {
      mockSearchParams = new URLSearchParams('jira=connected');

      render(<JiraOAuthDonePage />);

      expect(
        screen.getByRole('heading', { name: /Connected Successfully/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Your Jira account has been connected to Alice/i)
      ).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Close Window/i })
      ).toBeInTheDocument();

      // Verifies notification sent to opener
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: OAuthMessageType.OAuthComplete,
          provider: IntegrationOAuthProvider.Jira,
          status: OAuthCompletionStatus.Connected,
        }),
        window.location.origin
      );

      // Closes window when user clicks Close Window button
      fireEvent.click(screen.getByRole('button', { name: /Close Window/i }));
      expect(window.close).toHaveBeenCalledTimes(1);
    });

    it('handles cancelled authentication when jira=denied', () => {
      mockSearchParams = new URLSearchParams('jira=denied');

      render(<JiraOAuthDonePage />);

      expect(
        screen.getByRole('heading', { name: /Authentication Cancelled/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/authorization was cancelled or denied/i)
      ).toBeInTheDocument();
      expect(screen.getByText('Cancelled')).toBeInTheDocument();

      // Clicking Close Window manually closes
      fireEvent.click(screen.getByRole('button', { name: /Close Window/i }));
      expect(window.close).toHaveBeenCalledTimes(1);
    });

    it('handles error with detail message when jira=error', () => {
      mockSearchParams = new URLSearchParams(
        'jira=error&error=Invalid+OAuth+state'
      );

      render(<JiraOAuthDonePage />);

      expect(
        screen.getByRole('heading', { name: /Connection Failed/i })
      ).toBeInTheDocument();
      expect(screen.getByText('Invalid OAuth state')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  describe('GithubOAuthDonePage (/integrations/github/done)', () => {
    it('shows Connected Successfully message and notifies opener when github=connected', () => {
      mockSearchParams = new URLSearchParams('github=connected');

      render(<GithubOAuthDonePage />);

      expect(
        screen.getByRole('heading', { name: /Connected Successfully/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Your GitHub account has been connected to Alice/i)
      ).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: OAuthMessageType.OAuthComplete,
          provider: IntegrationOAuthProvider.GitHub,
          status: OAuthCompletionStatus.Connected,
        }),
        window.location.origin
      );

      // User manually closes window via button
      fireEvent.click(screen.getByRole('button', { name: /Close Window/i }));
      expect(window.close).toHaveBeenCalledTimes(1);
    });

    it('handles cancelled authentication when github=denied', () => {
      mockSearchParams = new URLSearchParams('github=denied');

      render(<GithubOAuthDonePage />);

      expect(
        screen.getByRole('heading', { name: /Authentication Cancelled/i })
      ).toBeInTheDocument();
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });

    it('handles error when github=error', () => {
      mockSearchParams = new URLSearchParams(
        'github=error&error=Bad+verification+code'
      );

      render(<GithubOAuthDonePage />);

      expect(
        screen.getByRole('heading', { name: /Connection Failed/i })
      ).toBeInTheDocument();
      expect(screen.getByText('Bad verification code')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  describe('subscribeToOAuthCompletion helper', () => {
    it('notifies subscribers on window message event', () => {
      const onComplete = vi.fn();
      const unsubscribe = subscribeToOAuthCompletion(
        IntegrationOAuthProvider.Jira,
        onComplete
      );

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            type: OAuthMessageType.OAuthComplete,
            provider: IntegrationOAuthProvider.Jira,
            status: OAuthCompletionStatus.Connected,
          },
        })
      );

      expect(onComplete).toHaveBeenCalledWith(
        OAuthCompletionStatus.Connected,
        undefined
      );

      unsubscribe();
    });

    it('ignores message from untrusted origins or other providers', () => {
      const onComplete = vi.fn();
      const unsubscribe = subscribeToOAuthCompletion(
        IntegrationOAuthProvider.Jira,
        onComplete
      );

      // Wrong origin
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://evil.com',
          data: {
            type: OAuthMessageType.OAuthComplete,
            provider: IntegrationOAuthProvider.Jira,
            status: OAuthCompletionStatus.Connected,
          },
        })
      );

      // Other provider
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            type: OAuthMessageType.OAuthComplete,
            provider: IntegrationOAuthProvider.GitHub,
            status: OAuthCompletionStatus.Connected,
          },
        })
      );

      expect(onComplete).not.toHaveBeenCalled();

      unsubscribe();
    });

    it('notifies subscribers on storage event fallback', () => {
      const onComplete = vi.fn();
      const unsubscribe = subscribeToOAuthCompletion(
        IntegrationOAuthProvider.GitHub,
        onComplete
      );

      const msg = createOAuthCompletionMessage(
        IntegrationOAuthProvider.GitHub,
        OAuthCompletionStatus.Connected
      );

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'alice_oauth_event',
          newValue: JSON.stringify(msg),
        })
      );

      expect(onComplete).toHaveBeenCalledWith(
        OAuthCompletionStatus.Connected,
        null
      );

      unsubscribe();
    });
  });
});
