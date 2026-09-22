# Chat / Alice feature documentation

In-app **Alice** (sidebar label: **Alice**) backed by **Google Gemini**
function-calling. Helps authenticated users list and create projects, sprints,
and work items through natural language, with multi-format attachment parsing,
atomic imports, backlog synchronization, and signed URL auto-refresh.

| Document                                   | Description                                                                                                                                                                          | Status      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| [AI_CHATBOT.md](./AI_CHATBOT.md)           | Architecture, 9 Gemini tools, multi-format attachments (JSON, CSV, TSV, MD, Outline, YAML), atomic imports, backlog sync, signed URL auto-refresh, storage, and deduplication engine | Implemented |
| [USER_TEST_GUIDE.md](./USER_TEST_GUIDE.md) | Step-by-step end-to-end testing guide with copy-pasteable sample JSON, CSV, Markdown, and Outline files, atomic failure handling, and backlog updates                                | Implemented |

Quick links:

- Web UI: `apps/web/app/chat/`, floating widget via `dashboard-shell.tsx`
- API: `apps/api/src/routes/api/chat/` (composition → route → service → repository)
- DI: [architecture/DI.md](../../architecture/DI.md)
- Schema: `chat_conversations` and `chat_attachments` in `packages/db/prisma/schema.prisma`
- Types: `packages/types/src/chat.ts`, `packages/types/src/chat-attachments.ts`, `packages/types/src/api/v1/chat.ts`
- Related: [Projects](../projects/), [Work items](../work-items/), [Sprints](../sprints/), [Dashboard](../dashboard/)
- Roadmap (future AI ideas, not this feature): [product/ROADMAP.md](../../product/ROADMAP.md)
