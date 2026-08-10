-- Drop share mode: recipients are always explicit user ids.
ALTER TABLE "saved_view_shares" DROP COLUMN IF EXISTS "share_mode";

DROP TYPE IF EXISTS "SavedViewShareMode";
