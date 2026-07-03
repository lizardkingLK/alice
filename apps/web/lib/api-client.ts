import { createClient } from '@/lib/supabase/client';

export type Sprint = {
  id: string;
  name: string;
  goal: string | null;
  status: 'Not Started' | 'Ongoing' | 'Completed' | 'Archived';
  startDate: string;
  endDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: string;
    name: string;
    key: string;
  } | null;
};

type ApiErrorResponse = {
  error: unknown;
};

async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be signed in to perform this action.');
  }

  return session.access_token;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  const data: T | ApiErrorResponse = await response.json();

  if (!response.ok) {
    const message = getApiErrorMessage(data);
    throw new Error(message);
  }

  return data as T;
}

function getApiErrorMessage(data: unknown): string {
  if (typeof data !== 'object' || data === null || !('error' in data)) {
    return 'Request failed. Please try again.';
  }

  const { error } = data;

  return typeof error === 'string'
    ? error
    : 'Request failed. Please try again.';
}

export type CreateSprintInput = {
  name: string;
  goal?: string | null;
  projectId: string;
  startDate: string;
  endDate: string;
};

export async function createSprint(input: CreateSprintInput): Promise<Sprint> {
  const data = await apiFetch<{ sprint: Sprint }>('/api/sprints', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return data.sprint;
}

export async function listSprints(): Promise<Sprint[]> {
  const data = await apiFetch<{ sprints: Sprint[] }>('/api/sprints');
  return data.sprints;
}

export async function updateSprintStatus(
  id: string,
  status: Sprint['status']
): Promise<Sprint> {
  const data = await apiFetch<{ sprint: Sprint }>(`/api/sprints/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

  return data.sprint;
}
