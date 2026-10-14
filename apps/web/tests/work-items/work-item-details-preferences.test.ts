import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WORK_ITEM_DETAILS_PREFERENCES,
  WORK_ITEM_DETAILS_PREFS_COOKIE,
  encodeWorkItemDetailsPreferencesCookie,
  normalizeWorkItemDetailsPreferences,
  parseWorkItemDetailsPreferencesCookie,
  readWorkItemDetailsPreferences,
  readWorkItemDetailsPreferencesLocal,
  writeWorkItemDetailsPreferences,
  workItemDetailsPreferencesEquals,
} from '@/app/work-items/_helpers/work-item-details-preferences';

describe('work-item-details-preferences', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { cookie: '' });
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('defaults banner to state color and title icon to type', () => {
    expect(DEFAULT_WORK_ITEM_DETAILS_PREFERENCES.bannerColor).toBe('state');
    expect(DEFAULT_WORK_ITEM_DETAILS_PREFERENCES.titleIcon).toBe('type');
    expect(DEFAULT_WORK_ITEM_DETAILS_PREFERENCES.sections.discussion).toBe(
      true
    );
  });

  it('normalizes partial and invalid blobs to defaults', () => {
    const normalized = normalizeWorkItemDetailsPreferences({
      bannerColor: 'nope',
      titleIcon: 'type',
      sections: { discussion: false },
      detailsFields: { assignee: false },
    });

    expect(normalized.bannerColor).toBe('state');
    expect(normalized.titleIcon).toBe('type');
    expect(normalized.sections.discussion).toBe(false);
    expect(normalized.sections.details).toBe(true);
    expect(normalized.sections.attachments).toBe(true);
    expect(normalized.sections.development).toBe(true);
    expect(normalized.sections.subtasks).toBe(true);
    expect(normalized.detailsFields.assignee).toBe(false);
    expect(normalized.detailsFields.priority).toBe(true);
  });

  it('returns null from local read when nothing is stored', () => {
    expect(readWorkItemDetailsPreferencesLocal('user-1')).toBeNull();
    expect(readWorkItemDetailsPreferences('user-1')).toEqual(
      normalizeWorkItemDetailsPreferences(DEFAULT_WORK_ITEM_DETAILS_PREFERENCES)
    );
  });

  it('writes cookie and localStorage together', () => {
    const next = normalizeWorkItemDetailsPreferences({
      ...DEFAULT_WORK_ITEM_DETAILS_PREFERENCES,
      bannerColor: 'type',
      titleIcon: 'none',
      sections: {
        ...DEFAULT_WORK_ITEM_DETAILS_PREFERENCES.sections,
        linkedIssues: false,
      },
    });

    writeWorkItemDetailsPreferences('user-1', next);

    expect(document.cookie).toContain(`${WORK_ITEM_DETAILS_PREFS_COOKIE}=`);
    expect(readWorkItemDetailsPreferencesLocal('user-1')).toEqual(next);
  });

  it('round-trips cookie encoding', () => {
    const prefs = normalizeWorkItemDetailsPreferences({
      ...DEFAULT_WORK_ITEM_DETAILS_PREFERENCES,
      moreFieldsItems: {
        ...DEFAULT_WORK_ITEM_DETAILS_PREFERENCES.moreFieldsItems,
        shortId: false,
      },
    });
    const encoded = encodeWorkItemDetailsPreferencesCookie(prefs);
    expect(parseWorkItemDetailsPreferencesCookie(encoded)).toEqual(prefs);
  });

  it('compares preference equality by value', () => {
    const left = normalizeWorkItemDetailsPreferences(
      DEFAULT_WORK_ITEM_DETAILS_PREFERENCES
    );
    const right = normalizeWorkItemDetailsPreferences({
      ...DEFAULT_WORK_ITEM_DETAILS_PREFERENCES,
    });
    expect(workItemDetailsPreferencesEquals(left, right)).toBe(true);
    expect(
      workItemDetailsPreferencesEquals(left, {
        ...right,
        titleIcon: 'state',
      })
    ).toBe(false);
  });
});
