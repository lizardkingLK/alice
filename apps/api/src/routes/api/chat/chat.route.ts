import { Router } from 'express';
import { requireApiAuth, type AuthenticatedRequest } from '../../../middlewares/auth';
import { projectsRepository, type ProjectRowWithOwner } from '../projects/projects.repository';
import { supabase } from '../../../lib/supabase';
import { callGeminiAPI, processFunctionCalls } from './chat.service';
import type {
  ContentPart,
  ContentTurn,
  InputMessage,
  ToolAction,
} from './chat.route.types';

const chatRouter: Router = Router();


chatRouter.post('/', requireApiAuth, async (req: AuthenticatedRequest, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(400).json({
      error: 'GEMINI_API_KEY is not configured. Please add GEMINI_API_KEY to your apps/api/.env file and restart the server.',
    });
  }

  try {
    const [projectsRaw, usersRaw, sprintsRaw] = await Promise.all([
      projectsRepository.listAll().catch(() => []),
      supabase.from('users').select('id, name, email'),
      supabase.from('sprints').select('id, name, project_id, status').eq('status', 'active')
    ]);

    const projects = (projectsRaw || []) as ProjectRowWithOwner[];
    const users = (usersRaw.data || []) as { id: string; name: string; email: string }[];
    const sprints = (sprintsRaw.data || []) as { id: string; name: string; project_id: string }[];

    const contextInstruction = `
Current Workspace State:
- Active Projects: ${JSON.stringify(projects.map(p => ({ id: p.id, name: p.name, key: p.key })))}
- System Users: ${JSON.stringify(users.map(u => ({ id: u.id, name: u.name, email: u.email })))}
- Ongoing Sprints (Active Status Only): ${JSON.stringify(sprints.map(s => ({ id: s.id, name: s.name, projectId: s.project_id })))}
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

      const functionCalls = modelContent.parts?.filter((p: ContentPart) => p.functionCall);
      if (!functionCalls || functionCalls.length === 0) {
        responseText = modelContent.parts?.map((p: ContentPart) => p.text || '').join('\n') || '';
        break;
      }

      const functionResponseParts = await processFunctionCalls(req.userId!, functionCalls, toolActionsPerformed);
      contents.push({
        role: 'user',
        parts: functionResponseParts,
      });

      loopCount++;
    }

    res.json({
      reply: responseText,
      history: contents.map((c: ContentTurn) => {
        const role = c.role === 'model' ? 'assistant' : c.role;
        return {
          role,
          parts: c.parts,
          content: c.parts?.[0]?.text || '',
        };
      }),
      actions: toolActionsPerformed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process message';
    const sanitized = message.replace(/[\r\n]/g, '_');
    console.error('error. chatbot processing failed:', sanitized);
    res.status(500).json({ error: message });
  }
});

export default chatRouter;
