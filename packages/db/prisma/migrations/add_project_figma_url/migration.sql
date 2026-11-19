-- One saved Figma resource link per project. OAuth credentials remain separate.
ALTER TABLE "projects"
  ADD COLUMN "figma_url" TEXT;
