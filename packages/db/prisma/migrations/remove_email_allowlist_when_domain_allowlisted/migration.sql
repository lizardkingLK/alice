-- Email allowlist rows are redundant when the address domain is already
-- domain-allowlisted. Domain users get project access via project_members.
DELETE FROM "access_allowlist" AS email_row
WHERE email_row.kind = 'email'
  AND EXISTS (
    SELECT 1
    FROM "access_allowlist" AS domain_row
    WHERE domain_row.kind = 'domain'
      AND domain_row.status = 'active'
      AND LOWER(SPLIT_PART(email_row.value, '@', 2)) = LOWER(domain_row.value)
  );
