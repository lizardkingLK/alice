import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GithubAppSetupRedirect } from '@/app/integrations/github/setup/github-app-setup-redirect';
import {
  buildGithubAppCallbackUrl,
  resolvePublicApiBaseUrl,
} from '@/app/integrations/github/_lib/github-app-setup';

let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

describe('github-app-setup helpers', () => {
  it('builds API callback URL from setup query params', () => {
    const url = buildGithubAppCallbackUrl(
      'installation_id=99&state=abc&setup_action=install',
      'http://localhost:5000/'
    );
    expect(url).toBe(
      'http://localhost:5000/api/github/app/callback?installation_id=99&state=abc&setup_action=install'
    );
  });

  it('resolves public API base URL and strips trailing slash', () => {
    expect(resolvePublicApiBaseUrl('http://localhost:5000/')).toBe(
      'http://localhost:5000'
    );
    expect(resolvePublicApiBaseUrl('')).toBeNull();
    expect(resolvePublicApiBaseUrl('   ')).toBeNull();
  });
});

describe('GithubAppSetupRedirect', () => {
  const originalReplace = window.location.replace;

  beforeEach(() => {
    mockSearchParams = new URLSearchParams(
      'installation_id=999001&state=signed-state&setup_action=install'
    );
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:5000');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        replace: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, replace: originalReplace },
    });
  });

  it('redirects to the API App callback with install query params', () => {
    render(<GithubAppSetupRedirect />);

    expect(
      screen.getByText(/Finishing GitHub App install/i)
    ).toBeInTheDocument();
    expect(window.location.replace).toHaveBeenCalledWith(
      'http://localhost:5000/api/github/app/callback?installation_id=999001&state=signed-state&setup_action=install'
    );
  });

  it('shows an error when installation_id or state is missing', () => {
    mockSearchParams = new URLSearchParams('setup_action=install');

    render(<GithubAppSetupRedirect />);

    expect(
      screen.getByRole('heading', { name: /Could not finish install/i })
    ).toBeInTheDocument();
    expect(window.location.replace).not.toHaveBeenCalled();
  });
});
