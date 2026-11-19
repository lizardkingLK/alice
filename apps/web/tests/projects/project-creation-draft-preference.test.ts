import { beforeEach, describe, expect, it } from 'vitest';
import {
  projectCreationDraftAutoStorageKey,
  readProjectCreationDraftAuto,
  writeProjectCreationDraftAuto,
} from '@/app/projects/_helpers/project-creation-draft-preference';

describe('project creation draft auto preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to off when nothing is stored', () => {
    expect(readProjectCreationDraftAuto('user-1')).toBe(false);
  });

  it('persists per-user toggle values', () => {
    writeProjectCreationDraftAuto('user-1', true);
    expect(readProjectCreationDraftAuto('user-1')).toBe(true);
    expect(
      JSON.parse(
        localStorage.getItem(projectCreationDraftAutoStorageKey('user-1')) ??
          'null'
      )
    ).toBe(true);

    writeProjectCreationDraftAuto('user-1', false);
    expect(readProjectCreationDraftAuto('user-1')).toBe(false);
    expect(readProjectCreationDraftAuto('user-2')).toBe(false);
  });

  it('ignores corrupt stored values', () => {
    localStorage.setItem(
      projectCreationDraftAutoStorageKey('user-1'),
      '"sometimes"'
    );
    expect(readProjectCreationDraftAuto('user-1')).toBe(false);
  });
});
