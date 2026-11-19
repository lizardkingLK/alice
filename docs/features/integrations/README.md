# Integrations feature documentation

Workspace-level **AI agent** and **third-party tool** connections configured by managers and admins from **Settings → Integrations**, plus the **planned** Organization / Project / Member scope model.

| Document                                               | Description                                                                                                                                                                      | Status                  |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| [SETTINGS_INTEGRATIONS.md](./SETTINGS_INTEGRATIONS.md) | Settings tab, manager/admin RBAC, catalog, encrypted persistence, and the Gemini/xAI/OpenAI/Anthropic model pool                                                                 | **Phase 1 implemented** |
| [INTEGRATION_SCOPES.md](./INTEGRATION_SCOPES.md)       | Scopes A–F + project AI mint: chat resolution, org enable + project keys, member preferred model, SC/PM/AI summary facade; import-from-project removed; Settings stays org vault | **A–F + project mint**  |

Quick links:

- Settings UI: `apps/web/app/settings/` (`?tab=integrations`)
- Project-scoped integrations (GitHub, Jira): [features/projects/](../projects/)
- Alice Chat providers and tools: [features/chat/AI_CHATBOT.md](../chat/AI_CHATBOT.md)
- Chat model registry: `packages/types/src/chat-models.ts`
