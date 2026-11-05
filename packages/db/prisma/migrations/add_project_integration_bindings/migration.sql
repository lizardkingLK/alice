-- CreateTable
CREATE TABLE "project_integration_bindings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "is_default_for_project" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_integration_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_integration_bindings_project_id_idx" ON "project_integration_bindings"("project_id");

-- CreateIndex
CREATE INDEX "project_integration_bindings_integration_id_idx" ON "project_integration_bindings"("integration_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_integration_bindings_project_id_integration_id_key" ON "project_integration_bindings"("project_id", "integration_id");

-- At most one default chat/integration binding per project.
CREATE UNIQUE INDEX "project_integration_bindings_project_default_key"
  ON "project_integration_bindings" ("project_id")
  WHERE "is_default_for_project" = true;

-- AddForeignKey
ALTER TABLE "project_integration_bindings" ADD CONSTRAINT "project_integration_bindings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_integration_bindings" ADD CONSTRAINT "project_integration_bindings_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_integration_bindings" ADD CONSTRAINT "project_integration_bindings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_integration_bindings" ADD CONSTRAINT "project_integration_bindings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bindings are service-role / API only (same posture as integrations).
REVOKE ALL ON TABLE "project_integration_bindings" FROM anon, authenticated;
ALTER TABLE "project_integration_bindings" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "project_integration_bindings" TO postgres, service_role;
