-- AlterTable: add done_at to work_items
--
-- done_at records the exact timestamp when a work item transitions to 'Done'.
-- It is set by the application on status → 'Done' and cleared on status ← 'Done'.
-- NULL means the item has never been completed, or was reverted from Done.
-- Used by the sprint burndown chart to compute per-day finished story points.

ALTER TABLE "work_items"
  ADD COLUMN "done_at" TIMESTAMPTZ(6);
