# Notes

Personal rich-text drafts on this device — full page under **Notes**, plus an
optional Overview widget for the note you edited last.

**Audience:** All users

---

## Open Notes

1. Sign in to Alice.
2. In the sidebar under **Platform**, select **Notes**.

You'll land on `/notes`. Drafts stay in this browser (local storage). They are
not synced across devices or accounts.

---

## Drafts sidebar

The left **Drafts** list shows your notes (newest edits first). You can hide or
show it with the panel control; Alice remembers that choice in this browser
(cookie + local storage).

- **+** creates a note (up to 30).
- Select a draft to open it in the editor.
- Hover a draft and use the bin to delete it.
- Use the panel icon to collapse drafts; when collapsed, the same control in the
  editor pane opens drafts again.

---

## Editor

Each note has:

| Control       | What it does                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Cover         | Optional wide image (crop dialog). Stored on this device for now; large images are rejected                                 |
| Icon          | Optional emoji for the page (picker in the header)                                                                          |
| Title         | Plain title above the body                                                                                                  |
| Body          | Rich text (same TipTap tools as work-item descriptions: headings, lists, links, code, and more)                             |
| Download      | Saves the note as a `.md` file                                                                                              |
| Attach / Sync | On the full Notes page: upload the note as a markdown attachment on a work item; **Sync** replaces that file after you edit |

Edits save automatically on this device.

### Attach to a work item

1. Open a note on `/notes`.
2. Select the link icon and search for a work item.
3. Choose **Attach** — Alice uploads a `.md` file to that item’s attachments.

After attach, the toolbar shows the work-item key, **Sync** (enabled when the
note changed since the last push), and **Detach** (clears the local link; the
file on the work item stays).

The Overview Notes widget can download markdown but does not offer attach/sync.

---

## Overview widget

On **Overview**, turn on **Notes** in **Customize**. The card shows only the
**last-edited** note (no drafts list), with a link to open full **Notes** —
similar to the Alice chat widget.

---

## Related

- [Dashboard overview](./dashboard-overview.md) — productivity widgets
