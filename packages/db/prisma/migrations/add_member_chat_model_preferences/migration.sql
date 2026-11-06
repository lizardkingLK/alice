-- CreateTable
CREATE TABLE "member_chat_model_preferences" (
    "user_id" UUID NOT NULL,
    "default_integration_id" UUID,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "member_chat_model_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "member_chat_model_preferences_default_integration_id_idx" ON "member_chat_model_preferences"("default_integration_id");

-- AddForeignKey
ALTER TABLE "member_chat_model_preferences" ADD CONSTRAINT "member_chat_model_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_chat_model_preferences" ADD CONSTRAINT "member_chat_model_preferences_default_integration_id_fkey" FOREIGN KEY ("default_integration_id") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_chat_model_preferences" ADD CONSTRAINT "member_chat_model_preferences_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preferences are service-role / API only (same posture as integrations).
REVOKE ALL ON TABLE "member_chat_model_preferences" FROM anon, authenticated;
ALTER TABLE "member_chat_model_preferences" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "member_chat_model_preferences" TO postgres, service_role;
