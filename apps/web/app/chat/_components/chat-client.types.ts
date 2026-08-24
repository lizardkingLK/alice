import type { ChatRole, Tables } from '@repo/types';

export type ActionItem = {
  type: 'create_project' | 'create_sprint' | 'create_work_item';
  entity: {
    id: string;
    name?: string;
    key?: string;
    title?: string;
    status?: string;
  };
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  actions?: ActionItem[];
};

/** Conversation list row shared by client API + RSC bootstrap. */
export type ChatConversation = Pick<
  Tables<'chat_conversations'>,
  'id' | 'title' | 'created_at' | 'updated_at' | 'is_processing'
>;
