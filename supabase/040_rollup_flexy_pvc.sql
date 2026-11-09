-- 040_rollup_flexy_pvc.sql
--
-- Roll-up banners come in one size (80 × 200 cm, with stand) in two
-- materials: Flexy and PVC. Replaces the saved roll-up item list in the
-- Digital print rates (other items and rates are left alone).
--
-- The costs below are placeholders: set the real ones afterwards in
-- Admin → Settings → Digital print rates → Priced per piece.
-- Re-running this resets the two roll-up costs to these placeholders.

update public.settings
   set digital_quote_rates =
         coalesce(digital_quote_rates, '{}'::jsonb)
         || jsonb_build_object(
              'unit',
              coalesce(digital_quote_rates->'unit', '{}'::jsonb)
              || jsonb_build_object('rollup', '[
                   { "name": "Roll-up banner 80 × 200 cm, Flexy", "cost": 350 },
                   { "name": "Roll-up banner 80 × 200 cm, PVC",   "cost": 450 }
                 ]'::jsonb)
            ),
       updated_at = now()
 where id = 1;
