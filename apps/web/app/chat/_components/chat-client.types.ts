import { ChatRole } from '@repo/types';

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
