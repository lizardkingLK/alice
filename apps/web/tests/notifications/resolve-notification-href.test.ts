import { describe, expect, it } from 'vitest';
import {
  resolveNotificationHref,
  VIEW_SHARED_FALLBACK_HREF,
} from '@/lib/notifications/resolve-notification-href';

describe('resolveNotificationHref', () => {
  it('returns null without a related item', () => {
    expect(
      resolveNotificationHref({ type: 'assign', related_item_id: null }, null)
    ).toBeNull();
  });

  it('routes work-item notifications to /work-items/:id', () => {
    expect(
      resolveNotificationHref({ type: 'assign', related_item_id: 'wi-1' }, null)
    ).toBe('/work-items/wi-1');
  });

  it('routes view_shared to the saved view href when active', () => {
    expect(
      resolveNotificationHref(
        { type: 'view_shared', related_item_id: 'view-1' },
        {
          pathname: '/work-items',
          search: 'project=abc',
          status: 'active',
        }
      )
    ).toBe('/work-items?project=abc');
  });

  it('falls back for missing or archived shared views', () => {
    expect(
      resolveNotificationHref(
        { type: 'view_shared', related_item_id: 'view-1' },
        null
      )
    ).toBe(VIEW_SHARED_FALLBACK_HREF);
    expect(
      resolveNotificationHref(
        { type: 'view_shared', related_item_id: 'view-1' },
        {
          pathname: '/backlog',
          search: '',
          status: 'archived',
        }
      )
    ).toBe(VIEW_SHARED_FALLBACK_HREF);
  });
});
