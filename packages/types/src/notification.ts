import type { Enums } from './generated/supabase/database.types.js';

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

export class MentionNotification extends NotificationType {
  constructor() {
    super();
    this.type = 'mention';
  }
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
