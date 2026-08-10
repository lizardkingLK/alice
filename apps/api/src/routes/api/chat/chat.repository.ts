import type { Tables } from '@repo/types';
import { env } from '../../../config/env';
import { supabase } from '../../../lib/supabase';
import { sanitizeLog } from './chat.utils';

export type ChatConversationRow = Tables<'chat_conversations'>;

export type ChatConversationSummary = Pick<
  ChatConversationRow,
  'id' | 'title' | 'created_at' | 'updated_at'
>;

export type ChatUserSnapshot = {
  id: string;
  name: string;
  email: string;
};

export type ChatSprintSnapshot = {
  id: string;
  name: string;
  project_id: string;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
};

function historyObjectPath(conversationId: string): string {
  return `chat-history/${conversationId}.md`;
}

export class ChatRepository {
  private isBucketVerified = false;

  async ensureChatBucketExists(): Promise<string> {
    const bucketName = env.STORAGE_BUCKET_CHAT_HISTORY;
    if (this.isBucketVerified) return bucketName;

    try {
      const { data: buckets, error: listError } =
        await supabase.storage.listBuckets();
      if (listError) throw listError;

      const exists = buckets.some((b) => b.name === bucketName);
      if (!exists) {
        const { error: createError } = await supabase.storage.createBucket(
          bucketName,
          { public: false }
        );
        if (createError) throw createError;
      }
      this.isBucketVerified = true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(
        `Error verifying/creating storage bucket "${sanitizeLog(bucketName)}":`,
        sanitizeLog(msg)
      );
    }

    return bucketName;
  }

  async uploadHistoryMarkdown(
    conversationId: string,
    mdContent: string
  ): Promise<void> {
    const bucket = await this.ensureChatBucketExists();
    const path = historyObjectPath(conversationId);
    const buffer = Buffer.from(mdContent, 'utf-8');

    const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType: 'text/markdown',
      upsert: true,
    });

    if (error) throw error;
  }

  async downloadHistoryMarkdown(
    conversationId: string
  ): Promise<string | null> {
    const bucket = await this.ensureChatBucketExists();
    const path = historyObjectPath(conversationId);

    const { data, error } = await supabase.storage.from(bucket).download(path);

    if (error) {
      if ('status' in error && error.status === 404) {
        return null;
      }
      if (error.message?.includes('Object not found')) {
        return null;
      }
      throw error;
    }

    if (!data) return null;
    return data.text();
  }

  async removeHistoryMarkdown(conversationId: string): Promise<void> {
    const bucket = await this.ensureChatBucketExists();
    const path = historyObjectPath(conversationId);
    await supabase.storage.from(bucket).remove([path]);
  }

  async touchConversationUpdatedAt(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (error) throw error;
  }

  async listConversations(userId: string): Promise<ChatConversationSummary[]> {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error(
        'Failed to list chat conversations:',
        sanitizeLog(error.message)
      );
      throw error;
    }

    return data || [];
  }

  async createConversation(
    userId: string,
    title = 'New Chat'
  ): Promise<string> {
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({
        user_id: userId,
        title,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error(
        'Failed to create chat conversation:',
        sanitizeLog(error.message)
      );
      throw error;
    }

    return data.id;
  }

  async deleteConversation(
    userId: string,
    conversationId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      console.error(
        'Failed to delete chat conversation row:',
        sanitizeLog(error.message)
      );
      throw error;
    }
  }

  async listUsersSnapshot(): Promise<ChatUserSnapshot[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email');

    if (error) throw error;
    return (data || []) as ChatUserSnapshot[];
  }

  async listSprintsByProject(
    projectId: string
  ): Promise<ChatSprintSnapshot[]> {
    const { data, error } = await supabase
      .from('sprints')
      .select('id, name, status, start_date, end_date, project_id')
      .eq('project_id', projectId);

    if (error) throw error;
    return (data || []) as ChatSprintSnapshot[];
  }

  async listActiveSprintsSnapshot(): Promise<ChatSprintSnapshot[]> {
    const { data, error } = await supabase
      .from('sprints')
      .select('id, name, project_id, status')
      .eq('status', 'active');

    if (error) throw error;
    return (data || []) as ChatSprintSnapshot[];
  }
}

export const chatRepository = new ChatRepository();
