-- Phase 4C: expand-only database foundation for durable Figma OAuth token
-- coordination. This migration creates no runtime coordinator, performs no
-- backfill, and does not activate the shared credential flow.

CREATE TYPE "FigmaOAuthOperationKind" AS ENUM (
  'authorization_code_exchange',
  'token_refresh'
);

CREATE TYPE "FigmaOAuthOperationStatus" AS ENUM (
  'prepared',
  'requesting',
  'response_received',
  'outcome_unknown',
  'provider_rejected',
  'finalized',
  'superseded',
  'expired'
);

CREATE TYPE "FigmaOAuthProjectBindingStatus" AS ENUM (
  'not_applicable',
  'pending',
  'applied',
  'skipped'
);

CREATE TYPE "FigmaOAuthOperationResolution" AS ENUM (
  'provider_rejection_confirmed',
  'provider_access_revoked',
  'oauth_app_credentials_rotated'
);

-- Persistent numeric fences survive connection or journal-row deletion.
-- They are local database ordering guards, not proof of Figma issuance order.
ALTER TABLE "projects"
  ADD COLUMN "figma_binding_generation" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "figma_oauth_attempts"
  ADD COLUMN "oauth_app_key" TEXT,
  ADD COLUMN "project_binding_generation" INTEGER,
  ALTER COLUMN "code_verifier_enc" DROP NOT NULL;

ALTER TABLE "figma_oauth_credentials"
  ADD COLUMN "last_token_operation_sequence" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "last_token_operation_id" UUID;

ALTER TABLE "figma_connections"
  ADD COLUMN "binding_generation" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "credential_token_version" INTEGER;

CREATE TABLE "figma_oauth_operations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "journal_sequence" BIGSERIAL NOT NULL,
  "kind" "FigmaOAuthOperationKind" NOT NULL,
  "status" "FigmaOAuthOperationStatus" NOT NULL DEFAULT 'prepared',
  "oauth_app_key" TEXT NOT NULL,
  "oauth_attempt_id" UUID,
  "oauth_attempt_nonce_hash" TEXT,
  "authorization_code_hash" TEXT,
  "source_refresh_token_hash" TEXT,
  "project_id" UUID,
  "project_binding_generation" INTEGER,
  "initiated_by" UUID,
  "credential_id" UUID,
  "figma_user_id" TEXT,
  "figma_identity_verified_at" TIMESTAMPTZ(6),
  "expected_token_version" INTEGER,
  "worker_token" UUID,
  "request_started_at" TIMESTAMPTZ(6),
  "request_deadline_at" TIMESTAMPTZ(6),
  "pending_token_response_enc" TEXT,
  "pending_token_key_version" INTEGER,
  "pending_access_token_expires_at" TIMESTAMPTZ(6),
  "pending_scopes" TEXT,
  "pending_token_expires_at" TIMESTAMPTZ(6),
  "response_received_at" TIMESTAMPTZ(6),
  "provider_http_status" INTEGER,
  "failure_code" TEXT,
  "outcome_unknown_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "project_binding_status" "FigmaOAuthProjectBindingStatus" NOT NULL DEFAULT 'not_applicable',
  "project_binding_completed_at" TIMESTAMPTZ(6),
  "project_binding_skip_reason" TEXT,
  "resolution" "FigmaOAuthOperationResolution",
  "resolved_at" TIMESTAMPTZ(6),
  "resolved_by" UUID,
  "retention_expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "figma_oauth_operations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "figma_oauth_operations_sequence_positive"
    CHECK ("journal_sequence" > 0),
  CONSTRAINT "figma_oauth_operations_expected_version_positive"
    CHECK ("expected_token_version" IS NULL OR "expected_token_version" > 0),
  CONSTRAINT "figma_oauth_operations_binding_generation_nonnegative"
    CHECK (
      "project_binding_generation" IS NULL
      OR "project_binding_generation" >= 0
    ),
  CONSTRAINT "figma_oauth_operations_kind_inputs"
    CHECK (
      (
        "kind" = 'authorization_code_exchange'
        AND "authorization_code_hash" IS NOT NULL
        AND "oauth_attempt_nonce_hash" IS NOT NULL
        AND "source_refresh_token_hash" IS NULL
      )
      OR
      (
        "kind" = 'token_refresh'
        AND "source_refresh_token_hash" IS NOT NULL
        AND "authorization_code_hash" IS NULL
        AND "figma_user_id" IS NOT NULL
        AND "expected_token_version" IS NOT NULL
      )
    ),
  CONSTRAINT "figma_oauth_operations_pending_envelope_complete"
    CHECK (
      (
        "pending_token_response_enc" IS NULL
        AND "pending_token_key_version" IS NULL
        AND "pending_token_expires_at" IS NULL
      )
      OR
      (
        "pending_token_response_enc" IS NOT NULL
        AND "pending_token_key_version" IS NOT NULL
        AND "pending_token_key_version" > 0
        AND "pending_token_expires_at" IS NOT NULL
      )
    ),
  CONSTRAINT "figma_oauth_operations_response_has_envelope"
    CHECK (
      ("status" = 'response_received')
      = ("pending_token_response_enc" IS NOT NULL)
    ),
  CONSTRAINT "figma_oauth_operations_request_worker"
    CHECK (
      ("status" = 'requesting') = ("worker_token" IS NOT NULL)
    ),
  CONSTRAINT "figma_oauth_operations_request_timestamps"
    CHECK (
      "status" <> 'requesting'
      OR (
        "request_started_at" IS NOT NULL
        AND "request_deadline_at" IS NOT NULL
      )
    ),
  CONSTRAINT "figma_oauth_operations_response_timestamp"
    CHECK (
      "status" <> 'response_received'
      OR "response_received_at" IS NOT NULL
    ),
  CONSTRAINT "figma_oauth_operations_unknown_timestamp"
    CHECK (
      "status" <> 'outcome_unknown'
      OR "outcome_unknown_at" IS NOT NULL
    ),
  CONSTRAINT "figma_oauth_operations_terminal_timestamp"
    CHECK (
      "status" NOT IN (
        'provider_rejected',
        'finalized',
        'superseded',
        'expired'
      )
      OR "completed_at" IS NOT NULL
    ),
  CONSTRAINT "figma_oauth_operations_binding_lifecycle"
    CHECK (
      (
        "kind" = 'authorization_code_exchange'
        AND "project_binding_status" IN ('pending', 'applied', 'skipped')
      )
      OR
      (
        "kind" = 'token_refresh'
        AND "project_binding_status" = 'not_applicable'
      )
    ),
  CONSTRAINT "figma_oauth_operations_resolution_complete"
    CHECK (
      (
        "resolution" IS NULL
        AND "resolved_at" IS NULL
      )
      OR
      (
        "resolution" IS NOT NULL
        AND "resolved_at" IS NOT NULL
      )
    ),
  CONSTRAINT "figma_oauth_operations_resolution_status"
    CHECK (
      "resolution" IS NULL
      OR "status" IN ('provider_rejected', 'superseded')
    )
);

CREATE UNIQUE INDEX "figma_oauth_operations_journal_sequence_key"
  ON "figma_oauth_operations"("journal_sequence");
CREATE UNIQUE INDEX "figma_oauth_operations_oauth_attempt_id_key"
  ON "figma_oauth_operations"("oauth_attempt_id");
CREATE UNIQUE INDEX "figma_oauth_operations_oauth_attempt_nonce_hash_key"
  ON "figma_oauth_operations"("oauth_attempt_nonce_hash");
CREATE UNIQUE INDEX "figma_oauth_operations_authorization_code_hash_key"
  ON "figma_oauth_operations"("authorization_code_hash");
CREATE INDEX "figma_oauth_operations_oauth_app_key_status_idx"
  ON "figma_oauth_operations"("oauth_app_key", "status");
CREATE INDEX "figma_oauth_operations_credential_id_status_idx"
  ON "figma_oauth_operations"("credential_id", "status");
CREATE INDEX "figma_oauth_operations_status_pending_token_expires_at_idx"
  ON "figma_oauth_operations"("status", "pending_token_expires_at");
CREATE INDEX "figma_oauth_operations_project_id_created_at_idx"
  ON "figma_oauth_operations"("project_id", "created_at");
CREATE INDEX "figma_oauth_operations_oauth_app_key_figma_user_id_journal_sequence_idx"
  ON "figma_oauth_operations"(
    "oauth_app_key",
    "figma_user_id",
    "journal_sequence"
  );

CREATE UNIQUE INDEX "figma_oauth_credentials_last_token_operation_id_key"
  ON "figma_oauth_credentials"("last_token_operation_id");

-- Backstop only: one provider request may be marked as actively requesting per
-- OAuth app. This index does not enforce the full coordinator safety policy.
-- Future code must also check requesting rows, unresolved outcome_unknown rows,
-- and conflicting response_received rows before any Figma token request.
CREATE UNIQUE INDEX "figma_oauth_operations_one_requesting_per_app"
  ON "figma_oauth_operations"("oauth_app_key")
  WHERE "status" = 'requesting';

ALTER TABLE "figma_oauth_operations"
  ADD CONSTRAINT "figma_oauth_operations_oauth_attempt_id_fkey"
  FOREIGN KEY ("oauth_attempt_id") REFERENCES "figma_oauth_attempts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "figma_oauth_operations"
  ADD CONSTRAINT "figma_oauth_operations_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "figma_oauth_operations"
  ADD CONSTRAINT "figma_oauth_operations_initiated_by_fkey"
  FOREIGN KEY ("initiated_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "figma_oauth_operations"
  ADD CONSTRAINT "figma_oauth_operations_resolved_by_fkey"
  FOREIGN KEY ("resolved_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "figma_oauth_operations"
  ADD CONSTRAINT "figma_oauth_operations_credential_id_fkey"
  FOREIGN KEY ("credential_id") REFERENCES "figma_oauth_credentials"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "figma_oauth_credentials"
  ADD CONSTRAINT "figma_oauth_credentials_last_token_operation_id_fkey"
  FOREIGN KEY ("last_token_operation_id")
  REFERENCES "figma_oauth_operations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Allowed future operation transitions are:
-- prepared -> requesting|expired
-- requesting -> response_received|provider_rejected|outcome_unknown
-- response_received -> finalized|superseded
-- outcome_unknown -> provider_rejected|superseded only after explicit,
-- evidence-based resolution. A timeout or secret rotation alone is not proof
-- of provider ordering and must not automatically unblock an ambiguity.
--
-- Expired response_received ciphertext may be erased only by atomically moving
-- the row to superseded, clearing the ciphertext envelope, marking any affected
-- credential reauthorization_required, preserving the journal/credential
-- numeric fences, and retaining any required ambiguity barrier. This migration
-- intentionally supplies no cleanup or coordinator.

-- Strategy A: the journal may contain encrypted pending token responses.
-- PostgREST client roles receive no table or sequence privileges and no RLS
-- policies. Trusted server roles retain direct access.
ALTER TABLE "figma_oauth_operations" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "figma_oauth_operations" TO postgres, service_role;
REVOKE ALL ON TABLE "figma_oauth_operations"
  FROM PUBLIC, anon, authenticated;

GRANT USAGE, SELECT ON SEQUENCE
  "figma_oauth_operations_journal_sequence_seq"
  TO postgres, service_role;
REVOKE ALL ON SEQUENCE "figma_oauth_operations_journal_sequence_seq"
  FROM PUBLIC, anon, authenticated;

