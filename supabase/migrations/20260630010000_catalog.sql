-- Migration: Slice 1 catalog foundation — categories / products / images / variants (DDL + RLS).
-- Applied form of stages/01_data/output/{migration.sql,rls.sql} (combined, per Slice-0 precedent).
-- Forward-only; runs AFTER 20260630000000_init.sql. Never edit a shipped migration.
-- Apply (preview/branch first) at cloud-wiring time: `supabase db push`.
-- Conventions: _config/data_conventions.md (uuid PK, timestamptz, money minor units, snake_case).
-- Reuses public.set_updated_at() defined in the init migration — not redefined here.

-- ============================ DDL ============================

-- product lifecycle — closed set. Only 'active' is publicly readable (see RLS below).
create type public.product_status as enum ('draft', 'active', 'archived');

-- categories: browse grouping for the PLP.
create table if not exists public.categories (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  name        text        not null,
  description text,
  position    integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.categories is
  'Browse grouping for the catalog (PLP). Public-read.';

-- products: sellable car-care item as merchandised. Slug drives the PDP URL.
create table if not exists public.products (
  id          uuid                  primary key default gen_random_uuid(),
  slug        text                  not null unique,
  title       text                  not null,
  description text,
  brand       text,
  status      public.product_status not null default 'draft',
  created_at  timestamptz           not null default now(),
  updated_at  timestamptz           not null default now()
);
comment on table public.products is
  'Sellable car-care item as merchandised. Only status=active is publicly readable.';

-- product_images: ordered gallery per product. Cascade with the product.
create table if not exists public.product_images (
  id         uuid        primary key default gen_random_uuid(),
  product_id uuid        not null references public.products (id) on delete cascade,
  url        text        not null,
  alt        text,
  position   integer     not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.product_images is
  'Ordered gallery images for a product (lowest position first).';
create index if not exists product_images_product_id_idx
  on public.product_images (product_id);

-- variants: purchasable form of a product. Money = integer minor units + currency
-- (data_conventions.md / payments.md). Inventory is a count; checkout enforcement is Slice 3.
create table if not exists public.variants (
  id              uuid        primary key default gen_random_uuid(),
  product_id      uuid        not null references public.products (id) on delete cascade,
  sku             text        not null unique,
  title           text        not null,
  price_cents     integer     not null check (price_cents >= 0),
  currency        char(3)     not null default 'INR',
  inventory_count integer     not null default 0 check (inventory_count >= 0),
  position        integer     not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.variants is
  'Purchasable form of a product (size/scent); own SKU, price (minor units), inventory.';
create index if not exists variants_product_id_idx
  on public.variants (product_id);

-- product_categories: many-to-many (a product belongs to >= 1 category).
create table if not exists public.product_categories (
  product_id  uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (product_id, category_id)
);
comment on table public.product_categories is
  'Many-to-many: a product belongs to >= 1 category (glossary).';
create index if not exists product_categories_category_id_idx
  on public.product_categories (category_id);

-- updated_at triggers — reuse public.set_updated_at() from the init migration.
-- (product_images / product_categories are insert-mostly; no updated_at column.)
drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists variants_set_updated_at on public.variants;
create trigger variants_set_updated_at
  before update on public.variants
  for each row execute function public.set_updated_at();

-- ============================ RLS ============================
-- PUBLIC-READ (active products only); ALL writes default-denied (security_shield.md flaw #2).
-- Every table has RLS enabled with an EXPLICIT, INTENTIONAL select policy — public-read is
-- deliberate, not default-open. NO insert/update/delete policy on ANY catalog table → all
-- writes denied at the row level. Catalog authoring uses a guarded service-role path (which
-- bypasses RLS by design) in a later slice.
--
-- LOCKED DOWN (user decision): a product's child rows (images / variants / category links) are
-- readable ONLY when their parent product is active. Draft/archived products leak nothing —
-- not even a price or SKU — even to a client querying the database API directly.

-- products: the public may read ONLY active products; drafts/archived stay hidden.
alter table public.products enable row level security;
drop policy if exists products_select_public on public.products;
create policy products_select_public
  on public.products for select
  using ( status = 'active' );

-- categories: public read (store-wide browse facets; not product-specific).
alter table public.categories enable row level security;
drop policy if exists categories_select_public on public.categories;
create policy categories_select_public
  on public.categories for select
  using ( true );

-- product_images: public read ONLY when the parent product is active.
alter table public.product_images enable row level security;
drop policy if exists product_images_select_public on public.product_images;
create policy product_images_select_public
  on public.product_images for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.status = 'active'
    )
  );

-- variants: public read ONLY when the parent product is active (hides draft price/SKU).
alter table public.variants enable row level security;
drop policy if exists variants_select_public on public.variants;
create policy variants_select_public
  on public.variants for select
  using (
    exists (
      select 1 from public.products p
      where p.id = variants.product_id and p.status = 'active'
    )
  );

-- product_categories: public read ONLY for links whose product is active.
alter table public.product_categories enable row level security;
drop policy if exists product_categories_select_public on public.product_categories;
create policy product_categories_select_public
  on public.product_categories for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_categories.product_id and p.status = 'active'
    )
  );

-- WRITES (insert/update/delete): intentionally NO policy on any catalog table → all denied.
