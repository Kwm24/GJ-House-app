-- 043_tshirt_and_souvenir_items.sql
--
-- Per-piece product lists in the saved Digital print rates:
--   T-shirts : two types, Round neck and Polo shirt. "cost" = shirt + front
--              print, "backCost" = extra per piece to also print the back
--              (customers choose Front only / Front & back).
--   Souvenirs: "Magic (colour-changing) mug" → "Stanley cup / thermos flask"
--              "Paper cup"                   → "Paper bag"
--              (all other souvenirs and their costs are kept)
--
-- The new costs are placeholders: set the real ones in
-- Admin → Settings → Digital print rates → Priced per piece.
-- Only runs where rates were saved before; otherwise the app's defaults
-- already have the new lists. Re-running resets the T-shirt costs.

update public.settings
   set digital_quote_rates = jsonb_set(
         digital_quote_rates,
         '{unit}',
         (digital_quote_rates->'unit')
         || jsonb_build_object('tshirt', '[
              { "name": "Round neck T-shirt", "cost": 45, "backCost": 15 },
              { "name": "Polo shirt",         "cost": 65, "backCost": 15 }
            ]'::jsonb)
         || case
              when jsonb_typeof(digital_quote_rates->'unit'->'souvenir') = 'array' then
                jsonb_build_object('souvenir', (
                  select coalesce(jsonb_agg(
                           case item->>'name'
                             when 'Magic (colour-changing) mug' then '{"name": "Stanley cup / thermos flask", "cost": 150}'::jsonb
                             when 'Paper cup'                   then '{"name": "Paper bag", "cost": 5}'::jsonb
                             else item
                           end
                           order by ord), '[]'::jsonb)
                    from jsonb_array_elements(digital_quote_rates->'unit'->'souvenir') with ordinality as t(item, ord)
                ))
              else '{}'::jsonb
            end
       ),
       updated_at = now()
 where id = 1
   and jsonb_typeof(digital_quote_rates->'unit') = 'object';
