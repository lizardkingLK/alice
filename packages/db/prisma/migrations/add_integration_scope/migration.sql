-- CreateEnum
CREATE TYPE "IntegrationScope" AS ENUM ('organization', 'project', 'member');

-- AlterTable: existing rows become organization-scoped (Phase A).
ALTER TABLE "integrations"
  ADD COLUMN "scope" "IntegrationScope" NOT NULL DEFAULT 'organization';

-- CreateIndex
CREATE INDEX "integrations_scope_status_idx" ON "integrations"("scope", "status");
