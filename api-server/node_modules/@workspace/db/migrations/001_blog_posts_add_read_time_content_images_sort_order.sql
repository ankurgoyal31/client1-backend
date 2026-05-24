-- Migration 001: Add read_time, content_images, sort_order to blog_posts
-- Applied: manually via executeSql on 2025-05-01 (Task #25)

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS read_time TEXT,
  ADD COLUMN IF NOT EXISTS content_images JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0 NOT NULL;
