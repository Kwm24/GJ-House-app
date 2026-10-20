-- 028_item_thumbnails.sql
-- Adds thumbnail_url column to items table and creates the item-thumbnails
-- storage bucket with appropriate RLS policies.

-- ── Column ─────────────────────────────────────────────────────────────────
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- ── Storage bucket ─────────────────────────────────────────────────────────
-- Public bucket so customers can view thumbnails without authentication.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'item-thumbnails',
  'item-thumbnails',
  true,
  2097152,  -- 2 MB limit
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS policies ────────────────────────────────────────────────────

-- CS staff can upload thumbnails
CREATE POLICY "CS can upload item thumbnails"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'item-thumbnails'
  AND (
    SELECT role FROM public.profiles WHERE user_id = auth.uid()
  ) IN ('cs', 'admin')
);

-- CS staff and admins can update/delete their own uploads
CREATE POLICY "CS can update item thumbnails"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'item-thumbnails'
  AND (
    SELECT role FROM public.profiles WHERE user_id = auth.uid()
  ) IN ('cs', 'admin')
);

CREATE POLICY "CS can delete item thumbnails"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'item-thumbnails'
  AND (
    SELECT role FROM public.profiles WHERE user_id = auth.uid()
  ) IN ('cs', 'admin')
);

-- Anyone (including unauthenticated) can read — bucket is public
CREATE POLICY "Public can read item thumbnails"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'item-thumbnails');
