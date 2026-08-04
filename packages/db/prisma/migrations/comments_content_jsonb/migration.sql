-- Convert comments.content from TEXT to JSONB TipTap documents.
-- Existing plain-text (including legacy @[Name](id) / #[KEY](id) markup) is
-- wrapped as a single paragraph; clients normalize markup to mention nodes on read.

ALTER TABLE "comments"
  ADD COLUMN "content_json" JSONB;

UPDATE "comments"
SET "content_json" = jsonb_build_object(
  'type', 'doc',
  'content', jsonb_build_array(
    jsonb_build_object(
      'type', 'paragraph',
      'content', CASE
        WHEN trim(coalesce("content", '')) = '' THEN '[]'::jsonb
        ELSE jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', "content")
        )
      END
    )
  )
);

ALTER TABLE "comments" DROP COLUMN "content";

ALTER TABLE "comments" RENAME COLUMN "content_json" TO "content";

ALTER TABLE "comments"
  ALTER COLUMN "content" SET NOT NULL;
