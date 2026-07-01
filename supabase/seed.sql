-- Seed: Slice 1 sample catalog (INR). Mirrors store/lib/catalog/seed.ts exactly.
--
-- NOTE: local rendering does NOT use this file — with no live Supabase in this box the app
-- renders from the typed in-repo seed (lib/catalog/seed.ts) via the query fallback. This SQL
-- is applied to the real DB at cloud-wiring time (`supabase db reset` / preview seed) so the
-- two stay identical. Deterministic UUIDs keep TS and SQL in lockstep. Idempotent.
--
-- Includes one DRAFT product (prototype-glass-sealant) to prove RLS/active-only filtering:
-- it must NOT appear on the PLP and must 404 on the PDP for the public role.

-- ---- categories ----
insert into public.categories (id, slug, name, description, position) values
  ('a0000000-0000-4000-8000-000000000001', 'exterior',     'Exterior Care', 'Washes, waxes and sealants for paintwork.', 0),
  ('a0000000-0000-4000-8000-000000000002', 'interior',     'Interior Care', 'Cabin, leather and trim detailing.',        1),
  ('a0000000-0000-4000-8000-000000000003', 'wheels-tyres', 'Wheels & Tyres','Wheel cleaners and tyre dressings.',        2)
on conflict (id) do nothing;

-- ---- products (p1..p7 active, p8 draft) ----
insert into public.products (id, slug, title, description, brand, status, created_at) values
  ('b0000000-0000-4000-8000-000000000001', 'ceramic-spray-wax',      'Ceramic Spray Wax',      'A spray-on SiO2 ceramic top coat for fast gloss and water beading between full details.', 'Whipoff', 'active',  '2026-06-20T10:00:00Z'),
  ('b0000000-0000-4000-8000-000000000002', 'snow-foam-shampoo',      'Snow Foam Shampoo',      'High-foaming pre-wash that lifts grime safely before contact washing.',                   'Whipoff', 'active',  '2026-06-19T10:00:00Z'),
  ('b0000000-0000-4000-8000-000000000003', 'microfiber-wash-mitt',   'Microfiber Wash Mitt',   'Plush, deep-pile mitt that traps dirt away from paint to avoid swirl marks.',             'Whipoff', 'active',  '2026-06-18T10:00:00Z'),
  ('b0000000-0000-4000-8000-000000000004', 'leather-conditioner',    'Leather Conditioner',    'pH-balanced conditioner that nourishes and protects leather seats and trim.',             'Whipoff', 'active',  '2026-06-17T10:00:00Z'),
  ('b0000000-0000-4000-8000-000000000005', 'dashboard-detailer',     'Dashboard Detailer',     'Anti-static interior dressing for dashboards and plastics, matte or gloss finish.',       'Whipoff', 'active',  '2026-06-16T10:00:00Z'),
  ('b0000000-0000-4000-8000-000000000006', 'tyre-shine-gel',         'Tyre Shine Gel',         'Long-lasting gel dressing for a deep satin-to-gloss tyre finish.',                        'Whipoff', 'active',  '2026-06-15T10:00:00Z'),
  ('b0000000-0000-4000-8000-000000000007', 'wheel-cleaner',          'Wheel Cleaner',          'Colour-changing acid-free cleaner that dissolves brake dust on all wheel finishes.',      'Whipoff', 'active',  '2026-06-14T10:00:00Z'),
  ('b0000000-0000-4000-8000-000000000008', 'prototype-glass-sealant','Prototype Glass Sealant','Unreleased hydrophobic glass coating — internal testing only.',                           'Whipoff', 'draft',   '2026-06-13T10:00:00Z')
on conflict (id) do nothing;

-- ---- product_categories ----
insert into public.product_categories (product_id, category_id) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000003')
on conflict do nothing;

-- ---- product_images (url is a placeholder token; UI renders a CSS gradient, see build_notes) ----
insert into public.product_images (id, product_id, url, alt, position) values
  ('d0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000001', 'gradient:ceramic-spray-wax:0',     'Ceramic Spray Wax bottle, front',  0),
  ('d0000000-0000-4000-8000-000000000102', 'b0000000-0000-4000-8000-000000000001', 'gradient:ceramic-spray-wax:1',     'Ceramic Spray Wax bottle, back',   1),
  ('d0000000-0000-4000-8000-000000000201', 'b0000000-0000-4000-8000-000000000002', 'gradient:snow-foam-shampoo:0',     'Snow Foam Shampoo bottle, front',  0),
  ('d0000000-0000-4000-8000-000000000202', 'b0000000-0000-4000-8000-000000000002', 'gradient:snow-foam-shampoo:1',     'Snow Foam Shampoo bottle, back',   1),
  ('d0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-000000000003', 'gradient:microfiber-wash-mitt:0',  'Microfiber Wash Mitt',             0),
  ('d0000000-0000-4000-8000-000000000401', 'b0000000-0000-4000-8000-000000000004', 'gradient:leather-conditioner:0',   'Leather Conditioner bottle, front',0),
  ('d0000000-0000-4000-8000-000000000402', 'b0000000-0000-4000-8000-000000000004', 'gradient:leather-conditioner:1',   'Leather Conditioner bottle, back', 1),
  ('d0000000-0000-4000-8000-000000000501', 'b0000000-0000-4000-8000-000000000005', 'gradient:dashboard-detailer:0',    'Dashboard Detailer bottle, front', 0),
  ('d0000000-0000-4000-8000-000000000502', 'b0000000-0000-4000-8000-000000000005', 'gradient:dashboard-detailer:1',    'Dashboard Detailer bottle, back',  1),
  ('d0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-000000000006', 'gradient:tyre-shine-gel:0',        'Tyre Shine Gel tub, front',        0),
  ('d0000000-0000-4000-8000-000000000602', 'b0000000-0000-4000-8000-000000000006', 'gradient:tyre-shine-gel:1',        'Tyre Shine Gel tub, back',         1),
  ('d0000000-0000-4000-8000-000000000701', 'b0000000-0000-4000-8000-000000000007', 'gradient:wheel-cleaner:0',         'Wheel Cleaner bottle, front',      0),
  ('d0000000-0000-4000-8000-000000000702', 'b0000000-0000-4000-8000-000000000007', 'gradient:wheel-cleaner:1',         'Wheel Cleaner bottle, back',       1),
  ('d0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-000000000008', 'gradient:prototype-glass-sealant:0','Prototype Glass Sealant bottle',  0)
on conflict (id) do nothing;

-- ---- variants (price_cents = INR paise; currency INR) ----
insert into public.variants (id, product_id, sku, title, price_cents, currency, inventory_count, position) values
  ('c0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000001', 'WO-CSW-500',   '500 ml',         129900, 'INR', 25,  0),
  ('c0000000-0000-4000-8000-000000000102', 'b0000000-0000-4000-8000-000000000001', 'WO-CSW-1000',  '1 L',            219900, 'INR', 12,  1),
  ('c0000000-0000-4000-8000-000000000201', 'b0000000-0000-4000-8000-000000000002', 'WO-SFS-1000',  '1 L',             69900, 'INR', 40,  0),
  ('c0000000-0000-4000-8000-000000000202', 'b0000000-0000-4000-8000-000000000002', 'WO-SFS-5000',  '5 L',            249900, 'INR',  8,  1),
  ('c0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-000000000003', 'WO-MWM-OS',    'One size',        44900, 'INR', 100, 0),
  ('c0000000-0000-4000-8000-000000000401', 'b0000000-0000-4000-8000-000000000004', 'WO-LC-250',    '250 ml',          89900, 'INR', 30,  0),
  ('c0000000-0000-4000-8000-000000000402', 'b0000000-0000-4000-8000-000000000004', 'WO-LC-500',    '500 ml',         149900, 'INR', 15,  1),
  ('c0000000-0000-4000-8000-000000000501', 'b0000000-0000-4000-8000-000000000005', 'WO-DD-MATTE',  'Matte 500 ml',    59900, 'INR', 20,  0),
  ('c0000000-0000-4000-8000-000000000502', 'b0000000-0000-4000-8000-000000000005', 'WO-DD-GLOSS',  'Gloss 500 ml',    59900, 'INR', 18,  1),
  ('c0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-000000000006', 'WO-TSG-500',   '500 ml',          74900, 'INR', 22,  0),
  ('c0000000-0000-4000-8000-000000000602', 'b0000000-0000-4000-8000-000000000006', 'WO-TSG-1000',  '1 L',            129900, 'INR',  0,  1),
  ('c0000000-0000-4000-8000-000000000701', 'b0000000-0000-4000-8000-000000000007', 'WO-WC-500',    '500 ml',          84900, 'INR', 17,  0),
  ('c0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-000000000008', 'WO-PGS-500',   '500 ml',          99900, 'INR',  5,  0)
on conflict (id) do nothing;
