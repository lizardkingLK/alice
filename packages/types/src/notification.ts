import type { Enums } from './generated/supabase/database.types.js';
import { z } from 'zod';

/** Contact / access-request form payload (web action + API). */
export const contactRequestSchema = z.object({
  email: z.email(),
  name: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(4000),
  /** Optional project keys the requester needs (access requests only). */
  requestedProjectKeys: z
    .union([z.string().max(500), z.array(z.string().max(64)).max(20)])
    .optional(),
});

export type ContactRequestInput = z.infer<typeof contactRequestSchema>;

export class NotificationType {
  user_id!: string;
  type!: Enums<'NotificationType'>;
  message!: string;
  related_item_id?: string | null = null;
  read_status = false;
  created_by?: string | null = null;
  updated_by?: string | null = null;
  updated_at!: string;
  status: Enums<'RecordStatus'> = 'active';
}

export class AssignNotification extends NotificationType {
  constructor() {
    super();
    this.type = 'assign';
  }
}

export class StatusChangeNotification extends NotificationType {
  constructor() {
    super();
    this.type = 'status_change';
  }
}

export class MentionNotification extends NotificationType {
  constructor() {
    super();
    this.type = 'mention';
  }
}

export class DueDateNotification extends NotificationType {
  constructor() {
    super();
    this.type = 'due_date';
  }
}

export class ViewSharedNotification extends NotificationType {
  constructor() {
    super();
    this.type = 'view_shared';
  }
}

export class ChartSharedNotification extends NotificationType {
  constructor() {
    super();
    this.type = 'chart_shared';
  }
}

export class WorklogPendingNotification extends NotificationType {
  constructor() {
    super();
    this.type = 'worklog_pending';
  }
}

/** Round pending hours for inbox copy (whole hours when close enough). */
export function formatPendingHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
    return String(Math.round(rounded));
  }
  return rounded.toFixed(1);
}

/** Humanized worklog burndown gap message for the inbox. */
export function formatWorklogPendingMessage(pendingHours: number): string {
  const amount = formatPendingHours(pendingHours);
  const unit = amount === '1' ? 'hour' : 'hours';
  return `You're about ${amount} ${unit} behind today's ideal pace — log work to catch up.`;
}

export class NotificationBuilder<T extends NotificationType> {
  private readonly instance: T;

  constructor(typeClass: new () => T) {
    this.instance = new typeClass();
  }

  ToUser(userId: string): this {
    this.instance.user_id = userId;
    return this;
  }

  WithMessage(message: string): this {
    this.instance.message = message;
    return this;
  }

  WithRelatedItem(relatedItemId: string | null): this {
    this.instance.related_item_id = relatedItemId;
    return this;
  }

  WithCreatedBy(createdBy: string | null): this {
    this.instance.created_by = createdBy;
    return this;
  }

  WithUpdatedBy(updatedBy: string | null): this {
    this.instance.updated_by = updatedBy;
    return this;
  }

  Build(): T {
    this.instance.updated_at = new Date().toISOString();
    return this.instance;
  }
}
