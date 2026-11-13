-- GI-656 Phase 2E.2: immutable, server-only notification email event snapshots.

CREATE TABLE public.notification_email_events (
  notification_id UUID NOT NULL,
  version INTEGER NOT NULL,
  template public."EmailTemplate" NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT notification_email_events_pkey PRIMARY KEY (notification_id),
  CONSTRAINT notification_email_events_notification_id_fkey
    FOREIGN KEY (notification_id) REFERENCES public.notifications(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT notification_email_events_version_check CHECK (version = 1),
  CONSTRAINT notification_email_events_payload_object_check
    CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT notification_email_events_template_check
    CHECK (
      template IN (
        'work_item_assignment'::public."EmailTemplate",
        'work_item_reassignment'::public."EmailTemplate",
        'work_item_status_change'::public."EmailTemplate"
      )
    )
);

ALTER TABLE public.notification_email_events ENABLE ROW LEVEL SECURITY;

-- The API connects through Prisma as the postgres database role. Supabase
-- clients and the service-role PostgREST client do not need this table.
REVOKE ALL PRIVILEGES ON TABLE public.notification_email_events
  FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT SELECT, INSERT ON TABLE public.notification_email_events TO postgres;

CREATE FUNCTION public.prevent_notification_email_event_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION 'notification email events are immutable'
    USING ERRCODE = '55000';
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.prevent_notification_email_event_update()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER notification_email_events_prevent_update
  BEFORE UPDATE ON public.notification_email_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_notification_email_event_update();

-- Realtime must not publish server-only snapshots. Explicit membership can be
-- removed. An all-table or public-schema publication cannot exclude one table,
-- so abort instead of deploying with accidental exposure.
DO $block$
DECLARE
  realtime_publication_oid OID;
  realtime_publishes_all_tables BOOLEAN;
BEGIN
  SELECT oid, puballtables
    INTO realtime_publication_oid, realtime_publishes_all_tables
  FROM pg_catalog.pg_publication
  WHERE pubname = 'supabase_realtime';

  IF realtime_publication_oid IS NULL THEN
    RETURN;
  END IF;

  IF realtime_publishes_all_tables OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_namespace AS publication_namespace
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = publication_namespace.pnnspid
    WHERE publication_namespace.pnpubid = realtime_publication_oid
      AND namespace.nspname = 'public'
  ) THEN
    RAISE EXCEPTION
      'notification_email_events cannot be excluded from supabase_realtime';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notification_email_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      DROP TABLE public.notification_email_events;
  END IF;
END;
$block$;
