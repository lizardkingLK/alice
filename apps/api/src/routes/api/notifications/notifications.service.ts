import { supabase } from '../../../lib/supabase';

export class NotificationsService {
  async ensureSubscriber(_subscriberId: string, _email?: string) {
    // No-op - Novu is deprecated
  }

  async sendInAppNotification(params: {
    subscriberId: string;
    message: string;
    title?: string;
  }) {
    // Save to Supabase notifications table if subscriberId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(params.subscriberId)) {
      try {
        const { error } = await supabase.from('notifications').insert({
          user_id: params.subscriberId,
          type: 'mention',
          message: params.message,
          read_status: false,
          status: 'active',
          updated_at: new Date().toISOString(),
        });
        if (error) {
          console.error('Failed to insert notification to Supabase:', error);
        }
      } catch (err) {
        console.error('Error inserting notification to Supabase:', err);
      }
    }
  }

  async createAssignNotification(params: {
    assigneeId: string;
    actorId: string;
    taskTitle: string;
    taskId: string;
  }) {
    if (params.assigneeId === params.actorId) return;

    try {
      // Fetch actor name
      const { data: actor } = await supabase
        .from('users')
        .select('name')
        .eq('id', params.actorId)
        .maybeSingle();

      const actorName = actor?.name || 'A teammate';

      // Insert notification
      const { error } = await supabase.from('notifications').insert({
        user_id: params.assigneeId,
        type: 'assign',
        message: `${actorName} assigned a task to you: "${params.taskTitle}"`,
        related_item_id: params.taskId,
        read_status: false,
        created_by: params.actorId,
        updated_by: params.actorId,
        updated_at: new Date().toISOString(),
        status: 'active',
      });

      if (error) {
        console.error('Failed to insert assign notification to Supabase:', error);
      }
    } catch (err) {
      console.error('Error creating assign notification:', err);
    }
  }
}

export const notificationsService = new NotificationsService();
