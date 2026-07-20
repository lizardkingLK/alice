# Work item description (TipTap JSON)

`work_items.description` stores a [TipTap](https://tiptap.dev/) / ProseMirror document as JSONB. The work item details UI reads and writes this field through `@tiptap/react` with `StarterKit`.

Related:

- [`ER_DIAGRAM.md`](./ER_DIAGRAM.md) — `work_items` entity
- [`../guides/DATABASE.md`](../guides/DATABASE.md) — seed data and migrations
- [`../features/work-items/`](../features/work-items/) — feature index
- `apps/web/app/work-items/_components/workItem-description-editor.tsx` — editor UI
- `apps/web/app/work-items/_helpers/work-item-description.ts` — plain-text helpers for read mode

---

## Storage shape

Root object is always a document node:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "Hello world" }]
    }
  ]
}
```

Text never lives directly on block nodes. Inline content is nested under `content` as `text` nodes (optionally with `marks`).

Supported blocks in the current editor (`StarterKit`):

| Node type     | Purpose                        |
| ------------- | ------------------------------ |
| `paragraph`   | Body copy                      |
| `heading`     | Section titles (`attrs.level`) |
| `bulletList`  | Unordered lists                |
| `orderedList` | Numbered lists                 |
| `listItem`    | List row wrapper               |
| `blockquote`  | Quoted text                    |
| `codeBlock`   | Multi-line code                |
| `hardBreak`   | Line break inside a paragraph  |

Common marks:

| Mark     | Purpose         |
| -------- | --------------- |
| `bold`   | Strong emphasis |
| `italic` | Emphasis        |
| `code`   | Inline code     |
| `strike` | Strikethrough   |

---

## Example (seeded story)

```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 2 },
      "content": [{ "type": "text", "text": "Admin user registry screen" }]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Build the admin table view for listing users, filtering by role, and updating account state."
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Acceptance criteria",
          "marks": [{ "type": "bold" }]
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "Admins can search users by name or email"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## App conventions

| Concern      | Convention                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Read (view)  | `descriptionToHtml()` converts the document to HTML; code blocks are highlighted with lowlight (same engine as the editor) |
| Edit         | `toTiptapContent()` converts Supabase `Json` → TipTap `JSONContent`                                                        |
| Save         | `fromTiptapContent()` converts `JSONContent` → `Json` for persistence                                                      |
| Validation   | App-layer Zod/schema checks before write; DB stores JSONB as-is                                                            |
| Legacy seeds | Flat `{ type: "paragraph", text: "..." }` still renders via fallback parser                                                |

---

## Seed data

`packages/db/src/seed.ts` seeds four work items with rich TipTap documents (headings, bold/italic/code marks, bullet lists). Re-running `pnpm db seed` refreshes descriptions on existing seed titles so local data stays in sync with the editor format.

Sample items:

| Title                      | Format highlights                        |
| -------------------------- | ---------------------------------------- |
| User Management Epic       | Heading, scope list, italic out-of-scope |
| Admin user registry screen | Acceptance criteria with inline code     |
| Wire user list to Supabase | Technical notes + implementation bullets |
| Kanban drag-and-drop board | References `workflow_config` in copy     |

---

## Project configuration (related)

Per-project task customization and swimlanes are **not** stored on `work_items.description`. They live on the project row:

| Column              | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `attributes_config` | Opinionated custom fields schema per work item type |
| `workflow_config`   | Swimlane / status progression rules for the project |

See [`ER_DIAGRAM.md`](./ER_DIAGRAM.md) for the updated project model.
