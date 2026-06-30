-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Enable RLS
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Allow authenticated users to read users" ON "users"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert users" ON "users"
  FOR INSERT TO authenticated WITH CHECK (true);
