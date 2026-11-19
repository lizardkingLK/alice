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

  it('routes chart_shared to the chart workspace', () => {
    expect(
      resolveNotificationHref(
        { type: 'chart_shared', related_item_id: 'chart-1' },
        null
      )
    ).toBe('/charts/chart-1');
  });

  it('routes project_created to project details', () => {
    expect(
      resolveNotificationHref(
        { type: 'project_created', related_item_id: 'proj-1' },
        null
      )
    ).toBe('/projects/proj-1');
  });

  it('does not navigate for project_create_failed', () => {
    expect(
      resolveNotificationHref(
        { type: 'project_create_failed', related_item_id: 'proj-1' },
        null
      )
    ).toBeNull();
  });

  it('routes worklog_pending to My Work', () => {
    expect(
      resolveNotificationHref(
        { type: 'worklog_pending', related_item_id: 'sprint-1' },
        null
      )
    ).toBe('/member');
    expect(
      resolveNotificationHref(
        { type: 'worklog_pending', related_item_id: null },
        null
      )
    ).toBe('/member');
  });

  it('routes entity archive/purge from markdown links in the message', () => {
    expect(
      resolveNotificationHref(
        {
          type: 'entity_archived',
          related_item_id: 'proj-1',
          message: 'Project **Acme** was archived. [Open](/projects/proj-1)',
        },
        null
      )
    ).toBe('/projects/proj-1');
    expect(
      resolveNotificationHref(
        {
          type: 'entity_purged',
          related_item_id: null,
          message:
            'Project **Acme** was permanently deleted. [Open list](/projects?tab=archived)',
        },
        null
      )
    ).toBe('/projects?tab=archived');
  });

  it('does not invent hrefs for destructive types without a message link', () => {
    expect(
      resolveNotificationHref(
        { type: 'entity_archive_failed', related_item_id: 'proj-1' },
        null
      )
    ).toBeNull();
  });
});
