# Notes feature

Personal Notion-style drafts: TipTap rich text, optional emoji icon and cover,
device-local storage, markdown download, and optional work-item attachment sync.
Full workspace at `/notes`; Overview widget shows the last-edited note only
(chat widget pattern).

| Layer              | Location                                                                            |
| ------------------ | ----------------------------------------------------------------------------------- |
| Page               | `apps/web/app/notes/page.tsx`                                                       |
| Workspace / editor | `apps/web/app/notes/_components/`                                                   |
| Store              | `apps/web/app/notes/_helpers/notes-storage.ts` (`alice:overview-notes:v2:{userId}`) |
| Markdown / attach  | `notes-markdown.ts`, `notes-attach.ts`                                              |
| Widget             | `apps/web/app/dashboard/_components/productivity/notes-widget.tsx`                  |
| User guide         | [Notes](../../user-guide/navigation/notes.md)                                       |

## Phased roadmap

1. **Done:** `/notes` sidebar + TipTap + icon/title; widget last-edited; v1→v2 migration
2. **Done:** Download as markdown
3. **Done:** Attach to work item + manual sync (upload new + soft-delete previous)
4. **Done:** Cover image (size-capped data URL on device)
5. **Done:** Collapsible drafts sidebar (cookie SSR + localStorage mirror)

## Deferred

- **Cover in Storage:** move covers from local data URLs to a signed upload /
  blob in Alice storage (same family as attachments / locked images), with
  signed read URLs at display time. Keeps localStorage small and enables
  multi-device covers later.

## Constraints

- Note bodies stay browser localStorage only — not multi-device
- Max 30 notes; TipTap JSON size guard; cover data-URL size cap (until Storage)
- Sync is manual; detach does not delete the remote attachment
- Drafts sidebar open state: cookie `notes_drafts_sidebar_state` +
  `alice:notes-drafts-sidebar-open:v1`
