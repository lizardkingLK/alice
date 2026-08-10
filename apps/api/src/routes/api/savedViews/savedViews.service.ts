import {
  expandShareRecipients,
  NotificationBuilder,
  ViewSharedNotification,
  type CreateSavedViewInput,
  type ShareSavedViewInput,
  type UpdateSavedViewInput,
} from '@repo/types';
import { supabase } from '../../../lib/supabase';
import {
  savedViewsRepository,
  type SavedViewRow,
} from './savedViews.repository';

export class SavedViewsService {
  create(ownerId: string, input: CreateSavedViewInput) {
    return savedViewsRepository.create(ownerId, input);
  }

  listOwned(ownerId: string, status: 'active' | 'archived') {
    return savedViewsRepository.listOwned(ownerId, status);
  }

  listSharedWithMe(userId: string) {
    return savedViewsRepository.listSharedWithMe(userId);
  }

  async update(
    actorId: string,
    viewId: string,
    input: UpdateSavedViewInput
  ): Promise<SavedViewRow> {
    const view = await this.requireOwnedView(actorId, viewId);
    return savedViewsRepository.update(view.id, actorId, input);
  }

  async archive(actorId: string, viewId: string): Promise<SavedViewRow> {
    await this.requireOwnedView(actorId, viewId);
    return savedViewsRepository.setStatus(viewId, actorId, 'archived');
  }

  async restore(actorId: string, viewId: string): Promise<SavedViewRow> {
    await this.requireOwnedView(actorId, viewId);
    return savedViewsRepository.setStatus(viewId, actorId, 'active');
  }

  async hardDelete(actorId: string, viewId: string): Promise<void> {
    const view = await this.requireOwnedView(actorId, viewId);
    if (view.status !== 'archived') {
      throw new Error('Only archived views can be permanently deleted');
    }
    await savedViewsRepository.hardDelete(viewId);
  }

  /** Recipient removes a shared view from their Shared-with-me list. */
  async deleteShare(actorId: string, viewId: string): Promise<void> {
    await savedViewsRepository.deleteShare({
      viewId,
      userId: actorId,
    });
  }

  async share(
    actorId: string,
    viewId: string,
    input: ShareSavedViewInput
  ): Promise<{ view: SavedViewRow; recipientCount: number }> {
    const view = await this.requireOwnedView(actorId, viewId);
    if (view.status !== 'active') {
      throw new Error('Only active views can be shared');
    }

    const recipients = expandShareRecipients({
      ownerId: view.owner_id,
      candidateIds: input.userIds,
    });

    if (recipients.length === 0) {
      return { view, recipientCount: 0 };
    }

    const existingShareUserIds = new Set(
      await savedViewsRepository.listActiveShareUserIds(view.id)
    );
    const newRecipientIds = recipients.filter(
      (userId) => !existingShareUserIds.has(userId)
    );

    await savedViewsRepository.upsertShares({
      viewId: view.id,
      actorId,
      userIds: recipients,
    });

    await this.notifyRecipients({
      actorId,
      view,
      recipientIds: newRecipientIds,
    });

    return { view, recipientCount: recipients.length };
  }

  private async requireOwnedView(
    actorId: string,
    viewId: string
  ): Promise<SavedViewRow> {
    const view = await savedViewsRepository.getById(viewId);
    if (!view) {
      throw new Error('Saved view not found');
    }
    if (view.owner_id !== actorId) {
      throw new Error('Forbidden');
    }
    return view;
  }

  private async notifyRecipients(params: {
    readonly actorId: string;
    readonly view: SavedViewRow;
    readonly recipientIds: readonly string[];
  }) {
    if (params.recipientIds.length === 0) {
      return;
    }

    const { data: actor } = await supabase
      .from('users')
      .select('name')
      .eq('id', params.actorId)
      .maybeSingle();

    const actorName = actor?.name ?? 'Someone';
    const message = `${actorName} shared the view “${params.view.title}” with you`;

    const rows = params.recipientIds.map((userId) =>
      new NotificationBuilder(ViewSharedNotification)
        .ToUser(userId)
        .WithMessage(message)
        .WithRelatedItem(params.view.id)
        .WithCreatedBy(params.actorId)
        .WithUpdatedBy(params.actorId)
        .Build()
    );

    const { error } = await supabase.from('notifications').insert(rows);
    if (error) {
      throw new Error(`Failed to notify recipients: ${error.message}`);
    }
  }
}

export const savedViewsService = new SavedViewsService();
