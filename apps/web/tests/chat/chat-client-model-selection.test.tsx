import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatRoles, type ChatModelOption } from '@repo/types';
import { ChatClient } from '@/app/chat/_components/chat-client';
import type {
  ChatClientProps,
  ChatMessage,
} from '@/app/chat/_components/chat-client.types';

const {
  deleteChatAttachmentMock,
  loadConversationHistoryMock,
  mockReplace,
  revalidateChatConversationsMock,
  sendChatMessageMock,
} = vi.hoisted(() => ({
  deleteChatAttachmentMock: vi.fn(),
  loadConversationHistoryMock: vi.fn(),
  mockReplace: vi.fn(),
  revalidateChatConversationsMock: vi.fn(),
  sendChatMessageMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/chat/_services/chat.mutations.client', () => ({
  deleteConversation: vi.fn(),
  renameConversation: vi.fn(),
  sendChatMessage: (...args: unknown[]) => sendChatMessageMock(...args),
}));

vi.mock('@/app/chat/_services/chat-attachments.client', () => ({
  deleteChatAttachment: (...args: unknown[]) =>
    deleteChatAttachmentMock(...args),
}));

vi.mock('@/app/chat/_components/chat-client-bootstrap', () => ({
  loadConversationHistory: (...args: unknown[]) =>
    loadConversationHistoryMock(...args),
}));

vi.mock('@/app/chat/_services/chat.reads.actions.server', () => ({
  revalidateChatConversations: (...args: unknown[]) =>
    revalidateChatConversationsMock(...args),
}));

vi.mock('@/app/chat/_components/use-chat-client-session', () => ({
  useChatClientBootstrap: vi.fn(),
  useChatConversationsRealtime: vi.fn(),
  useChatProcessingPoll: vi.fn(),
}));

vi.mock('@/app/chat/_components/chat-client-frame', () => ({
  ChatClientFrame: (props: {
    readonly chatModels: readonly ChatModelOption[];
    readonly inputValue: string;
    readonly messages: readonly ChatMessage[];
    readonly selectedIntegrationId: string | undefined;
    // eslint-disable-next-line no-unused-vars
    readonly onInputChange: (value: string) => void;
    readonly onNewChat: () => void;
    // eslint-disable-next-line no-unused-vars
    readonly onSelectedIntegrationIdChange: (value: string) => void;
    // eslint-disable-next-line no-unused-vars
    readonly onSendMessage: (text: string) => void;
  }) => (
    <div>
      <select
        aria-label="Chat model"
        value={props.selectedIntegrationId ?? ''}
        onChange={(event) =>
          props.onSelectedIntegrationIdChange(event.target.value)
        }
      >
        {props.chatModels.map((model) => (
          <option key={model.id} value={model.id}>
            {model.display_label}
          </option>
        ))}
      </select>
      <input
        aria-label="Message"
        value={props.inputValue}
        onChange={(event) => props.onInputChange(event.target.value)}
      />
      <button
        type="button"
        onClick={() => props.onSendMessage(props.inputValue)}
      >
        Send
      </button>
      <button type="button" onClick={props.onNewChat}>
        New chat
      </button>
      <div data-testid="messages">
        {props.messages.map((message) => (
          <span key={message.id}>{message.content}</span>
        ))}
      </div>
    </div>
  ),
}));

const DEFAULT_INTEGRATION_ID = '11111111-1111-4111-8111-111111111111';
const SELECTED_INTEGRATION_ID = '22222222-2222-4222-8222-222222222222';
const CREATED_CONVERSATION_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_CONVERSATION_ID = '44444444-4444-4444-8444-444444444444';

const chatModels: ChatModelOption[] = [
  {
    id: DEFAULT_INTEGRATION_ID,
    provider: 'openai',
    name: 'Default model',
    is_default: true,
    model: 'default-model',
    display_label: 'Default model',
  },
  {
    id: SELECTED_INTEGRATION_ID,
    provider: 'anthropic',
    name: 'Selected model',
    is_default: false,
    model: 'selected-model',
    display_label: 'Selected model',
  },
];

const existingConversation = {
  id: OTHER_CONVERSATION_ID,
  title: 'Existing conversation',
  created_at: '2026-10-16T00:00:00.000Z',
  updated_at: '2026-10-16T00:00:00.000Z',
  is_processing: false,
  kind: 'general' as const,
};

const createdMessages: ChatMessage[] = [
  {
    id: 'message-user-1',
    role: ChatRoles.User,
    content: 'First message',
  },
  {
    id: 'message-assistant-1',
    role: ChatRoles.Assistant,
    content: 'First response',
  },
];

function chatClient(overrides: Partial<ChatClientProps> = {}) {
  return (
    <ChatClient
      conversationStateKey="new:"
      initialConversations={[existingConversation]}
      initialMessages={[]}
      initialChatModels={chatModels}
      {...overrides}
    />
  );
}

describe('ChatClient model selection lifecycle', () => {
  beforeEach(() => {
    sendChatMessageMock.mockReset();
    mockReplace.mockReset();
    revalidateChatConversationsMock.mockReset();
    revalidateChatConversationsMock.mockResolvedValue(undefined);
  });

  it('keeps a manual selection across creation, conversation switches, and a new chat', async () => {
    sendChatMessageMock
      .mockResolvedValueOnce({
        reply: 'First response',
        history: createdMessages,
        actions: [],
        conversationId: CREATED_CONVERSATION_ID,
        title: 'First message',
        is_processing: false,
      })
      .mockResolvedValueOnce({
        reply: 'Processing request...',
        history: createdMessages,
        actions: [],
        conversationId: CREATED_CONVERSATION_ID,
        title: 'First message',
        is_processing: true,
      });

    const view = render(chatClient());
    const modelSelect = screen.getByRole('combobox', { name: 'Chat model' });

    expect(modelSelect).toHaveValue(DEFAULT_INTEGRATION_ID);
    fireEvent.change(modelSelect, {
      target: { value: SELECTED_INTEGRATION_ID },
    });
    expect(modelSelect).toHaveValue(SELECTED_INTEGRATION_ID);

    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'First message' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sendChatMessageMock).toHaveBeenCalledTimes(1));
    expect(sendChatMessageMock).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({ content: 'First message' }),
      ]),
      undefined,
      SELECTED_INTEGRATION_ID,
      undefined,
      null,
      'general'
    );
    expect(mockReplace).toHaveBeenCalledWith(
      `/chat?conversationId=${CREATED_CONVERSATION_ID}`
    );

    view.rerender(
      chatClient({
        conversationStateKey: `${CREATED_CONVERSATION_ID}:`,
        initialConversationId: CREATED_CONVERSATION_ID,
        initialConversations: [
          { ...existingConversation, id: CREATED_CONVERSATION_ID },
          existingConversation,
        ],
        initialMessages: createdMessages,
      })
    );

    expect(screen.getByRole('combobox', { name: 'Chat model' })).toHaveValue(
      SELECTED_INTEGRATION_ID
    );
    expect(screen.getByText('First response')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Second message' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sendChatMessageMock).toHaveBeenCalledTimes(2));
    expect(sendChatMessageMock).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining([
        expect.objectContaining({ content: 'Second message' }),
      ]),
      CREATED_CONVERSATION_ID,
      SELECTED_INTEGRATION_ID,
      undefined,
      null,
      'general'
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Do not carry this draft' },
    });
    view.rerender(
      chatClient({
        conversationStateKey: `${OTHER_CONVERSATION_ID}:`,
        initialConversationId: OTHER_CONVERSATION_ID,
        initialMessages: [
          {
            id: 'other-message',
            role: ChatRoles.User,
            content: 'Other conversation content',
          },
        ],
      })
    );

    expect(screen.getByRole('combobox', { name: 'Chat model' })).toHaveValue(
      SELECTED_INTEGRATION_ID
    );
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('');
    expect(screen.queryByText('First response')).not.toBeInTheDocument();
    expect(screen.getByText('Other conversation content')).toBeInTheDocument();

    view.rerender(chatClient());

    expect(screen.getByRole('combobox', { name: 'Chat model' })).toHaveValue(
      SELECTED_INTEGRATION_ID
    );
    expect(
      screen.queryByText('Other conversation content')
    ).not.toBeInTheDocument();
  });

  it('falls back to the workspace default when the selected model becomes unavailable', async () => {
    const view = render(chatClient());
    const modelSelect = screen.getByRole('combobox', { name: 'Chat model' });

    fireEvent.change(modelSelect, {
      target: { value: SELECTED_INTEGRATION_ID },
    });
    expect(modelSelect).toHaveValue(SELECTED_INTEGRATION_ID);

    view.rerender(chatClient({ initialChatModels: [chatModels[0]!] }));

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Chat model' })).toHaveValue(
        DEFAULT_INTEGRATION_ID
      )
    );
  });
});
