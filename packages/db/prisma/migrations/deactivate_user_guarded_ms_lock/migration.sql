-- Align deactivate optimistic-lock timestamps with Prisma/JS Date (millisecond
-- precision). Without truncation, CURRENT_TIMESTAMP microsecond values cause
-- false conflicts on the next Prisma updateMany lock check.

CREATE OR REPLACE FUNCTION public.deactivate_user_guarded(
  p_user_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz
)
RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  target public.users;
  other_admins integer;
BEGIN
  SELECT * INTO target
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found.' USING ERRCODE = 'P0002';
  END IF;

  IF date_trunc('milliseconds', target.updated_at)
    IS DISTINCT FROM date_trunc('milliseconds', p_expected_updated_at) THEN
    RAISE EXCEPTION 'OPTIMISTIC_LOCK_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  IF NOT target.active THEN
    RETURN NEXT target;
    RETURN;
  END IF;

  IF target.role = 'admin' THEN
    SELECT COUNT(*)::integer INTO other_admins
    FROM public.users
    WHERE role = 'admin'
      AND active = true
      AND membership_status = 'active'
      AND id <> p_user_id;

    IF other_admins < 1 THEN
      RAISE EXCEPTION 'Cannot deactivate the last active admin.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.users
  SET
    active = false,
    updated_by = p_actor_id,
    updated_at = date_trunc('milliseconds', clock_timestamp())
  WHERE id = p_user_id
  RETURNING * INTO target;

  RETURN NEXT target;
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_user_guarded(uuid, uuid, timestamptz)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_user_guarded(uuid, uuid, timestamptz)
  TO postgres, service_role;
