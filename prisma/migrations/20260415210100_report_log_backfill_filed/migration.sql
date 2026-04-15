INSERT INTO "report_moderation_log_entries" ("id", "report_id", "actor_id", "created_at", "kind", "visibility", "disposition", "body")
SELECT
  gen_random_uuid()::text,
  r."id",
  r."user_id",
  r."created_at",
  'REPORT_FILED',
  'PUBLIC',
  NULL,
  'Content report filed (legacy row; reporter message is not shown on the public log).'
FROM "Report" r
WHERE NOT EXISTS (
  SELECT 1
  FROM "report_moderation_log_entries" e
  WHERE e."report_id" = r."id" AND e."kind" = 'REPORT_FILED'
);
