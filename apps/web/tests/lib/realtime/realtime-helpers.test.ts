import { describe, expect, it } from 'vitest';
import { rowFromRealtimePayload } from '@/lib/realtime/realtime-change-row';
import { resolveRealtimeUserLookup } from '@/lib/realtime/realtime-user-lookup';

describe('rowFromRealtimePayload', () => {
  it('prefers old on DELETE', () => {
    expect(
      rowFromRealtimePayload('DELETE', { id: 'new' }, { id: 'old' })
    ).toEqual({ id: 'old' });
  });

  it('prefers new on INSERT/UPDATE', () => {
    expect(
      rowFromRealtimePayload('INSERT', { id: 'new' }, { id: 'old' })
    ).toEqual({ id: 'new' });
    expect(rowFromRealtimePayload('UPDATE', { id: 'new' }, null)).toEqual({
      id: 'new',
    });
  });
});

describe('resolveRealtimeUserLookup', () => {
  it('returns Unknown when missing', () => {
    expect(resolveRealtimeUserLookup('u-1', [])).toEqual({
      id: 'u-1',
      name: 'Unknown',
      email: '',
      profile_picture: null,
    });
  });

  it('maps a known user', () => {
    expect(
      resolveRealtimeUserLookup('u-1', [
        { id: 'u-1', name: 'Ada', email: 'a@x.com', profile_picture: null },
      ])
    ).toMatchObject({ id: 'u-1', name: 'Ada', email: 'a@x.com' });
  });
});
