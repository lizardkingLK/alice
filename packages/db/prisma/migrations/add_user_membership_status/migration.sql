-- Invite / onboarding membership (orthogonal to kill switch `users.active`).
CREATE TYPE "UserMembershipStatus" AS ENUM ('pending', 'active');

ALTER TABLE "users"
  ADD COLUMN "membership_status" "UserMembershipStatus" NOT NULL DEFAULT 'active';

-- Existing rows keep DEFAULT 'active' (already joined). New admin invites set pending in app code.

-- Last-admin guard: only membership-active + kill-switch-on admins count.
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

-- Restore Supabase Data API access after Prisma DDL.
-- Prisma runs as postgres; PostgREST uses anon, authenticated, and service_role.
-- Without these grants, seed (service_role) and client queries fail with
-- "permission denied for schema public".

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON ROUTINES TO anon, authenticated;
