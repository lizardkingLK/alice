import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearProjectCreationDraft,
  PROJECT_CREATION_DRAFT_VERSION,
  projectCreationDraftStorageKey,
  readProjectCreationDraft,
  saveProjectCreationDraft,
  validateProjectCreationDraft,
  type ProjectCreationDraft,
} from '@/app/projects/_helpers/project-creation-draft-storage';

function createDraft(): ProjectCreationDraft {
  return {
    version: PROJECT_CREATION_DRAFT_VERSION,
    currentStep: 4,
    basicInfo: {
      name: 'Draft Project',
      key: 'DRAFT',
      description: 'Saved project details',
      selectedOwnerId: 'user-manager',
      status: 'active',
      startDate: '2099-01-01',
      endDate: '2099-02-01',
      selectedWorkItemTypes: ['Epic', 'Feature', 'Story'],
    },
    imports: {
      importFromJira: true,
      jiraConnectionId: 'jira-connection-1',
      jiraProjectKey: 'ALICE',
    },
    sourceControl: {
      enableGithub: true,
      githubOwner: 'alice-org',
      githubRepoName: 'alice-web',
    },
    sprint: {
      createInitialSprint: true,
      sprintName: 'Sprint 1',
      sprintGoal: 'Ship the first version',
      sprintStartDate: '2099-01-01',
      sprintEndDate: '2099-01-14',
    },
    team: {
      createInitialTeam: true,
      teamName: 'Platform Team',
      teamDescription: 'Builds Alice',
      teamManagerId: 'user-manager',
      teamTechStack: 'TypeScript',
      teamMemberIds: ['user-member'],
    },
  };
}

describe('project creation draft storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and reads a valid draft', () => {
    const draft = createDraft();

    expect(saveProjectCreationDraft('user-1', draft)).toBe(true);
    expect(readProjectCreationDraft('user-1')).toEqual(draft);
  });

  it('uses versioned user-specific keys and isolates users', () => {
    const userOneDraft = createDraft();
    const userTwoDraft = {
      ...createDraft(),
      basicInfo: { ...createDraft().basicInfo, name: 'User Two Draft' },
    };
    const userOneKey = projectCreationDraftStorageKey('user-1');
    const userTwoKey = projectCreationDraftStorageKey('user-2');

    expect(userOneKey).toBe('alice:project-creation-draft:v1:user-1');
    expect(userTwoKey).toBe('alice:project-creation-draft:v1:user-2');
    expect(saveProjectCreationDraft('user-1', userOneDraft)).toBe(true);
    expect(readProjectCreationDraft('user-2')).toBeNull();

    expect(saveProjectCreationDraft('user-2', userTwoDraft)).toBe(true);
    expect(readProjectCreationDraft('user-1')?.basicInfo.name).toBe(
      'Draft Project'
    );
    expect(readProjectCreationDraft('user-2')?.basicInfo.name).toBe(
      'User Two Draft'
    );
  });

  it.each([undefined, null, '', '   '])(
    'rejects the missing or blank user ID %j',
    (userId) => {
      expect(saveProjectCreationDraft(userId, createDraft())).toBe(false);
      expect(readProjectCreationDraft(userId)).toBeNull();
      expect(clearProjectCreationDraft(userId)).toBe(false);
      expect(localStorage).toHaveLength(0);
    }
  );

  it('rejects invalid draft structures', () => {
    const invalidDraft = {
      ...createDraft(),
      basicInfo: { ...createDraft().basicInfo, name: 42 },
    };

    expect(validateProjectCreationDraft(invalidDraft)).toBeNull();
    expect(
      saveProjectCreationDraft(
        'user-1',
        invalidDraft as unknown as ProjectCreationDraft
      )
    ).toBe(false);
    expect(localStorage).toHaveLength(0);
  });

  it('handles corrupt JSON without throwing', () => {
    const storageKey = projectCreationDraftStorageKey('user-1');
    localStorage.setItem(storageKey, '{not-valid-json');

    expect(() => readProjectCreationDraft('user-1')).not.toThrow();
    expect(readProjectCreationDraft('user-1')).toBeNull();
  });

  it.each([0, 6, -1, 2.5])('rejects unsupported wizard step %s', (step) => {
    const invalidDraft = { ...createDraft(), currentStep: step };

    expect(validateProjectCreationDraft(invalidDraft)).toBeNull();
  });

  it.each([
    ['invalid format', { startDate: '01/01/2099' }, {}],
    ['impossible basic date', { endDate: '2099-02-30' }, {}],
    ['impossible sprint date', {}, { sprintStartDate: '2099-13-01' }],
  ])('rejects %s', (_label, basicInfoDates, sprintDates) => {
    const draft = createDraft();
    const invalidDraft = {
      ...draft,
      basicInfo: { ...draft.basicInfo, ...basicInfoDates },
      sprint: { ...draft.sprint, ...sprintDates },
    };

    expect(validateProjectCreationDraft(invalidDraft)).toBeNull();
  });

  it('accepts empty optional date fields', () => {
    const draft = createDraft();
    const draftWithEmptyDates = {
      ...draft,
      basicInfo: { ...draft.basicInfo, startDate: '', endDate: '' },
      sprint: { ...draft.sprint, sprintStartDate: '', sprintEndDate: '' },
    };

    expect(validateProjectCreationDraft(draftWithEmptyDates)).toEqual(
      draftWithEmptyDates
    );
  });

  it('strips unknown fields and never persists credential fields', () => {
    const draft = createDraft();
    const draftWithCredentials = {
      ...draft,
      githubToken: 'top-level-secret',
      credentials: { opaqueValue: 'credential-secret' },
      sourceControl: {
        ...draft.sourceControl,
        githubToken: 'github-secret',
        accessToken: 'access-secret',
      },
    };

    const validated = validateProjectCreationDraft(draftWithCredentials);
    expect(validated).not.toHaveProperty('githubToken');
    expect(validated).not.toHaveProperty('credentials');
    expect(validated).not.toHaveProperty('sourceControl.githubToken');
    expect(validated).not.toHaveProperty('sourceControl.accessToken');

    expect(
      saveProjectCreationDraft(
        'user-1',
        draftWithCredentials as ProjectCreationDraft
      )
    ).toBe(true);
    const stored = localStorage.getItem(
      projectCreationDraftStorageKey('user-1')
    );
    expect(stored).not.toContain('top-level-secret');
    expect(stored).not.toContain('credential-secret');
    expect(stored).not.toContain('github-secret');
    expect(stored).not.toContain('access-secret');
  });

  it('does not crash when localStorage is unavailable', () => {
    const storageGetter = vi
      .spyOn(window, 'localStorage', 'get')
      .mockImplementation(() => {
        throw new Error('Storage unavailable');
      });

    expect(() =>
      saveProjectCreationDraft('user-1', createDraft())
    ).not.toThrow();
    expect(saveProjectCreationDraft('user-1', createDraft())).toBe(false);
    expect(readProjectCreationDraft('user-1')).toBeNull();
    expect(clearProjectCreationDraft('user-1')).toBe(false);

    storageGetter.mockRestore();
  });

  it('returns false instead of throwing on storage quota errors', () => {
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(() =>
      saveProjectCreationDraft('user-1', createDraft())
    ).not.toThrow();
    expect(saveProjectCreationDraft('user-1', createDraft())).toBe(false);
    setItem.mockRestore();
  });

  it('clears a saved draft successfully', () => {
    expect(saveProjectCreationDraft('user-1', createDraft())).toBe(true);

    expect(clearProjectCreationDraft('user-1')).toBe(true);
    expect(readProjectCreationDraft('user-1')).toBeNull();
  });

  it('reports failed cleanup without deleting the existing draft', () => {
    const draft = createDraft();
    expect(saveProjectCreationDraft('user-1', draft)).toBe(true);
    const removeItem = vi
      .spyOn(localStorage, 'removeItem')
      .mockImplementation(() => {
        throw new Error('Storage removal failed');
      });

    expect(clearProjectCreationDraft('user-1')).toBe(false);
    removeItem.mockRestore();
    expect(readProjectCreationDraft('user-1')).toEqual(draft);
  });
});
