-- 035_instant_quoter_thumbnails.sql
-- Adds instant_quoter_thumbnails JSONB column to settings.
-- Stores per-job-type thumbnail URLs for the Instant Quoter UI.

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS instant_quoter_thumbnails JSONB DEFAULT '{}'::jsonb;
