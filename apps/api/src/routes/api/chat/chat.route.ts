import { Router } from 'express';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import {
  projectsRepository,
  type ProjectRowWithOwner,
} from '../projects/projects.repository';
import { supabase } from '../../../lib/supabase';
import {
  callGeminiAPI,
  processFunctionCalls,
  saveChatHistory,
  loadChatHistory,
  listConversations,
  createConversation,
  deleteConversation,
} from './chat.service';
import type {
  ContentPart,
  ContentTurn,
  InputMessage,
  ToolAction,
  StoredChatMessage,
} from './chat.route.types';

const chatRouter: Router = Router();

function sanitizeLog(value: unknown): string {
  if (value instanceof Error) {
    return value.message.replace(/[\r\n]/g, '_');
  }
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value).replace(/[\r\n]/g, '_');
    } catch {
      // Fallback
    }
  }
  const str = typeof value === 'string' ? value : String(value ?? '');
  return str.replace(/[\r\n]/g, '_');
}

chatRouter.get('/', requireApiAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const list = (await listConversations(req.userId!)) as {
      id: string;
      title: string;
    }[];
    if (list.length > 0 && list[0]) {
      const history = await loadChatHistory(list[0].id);
      return res.json({ history, conversationId: list[0].id });
    }
    res.json({ history: [] });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to load chat history';
    console.error('error. loading chat history failed:', sanitizeLog(message));
    res.status(500).json({ error: message });
  }
});

chatRouter.get('/conversations', requireApiAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const list = await listConversations(req.userId!);
    res.json({ conversations: list });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to list conversations';
    console.error('error. list conversations failed:', sanitizeLog(message));
    res.status(500).json({ error: message });
  }
});

chatRouter.get('/:conversationId', requireApiAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId } = req.params;
    const history = await loadChatHistory(conversationId!);
    res.json({ history });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to load conversation history';
    console.error('error. load conversation history failed:', sanitizeLog(message));
    res.status(500).json({ error: message });
  }
});

chatRouter.delete('/:conversationId', requireApiAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId } = req.params;
    await deleteConversation(req.userId!, conversationId!);
    res.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete conversation';
    console.error('error. delete conversation failed:', sanitizeLog(message));
    res.status(500).json({ error: message });
  }
});

chatRouter.post('/', requireApiAuth, async (req: AuthenticatedRequest, res) => {
  const { messages, conversationId: reqConversationId } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(400).json({
      error:
        'GEMINI_API_KEY is not configured. Please add GEMINI_API_KEY to your apps/api/.env file and restart the server.',
    });
  }

  try {
    const [projectsRaw, usersRaw, sprintsRaw] = await Promise.all([
      projectsRepository.listAll().catch(() => []),
      supabase.from('users').select('id, name, email'),
      supabase
        .from('sprints')
        .select('id, name, project_id, status')
        .eq('status', 'active'),
    ]);

    const projects = (projectsRaw || []) as ProjectRowWithOwner[];
    const users = (usersRaw.data || []) as {
      id: string;
      name: string;
      email: string;
    }[];
    const sprints = (sprintsRaw.data || []) as {
      id: string;
      name: string;
      project_id: string;
    }[];

    const contextInstruction = `
Current Workspace State:
- Active Projects: ${JSON.stringify(projects.map((p) => ({ id: p.id, name: p.name, key: p.key })))}
- System Users: ${JSON.stringify(users.map((u) => ({ id: u.id, name: u.name, email: u.email })))}
- Ongoing Sprints (Active Status Only): ${JSON.stringify(sprints.map((s) => ({ id: s.id, name: s.name, projectId: s.project_id })))}
`;

    const contents: ContentTurn[] = messages.map((msg: InputMessage) => {
      let role = msg.role;
      if (role === 'assistant') {
        role = 'model';
      }

      let parts = msg.parts;
      if (!parts) {
        const textContent = msg.content || msg.text || '';
        parts = [{ text: textContent }];
      }

      return { role: role as 'user' | 'model', parts };
    });

    let responseText = '';
    const toolActionsPerformed: ToolAction[] = [];
    let loopCount = 0;
    const maxLoops = 5;

    while (loopCount < maxLoops) {
      const geminiResponse = await callGeminiAPI(contents, contextInstruction);
      const candidate = geminiResponse.candidates?.[0];
      const modelContent = candidate?.content;

      if (!modelContent) {
        throw new Error('No response content returned from Gemini API');
      }

      contents.push(modelContent);

      const functionCalls = modelContent.parts?.filter(
        (p: ContentPart) => p.functionCall
      );
      if (!functionCalls || functionCalls.length === 0) {
        responseText =
          modelContent.parts
            ?.map((p: ContentPart) => p.text || '')
            .join('\n') || '';
        break;
      }

      const functionResponseParts = await processFunctionCalls(
        req.userId!,
        functionCalls,
        toolActionsPerformed
      );
      contents.push({
        role: 'user',
        parts: functionResponseParts,
      });

      loopCount++;
    }

    const newAssistantMessage: StoredChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant' as const,
      content: responseText,
      actions: toolActionsPerformed,
    };

    const sanitizedInputMessages: StoredChatMessage[] = messages.map(
      (msg: InputMessage, index: number) => ({
        id: msg.id || `msg-${Date.now()}-${index}`,
        role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: msg.content || msg.text || '',
        actions: msg.actions || [],
      })
    );

    const updatedMessages = [...sanitizedInputMessages, newAssistantMessage];

    let conversationId = reqConversationId;
    let title = 'New Chat';

    if (!conversationId) {
      const firstMsgText = messages[0]?.content || messages[0]?.text || 'New Chat';
      title = firstMsgText.slice(0, 30);
      if (firstMsgText.length > 30) title += '...';
      conversationId = await createConversation(req.userId!, title);
    }

    await saveChatHistory(conversationId, updatedMessages);

    res.json({
      reply: responseText,
      history: updatedMessages,
      actions: toolActionsPerformed,
      conversationId,
      title,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to process message';
    console.error('error. chatbot processing failed:', sanitizeLog(message));
    res.status(500).json({ error: message });
  }
});

export default chatRouter;
