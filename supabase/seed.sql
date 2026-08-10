-- Seed: single-product catalog (INR). Mirrors store/lib/catalog/seed.ts exactly.
--
-- NOTE: local rendering does NOT use this file — with no live Supabase in this box the app
-- renders from the typed in-repo seed (lib/catalog/seed.ts) via the query fallback. This SQL
-- is applied to the real DB at cloud-wiring time (`supabase db reset` / preview seed) so the
-- two stay identical. Deterministic UUIDs keep TS and SQL in lockstep. Idempotent.
--
-- Aligned to the Claude Design handoff (2026-07-01): one real active product (Whipoff Gloss
-- Wash) plus one unrelated DRAFT product (prototype-glass-sealant) that proves RLS/active-only
-- filtering — it must NOT appear on the PLP and must 404 on the PDP for the public role.

-- ---- categories ----
insert into public.categories (id, slug, name, description, position) values
  ('a0000000-0000-4000-8000-000000000001', 'exterior',     'Exterior Care', 'Washes, waxes and sealants for paintwork.', 0),
  ('a0000000-0000-4000-8000-000000000002', 'interior',     'Interior Care', 'Cabin, leather and trim detailing.',        1),
  ('a0000000-0000-4000-8000-000000000003', 'wheels-tyres', 'Wheels & Tyres','Wheel cleaners and tyre dressings.',        2)
on conflict (id) do nothing;

-- ---- products (p1 active — the real hero product; p8 draft) ----
insert into public.products (id, slug, title, description, brand, status, created_at) values
  ('b0000000-0000-4000-8000-000000000001', 'whipoff-gloss-wash',     'Whipoff Gloss Wash',     'The slick, high-foam Hydroilx™ gloss wash that lifts a fortnight of road film — and leaves your wax and ceramic dead untouched.', 'Whipoff', 'active', '2026-06-20T10:00:00Z'),
  ('b0000000-0000-4000-8000-000000000008', 'prototype-glass-sealant','Prototype Glass Sealant','Unreleased hydrophobic glass coating — internal testing only.',                                                                    'Whipoff', 'draft',  '2026-06-13T10:00:00Z')
on conflict (id) do nothing;

-- ---- product_categories ----
insert into public.product_categories (product_id, category_id) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000003')
on conflict do nothing;

-- ---- product_images (p1 uses real files in public/; p8 keeps the gradient placeholder) ----
insert into public.product_images (id, product_id, url, alt, position) values
  ('d0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000001', '/whipoff-product.png',        'Whipoff Gloss Wash box and bottle', 0),
  ('d0000000-0000-4000-8000-000000000102', 'b0000000-0000-4000-8000-000000000001', '/whipoff-bottle-cutout.png',  'Whipoff Gloss Wash bottle',         1),
  ('d0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-000000000008', 'gradient:prototype-glass-sealant:0', 'Prototype Glass Sealant bottle', 0)
on conflict (id) do nothing;

-- ---- variants (price_cents = INR paise; currency INR; p1 prices are the launch-sale price) ----
insert into public.variants (id, product_id, sku, title, price_cents, currency, inventory_count, position) values
  ('c0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000001', 'WO-GW-500',  '500 ml', 47000,  'INR', 60, 0),
  ('c0000000-0000-4000-8000-000000000102', 'b0000000-0000-4000-8000-000000000001', 'WO-GW-1000', '1 L',    79900,  'INR', 0,  1),
  ('c0000000-0000-4000-8000-000000000103', 'b0000000-0000-4000-8000-000000000001', 'WO-GW-2000', '2 L',    143900, 'INR', 0,  2),
  ('c0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-000000000008', 'WO-PGS-500', '500 ml', 99900,  'INR', 5,  0)
on conflict (id) do nothing;
