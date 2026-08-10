import React from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ChatClient } from './_components/chat-client';

export const metadata = {
  title: 'AI Chatbot',
};

export default function ChatPage() {
  return (
    <DashboardShell
      description="Chat with the Jira Teams AI assistant to create projects, sprints, and work items."
      stickyHeader={true}
    >
      <ChatClient />
    </DashboardShell>
  );
}
