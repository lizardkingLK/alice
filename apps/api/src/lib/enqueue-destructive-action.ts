import { randomUUID } from 'node:crypto';
import { NotificationType as NotificationTypeEnum } from '@repo/types/prisma';

/**
 * Lazy prisma load so importing this helper (from services) does not pull
 * `config/env` during unit tests that never run the background notify path.
 */

export type DestructiveActionKind = 'archive' | 'purge';

export type DestructiveEntityType =
  | 'project'
  | 'team'
  | 'sprint'
  | 'work_item'
  | 'chart'
  | 'saved_view'
  | 'comment'
  | 'access_allowlist'
  | 'access_request';

export type DestructiveActionAccepted = {
  readonly correlationId: string;
  readonly message: string;
};

export type EnqueueDestructiveActionOptions = {
  readonly actorId: string;
  readonly kind: DestructiveActionKind;
  readonly entityType: DestructiveEntityType;
  /** Human label for inbox copy (e.g. project name + key). */
  readonly entityLabel: string;
  /** Surviving entity id for archive success; null for purge. */
  readonly relatedItemId: string | null;
  /**
   * In-app path embedded as a markdown link in the success message
   * (detail for archive, list for purge).
   */
  readonly detailHref: string | null;
  readonly run: () => Promise<void>;
};

function entityNoun(entityType: DestructiveEntityType): string {
  switch (entityType) {
    case 'work_item':
      return 'work item';
    case 'saved_view':
      return 'saved view';
    case 'access_allowlist':
      return 'allowlist entry';
    case 'access_request':
      return 'access request';
    default:
      return entityType.replaceAll('_', ' ');
  }
}

function acceptedMessage(kind: DestructiveActionKind, noun: string): string {
  return kind === 'archive'
    ? `${noun} archive started. You'll be notified when it finishes.`
    : `${noun} permanent delete started. You'll be notified when it finishes.`;
}

async function notifyDestructiveResult(options: {
  readonly userId: string;
  readonly type:
    | typeof NotificationTypeEnum.entity_archived
    | typeof NotificationTypeEnum.entity_archive_failed
    | typeof NotificationTypeEnum.entity_purged
    | typeof NotificationTypeEnum.entity_purge_failed;
  readonly message: string;
  readonly relatedItemId: string | null;
}): Promise<void> {
  const { prisma } = await import('./prisma.js');
  await prisma.notifications.create({
    data: {
      user_id: options.userId,
      type: options.type,
      message: options.message,
      related_item_id: options.relatedItemId,
      created_by: options.userId,
    },
  });
}

function successMessage(options: {
  readonly kind: DestructiveActionKind;
  readonly entityLabel: string;
  readonly detailHref: string | null;
  readonly noun: string;
}): string {
  const label = options.entityLabel;
  let link = '';
  if (options.detailHref) {
    link = options.kind === 'archive' ? ' [Open]' : ' [Open list]';
    link += `(${options.detailHref})`;
  }
  if (options.kind === 'archive') {
    return `${options.noun} **${label}** was archived.${link}`;
  }
  return `${options.noun} **${label}** was permanently deleted.${link}`;
}

/**
 * Validate/auth happens in the caller. This accepts the destructive action,
 * runs it in-process in the background, and inbox-notifies the actor.
 * Interim until BullMQ + apps/worker own these jobs.
 */
export function enqueueDestructiveAction(
  options: EnqueueDestructiveActionOptions
): DestructiveActionAccepted {
  const correlationId = randomUUID();
  const noun = entityNoun(options.entityType);
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  void (async () => {
    try {
      await options.run();
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'Unknown failure';
      console.error(
        `error. ${options.kind} ${options.entityType} failed correlationId=${correlationId}: ${reason}`
      );
      try {
        await notifyDestructiveResult({
          userId: options.actorId,
          type:
            options.kind === 'archive'
              ? NotificationTypeEnum.entity_archive_failed
              : NotificationTypeEnum.entity_purge_failed,
          message: `Could not ${options.kind === 'archive' ? 'archive' : 'permanently delete'} ${noun} **${options.entityLabel}**. ${reason} (ref ${correlationId})`,
          relatedItemId: options.relatedItemId,
        });
      } catch (notifyError: unknown) {
        console.error(
          `error. ${options.kind} failure notification failed correlationId=${correlationId}:`,
          notifyError
        );
      }
      return;
    }

    try {
      await notifyDestructiveResult({
        userId: options.actorId,
        type:
          options.kind === 'archive'
            ? NotificationTypeEnum.entity_archived
            : NotificationTypeEnum.entity_purged,
        message: successMessage({
          kind: options.kind,
          entityLabel: options.entityLabel,
          detailHref: options.detailHref,
          noun: Noun,
        }),
        relatedItemId:
          options.kind === 'archive' ? options.relatedItemId : null,
      });
    } catch (notifyError: unknown) {
      console.error(
        `error. ${options.kind} success notification failed correlationId=${correlationId}:`,
        notifyError
      );
    }
  })().catch((error: unknown) => {
    console.error(
      `error. ${options.kind} background task crashed correlationId=${correlationId}:`,
      error
    );
  });

  return {
    correlationId,
    message: acceptedMessage(options.kind, Noun),
  };
}
