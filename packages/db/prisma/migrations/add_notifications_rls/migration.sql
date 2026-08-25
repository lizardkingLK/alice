-- Enable RLS
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to insert their own notifications
CREATE POLICY "Allow authenticated insert"
  ON "notifications"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow authenticated users to select their own notifications
CREATE POLICY "Allow authenticated select"
  ON "notifications"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policy to allow authenticated users to update their own notifications
CREATE POLICY "Allow authenticated update"
  ON "notifications"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow authenticated users to delete their own notifications
CREATE POLICY "Allow authenticated delete"
  ON "notifications"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policy to allow service_role all access
CREATE POLICY "Allow service_role all"
  ON "notifications"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
