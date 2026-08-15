-- Allowlist context-menu Delete is a hard delete so the unique (kind, value)
-- key can be reused. Remove leftover soft-deleted rows (status = deleted).
DELETE FROM "access_allowlist" WHERE "status" = 'deleted';
