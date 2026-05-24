-- Migration 002: Convert projects.highlights from string[] to {title, description, image}[]
-- Applied: by seedCms() during Task #47 (idempotent — safe to run multiple times).
--
-- The `highlights` column was originally a `jsonb` of `string[]`. Task #47
-- changed the TS type in lib/db/src/schema/index.ts to
-- `{ title: string; description: string; image: string }[]` so the public
-- ProjectDetail3 page can render rich highlight cards (numbered badge,
-- title, description, image). The column type is still `jsonb`, so no
-- DDL is needed; only the *contents* of existing rows need to be
-- migrated.
--
-- This UPDATE is idempotent: it only touches rows whose `highlights` is
-- an array AND contains at least one string element. Rows already in the
-- new object shape — including any rows edited via the new admin Projects
-- dashboard — are left untouched.

UPDATE projects
SET highlights = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN jsonb_typeof(elem) = 'string'
          THEN jsonb_build_object(
            'title',       elem #>> '{}',
            'description', '',
            'image',       ''
          )
        ELSE elem
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(highlights) elem
)
WHERE jsonb_typeof(highlights) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(highlights) e WHERE jsonb_typeof(e) = 'string'
  );
