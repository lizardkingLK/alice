import type { Database, Tables } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../../config/env';
import { prisma } from '../../../lib/prisma';
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

  constructor(private readonly db: SupabaseClient<Database>) {}

  async ensureChatBucketExists(): Promise<string> {
    const bucketName = env.STORAGE_BUCKET_CHAT_HISTORY;
    if (this.isBucketVerified) return bucketName;

    try {
      const { data: buckets, error: listError } =
        await this.db.storage.listBuckets();
      if (listError) throw listError;

      const exists = buckets.some((b) => b.name === bucketName);
      if (!exists) {
        const { error: createError } = await this.db.storage.createBucket(
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

    const { error } = await this.db.storage.from(bucket).upload(path, buffer, {
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

    const { data, error } = await this.db.storage.from(bucket).download(path);

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
    await this.db.storage.from(bucket).remove([path]);
  }

  async touchConversationUpdatedAt(conversationId: string): Promise<void> {
    await prisma.chat_conversations.update({
      where: { id: conversationId },
      data: { updated_at: new Date() },
    });
  }

  async listConversations(userId: string): Promise<ChatConversationSummary[]> {
    const { data, error } = await this.db
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
    const created = await prisma.chat_conversations.create({
      data: { user_id: userId, title },
    });
    return created.id;
  }

  async deleteConversation(
    userId: string,
    conversationId: string
  ): Promise<void> {
    await prisma.chat_conversations.deleteMany({
      where: { id: conversationId, user_id: userId },
    });
  }

  async listUsersSnapshot(): Promise<ChatUserSnapshot[]> {
    const { data, error } = await this.db
      .from('users')
      .select('id, name, email');

    if (error) throw error;
    return (data || []) as ChatUserSnapshot[];
  }

  async listSprintsByProject(projectId: string): Promise<ChatSprintSnapshot[]> {
    const { data, error } = await this.db
      .from('sprints')
      .select('id, name, status, start_date, end_date, project_id')
      .eq('project_id', projectId);

    if (error) throw error;
    return (data || []) as ChatSprintSnapshot[];
  }

  async listActiveSprintsSnapshot(): Promise<ChatSprintSnapshot[]> {
    const { data, error } = await this.db
      .from('sprints')
      .select('id, name, project_id, status')
      .eq('status', 'active');

    if (error) throw error;
    return (data || []) as ChatSprintSnapshot[];
  }
}
