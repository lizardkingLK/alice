-- Access request workflow: canonical rows + admin inbox notifications.
-- See docs/features/access/ACCESS_REQUESTS.md

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('pending', 'granted', 'denied');
CREATE TYPE "AccessRequestKind" AS ENUM ('admission', 'project_expansion');

-- Extend notification types for linked admin alerts
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'access_request';

-- CreateTable
CREATE TABLE "access_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requester_email" TEXT NOT NULL,
    "requester_name" TEXT,
    "message" TEXT NOT NULL,
    "kind" "AccessRequestKind" NOT NULL DEFAULT 'admission',
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'pending',
    "request_count" INTEGER NOT NULL DEFAULT 1,
    "requested_project_keys" JSONB,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "last_requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_requests_requester_email_status_idx" ON "access_requests"("requester_email", "status");
CREATE INDEX "access_requests_status_last_requested_at_idx" ON "access_requests"("status", "last_requested_at" DESC);
CREATE INDEX "access_requests_requester_email_last_requested_at_idx" ON "access_requests"("requester_email", "last_requested_at" DESC);

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
