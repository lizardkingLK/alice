-- AlterTable: project-scoped integrations bind to one projects.id
ALTER TABLE "integrations"
  ADD COLUMN "project_id" UUID;

-- AddForeignKey
ALTER TABLE "integrations"
  ADD CONSTRAINT "integrations_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "integrations_project_id_category_status_idx"
  ON "integrations"("project_id", "category", "status");

-- Scope invariants: organization ⇒ no project; project ⇒ project_id required
ALTER TABLE "integrations"
  ADD CONSTRAINT "integrations_scope_project_id_check"
  CHECK (
    ("scope" = 'organization' AND "project_id" IS NULL)
    OR ("scope" = 'project' AND "project_id" IS NOT NULL)
    OR ("scope" = 'member' AND "project_id" IS NULL)
  );
