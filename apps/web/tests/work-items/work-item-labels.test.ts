import { describe, expect, it } from 'vitest';
import {
  WORK_ITEM_LABEL_MAX_LENGTH,
  WORK_ITEM_LABELS_MAX_COUNT,
  buildWorkItemSearchOrFilter,
  classifyWorkItemSearchMatch,
  coerceLabelsFormField,
  normalizeWorkItemLabels,
  WorkItemLabelsValidationError,
} from '@repo/types';
import {
  categorizeWorkItemSearchResults,
  highlightSearchInTitle,
} from '@/app/work-items/_helpers/work-item-search-results';

describe('normalizeWorkItemLabels', () => {
  it('trims, drops empties, and keeps case-sensitive uniqueness', () => {
    expect(normalizeWorkItemLabels(['  Alpha ', 'Beta', 'Alpha', ''])).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('parses JSON strings from FormData', () => {
    expect(normalizeWorkItemLabels('["Mobile","Desktop"]')).toEqual([
      'Mobile',
      'Desktop',
    ]);
  });

  it('rejects overlong labels', () => {
    expect(() =>
      normalizeWorkItemLabels(['a'.repeat(WORK_ITEM_LABEL_MAX_LENGTH + 1)])
    ).toThrow(WorkItemLabelsValidationError);
  });

  it('rejects too many labels', () => {
    const tooMany = Array.from(
      { length: WORK_ITEM_LABELS_MAX_COUNT + 1 },
      (_, i) => `L${i}`
    );
    expect(() => normalizeWorkItemLabels(tooMany)).toThrow(
      WorkItemLabelsValidationError
    );
  });
});

describe('coerceLabelsFormField', () => {
  it('parses JSON strings and maps empty to []', () => {
    expect(coerceLabelsFormField('["A"]')).toEqual(['A']);
    expect(coerceLabelsFormField('  ')).toEqual([]);
    expect(coerceLabelsFormField('not-json')).toBe('not-json');
    expect(coerceLabelsFormField(['A'])).toEqual(['A']);
  });
});

describe('classifyWorkItemSearchMatch', () => {
  it('matches title case-insensitively and labels case-sensitively', () => {
    const item = { title: 'Fix Mobile Login', labels: ['Mobile', 'auth'] };

    expect(classifyWorkItemSearchMatch(item, 'mobile')).toEqual({
      titleMatch: true,
      labelMatch: false,
      matchedLabels: [],
    });

    expect(classifyWorkItemSearchMatch(item, 'Mobile')).toEqual({
      titleMatch: true,
      labelMatch: true,
      matchedLabels: ['Mobile'],
    });
  });
});

describe('buildWorkItemSearchOrFilter', () => {
  it('builds title ilike and labels cs filter', () => {
    expect(buildWorkItemSearchOrFilter('Mobile')).toBe(
      'title.ilike.%Mobile%,labels.cs.["Mobile"]'
    );
  });

  it('strips commas from the ilike pattern', () => {
    expect(buildWorkItemSearchOrFilter('a,b')).toBe(
      'title.ilike.%ab%,labels.cs.["a,b"]'
    );
  });
});

describe('categorizeWorkItemSearchResults / highlightSearchInTitle', () => {
  const items = [
    { id: '1', title: 'Mobile checkout', labels: ['backend'] },
    { id: '2', title: 'Desktop polish', labels: ['Mobile'] },
  ];

  it('categorizes title and label groups', () => {
    const result = categorizeWorkItemSearchResults(items, 'Mobile');
    expect(result.titleMatches.map((i) => i.id)).toEqual(['1']);
    expect(result.labelMatches.map((i) => i.id)).toEqual(['2']);
    expect(result.labelMatches[0]?.matchedLabels).toEqual(['Mobile']);
  });

  it('highlights title substrings', () => {
    expect(highlightSearchInTitle('Fix Mobile Login', 'mobile')).toEqual([
      { text: 'Fix ', highlight: false },
      { text: 'Mobile', highlight: true },
      { text: ' Login', highlight: false },
    ]);
  });
});
