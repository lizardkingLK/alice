import { afterEach, describe, expect, it } from 'vitest';
import {
  getDataRetrievalStrategy,
  isDataRetrievalApiDomain,
  parseDataReadsViaApiFlag,
  shouldReadViaApi,
} from '@/lib/data-retrieval.server';

const originalFlag = process.env.DATA_READS_VIA_API;
const originalCi = process.env.GITHUB_ACTIONS;

describe('parseDataReadsViaApiFlag', () => {
  it('is false when unset or empty', () => {
    expect(parseDataReadsViaApiFlag(undefined, false)).toBe(false);
    expect(parseDataReadsViaApiFlag('', false)).toBe(false);
    expect(parseDataReadsViaApiFlag('  ', false)).toBe(false);
  });

  it('accepts true / 1 / yes case-insensitively', () => {
    expect(parseDataReadsViaApiFlag('true', false)).toBe(true);
    expect(parseDataReadsViaApiFlag('TRUE', false)).toBe(true);
    expect(parseDataReadsViaApiFlag('1', false)).toBe(true);
    expect(parseDataReadsViaApiFlag('yes', false)).toBe(true);
  });

  it('rejects junk and explicit false', () => {
    expect(parseDataReadsViaApiFlag('false', false)).toBe(false);
    expect(parseDataReadsViaApiFlag('no', false)).toBe(false);
    expect(parseDataReadsViaApiFlag('on', false)).toBe(false);
  });

  it('stays false in CI even when the flag is true', () => {
    expect(parseDataReadsViaApiFlag('true', true)).toBe(false);
  });
});

describe('getDataRetrievalStrategy / shouldReadViaApi', () => {
  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.DATA_READS_VIA_API;
    } else {
      process.env.DATA_READS_VIA_API = originalFlag;
    }

    if (originalCi === undefined) {
      delete process.env.GITHUB_ACTIONS;
    } else {
      process.env.GITHUB_ACTIONS = originalCi;
    }
  });

  it('defaults to ssr', () => {
    delete process.env.DATA_READS_VIA_API;
    process.env.GITHUB_ACTIONS = 'false';

    expect(getDataRetrievalStrategy()).toBe('ssr');
    expect(shouldReadViaApi('work-items')).toBe(false);
  });

  it('switches allowlisted work-items to api when the flag is on', () => {
    process.env.DATA_READS_VIA_API = 'true';
    process.env.GITHUB_ACTIONS = 'false';

    expect(getDataRetrievalStrategy()).toBe('api');
    expect(shouldReadViaApi('work-items')).toBe(true);
  });

  it('does not honor the flag in CI', () => {
    process.env.DATA_READS_VIA_API = 'true';
    process.env.GITHUB_ACTIONS = 'true';

    expect(getDataRetrievalStrategy()).toBe('ssr');
    expect(shouldReadViaApi('work-items')).toBe(false);
  });
});

describe('isDataRetrievalApiDomain', () => {
  it('allowlists work-items only', () => {
    expect(isDataRetrievalApiDomain('work-items')).toBe(true);
    expect(isDataRetrievalApiDomain('users')).toBe(false);
    expect(isDataRetrievalApiDomain('projects')).toBe(false);
  });
});
