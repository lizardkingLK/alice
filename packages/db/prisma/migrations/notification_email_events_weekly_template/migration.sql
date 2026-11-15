-- GI-656: allow immutable weekly project report event snapshots.

ALTER TABLE public.notification_email_events
  DROP CONSTRAINT notification_email_events_template_check;

ALTER TABLE public.notification_email_events
  ADD CONSTRAINT notification_email_events_template_check
  CHECK (
    template IN (
      'work_item_assignment'::public."EmailTemplate",
      'work_item_reassignment'::public."EmailTemplate",
      'work_item_status_change'::public."EmailTemplate",
      'weekly_project_report'::public."EmailTemplate"
    )
  );
