# Chat / AI Assistant feature documentation

In-app **AI Assistant** (“Chatbot” in the sidebar) backed by **Google Gemini**
function-calling. Helps authenticated users list and create projects, sprints,
and work items through natural language.

| Document                         | Description                                      | Status      |
| -------------------------------- | ------------------------------------------------ | ----------- |
| [AI_CHATBOT.md](./AI_CHATBOT.md) | Architecture, tools, storage, auth, configuration | Implemented |

Quick links:

- Web UI: `apps/web/app/chat/`, floating widget via `dashboard-shell.tsx`
- API: `apps/api/src/routes/api/chat/` (route → service → repository)
- Schema: `chat_conversations` in `packages/db/prisma/schema.prisma`
- Types: `packages/types/src/chat.ts` (`ChatRoles` / `ChatRole`)
- Related: [Projects](../projects/), [Work items](../work-items/), [Sprints](../sprints/), [Dashboard](../dashboard/)
- Roadmap (future AI ideas, not this feature): [product/ROADMAP.md](../../product/ROADMAP.md)
