-- Board realtime (W6): stream work_items UPDATEs to subscribed clients.
-- Without this, postgres_changes on public.work_items never fires.
-- Idempotent when the table is already in the publication (e.g. dashboard toggle).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'work_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.work_items;
  END IF;
END $$;
