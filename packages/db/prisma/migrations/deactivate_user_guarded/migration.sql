-- Atomically deactivate a user while preventing the last active admin from
-- being turned off (count + update under a row lock).
-- Invoked by the API service role via supabase.rpc('deactivate_user_guarded', …).
-- "Active admin" = role admin AND kill switch on AND membership_status active.

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

  IF target.updated_at IS DISTINCT FROM p_expected_updated_at THEN
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
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_user_id
  RETURNING * INTO target;

  RETURN NEXT target;
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_user_guarded(uuid, uuid, timestamptz)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_user_guarded(uuid, uuid, timestamptz)
  TO postgres, service_role;
