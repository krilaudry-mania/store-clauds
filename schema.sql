-- =========================================================
-- CLAUD'S STORE — SUPABASE SCHEMA, RLS POLICIES & SEED DATA
-- Jalankan seluruh file ini di Supabase SQL Editor.
-- =========================================================

-- Ekstensi untuk UUID
create extension if not exists "pgcrypto";

-- =========================================================
-- 1. TABEL: store_settings (baris tunggal / singleton)
-- =========================================================
create table if not exists store_settings (
  id uuid primary key default gen_random_uuid(),
  nama_toko text not null default 'CLAUD''S STORE',
  logo_url text,
  logo_path text,
  kurs_lkr_ke_idr numeric not null default 54,
  whatsapp_admin text not null default '6281334331776',
  telegram_admin text not null default '@erlanggakuat',
  updated_at timestamptz not null default now()
);

insert into store_settings (nama_toko, logo_url, kurs_lkr_ke_idr, whatsapp_admin, telegram_admin)
select 'CLAUD''S STORE', 'https://i.imgur.com/mVG06zb.png', 54, '6281334331776', '@erlanggakuat'
where not exists (select 1 from store_settings);

-- =========================================================
-- 2. TABEL: products
-- =========================================================
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  nama_produk text not null,
  kategori text not null check (kategori in ('Rokok','Makanan','Fashion')),
  sub_kategori text,           -- contoh: 'Impor Indonesia', 'Sri Lanka / Lokal'
  origin text,                 -- 'Indonesia' atau 'Lokal'
  foto_url text,
  foto_path text,              -- path di storage bucket, untuk hapus cascade
  stok integer not null default 0,
  harga_modal numeric not null default 0,   -- dalam LKR
  harga_jual_lkr numeric not null default 0,
  tampil boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_kategori on products (kategori);
create index if not exists idx_products_tampil on products (tampil);

-- =========================================================
-- 3. TABEL: orders
-- =========================================================
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  nama_pembeli text not null,
  items jsonb not null,                 -- array of {product_id, nama, qty, harga_lkr}
  total_lkr numeric not null default 0,
  total_idr numeric not null default 0,
  mata_uang_aktif text not null default 'LKR',
  metode_pembayaran text not null check (metode_pembayaran in ('Tunai','Kasbon')),
  channel_pesan text,                   -- 'WhatsApp' atau 'Telegram'
  status text not null default 'Baru',
  created_at timestamptz not null default now()
);

-- =========================================================
-- 4. TABEL: debt_records (Kasbon / Hutang)
-- =========================================================
create table if not exists debt_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete set null,
  nama_pelanggan text not null,
  jumlah numeric not null default 0,
  tanggal date not null default current_date,
  status text not null default 'Belum Lunas' check (status in ('Belum Lunas','Lunas')),
  created_at timestamptz not null default now()
);

-- =========================================================
-- 5. TABEL: bot_settings (baris tunggal / singleton)
-- =========================================================
create table if not exists bot_settings (
  id uuid primary key default gen_random_uuid(),
  nama_bot text not null default 'Claud Assistant',
  avatar_url text,
  warna_aksen text not null default '#DC2626',
  pesan_sambutan text not null default 'Halo! Ada yang bisa Claud Assistant bantu seputar toko?',
  teaser_text text not null default 'Ada pertanyaan seputar toko? Tanya Claud Assistant di sini!',
  updated_at timestamptz not null default now()
);

insert into bot_settings (nama_bot, pesan_sambutan, teaser_text)
select 'Claud Assistant', 'Halo! Ada yang bisa Claud Assistant bantu seputar toko?', 'Ada pertanyaan seputar toko? Tanya Claud Assistant di sini!'
where not exists (select 1 from bot_settings);

-- =========================================================
-- 6. TABEL: bot_faqs
-- =========================================================
create table if not exists bot_faqs (
  id uuid primary key default gen_random_uuid(),
  pertanyaan text not null,
  jawaban text not null,
  kata_kunci text,           -- kata kunci dipisah koma, mis: "beli,pakaian,fashion,baju"
  created_at timestamptz not null default now()
);

insert into bot_faqs (pertanyaan, jawaban, kata_kunci)
select * from (values
  ('Bagaimana cara membeli pakaian disini?', 'Anda bisa memilih kategori Fashion di menu, tambahkan produk ke keranjang, lalu checkout melalui WhatsApp atau Telegram.', 'beli,pakaian,fashion,baju,cara pesan'),
  ('Apakah bisa bayar dengan Hutang / Kasbon?', 'Bisa. Saat checkout, pilih metode pembayaran "Hutang / Kasbon (Pay Later)" dan catatan akan disimpan oleh Admin.', 'kasbon,hutang,bayar nanti,cicil'),
  ('Berapa lama pengiriman?', 'Pengiriman biasanya 1-3 hari kerja tergantung lokasi. Silakan konfirmasi ke Admin via WhatsApp untuk estimasi pastinya.', 'kirim,pengiriman,ongkir,berapa lama'),
  ('Apakah harga sudah termasuk kurs terbaru?', 'Ya, harga otomatis dikonversi menggunakan kurs LKR ke IDR yang diperbarui oleh Admin di pengaturan toko.', 'kurs,harga,konversi,mata uang')
) as v(pertanyaan, jawaban, kata_kunci)
where not exists (select 1 from bot_faqs);

-- =========================================================
-- 7. STORAGE BUCKETS
-- =========================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('store-assets', 'store-assets', true)
on conflict (id) do nothing;

-- =========================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- =========================================================
alter table products enable row level security;
alter table orders enable row level security;
alter table debt_records enable row level security;
alter table bot_settings enable row level security;
alter table bot_faqs enable row level security;
alter table store_settings enable row level security;

-- --- products: publik hanya boleh baca produk yang tampil = true
drop policy if exists "public_read_products" on products;
create policy "public_read_products" on products
  for select using (tampil = true);

drop policy if exists "admin_all_products" on products;
create policy "admin_all_products" on products
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- --- orders: publik boleh insert (checkout), admin boleh baca/ubah semua
drop policy if exists "public_insert_orders" on orders;
create policy "public_insert_orders" on orders
  for insert with check (true);

drop policy if exists "admin_read_orders" on orders;
create policy "admin_read_orders" on orders
  for select using (auth.role() = 'authenticated');

drop policy if exists "admin_update_orders" on orders;
create policy "admin_update_orders" on orders
  for update using (auth.role() = 'authenticated');

-- --- debt_records: publik boleh insert (dari checkout kasbon), admin full akses
drop policy if exists "public_insert_debt" on debt_records;
create policy "public_insert_debt" on debt_records
  for insert with check (true);

drop policy if exists "admin_all_debt" on debt_records;
create policy "admin_all_debt" on debt_records
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- --- bot_settings & bot_faqs: publik boleh baca, admin boleh ubah
drop policy if exists "public_read_bot_settings" on bot_settings;
create policy "public_read_bot_settings" on bot_settings
  for select using (true);

drop policy if exists "admin_update_bot_settings" on bot_settings;
create policy "admin_update_bot_settings" on bot_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "public_read_bot_faqs" on bot_faqs;
create policy "public_read_bot_faqs" on bot_faqs
  for select using (true);

drop policy if exists "admin_all_bot_faqs" on bot_faqs;
create policy "admin_all_bot_faqs" on bot_faqs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- --- store_settings: publik boleh baca, admin boleh ubah
drop policy if exists "public_read_store_settings" on store_settings;
create policy "public_read_store_settings" on store_settings
  for select using (true);

drop policy if exists "admin_update_store_settings" on store_settings;
create policy "admin_update_store_settings" on store_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- =========================================================
-- 9. STORAGE POLICIES (product-images & store-assets)
-- =========================================================
drop policy if exists "public_read_product_images" on storage.objects;
create policy "public_read_product_images" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "admin_write_product_images" on storage.objects;
create policy "admin_write_product_images" on storage.objects
  for all using (bucket_id = 'product-images' and auth.role() = 'authenticated')
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

drop policy if exists "public_read_store_assets" on storage.objects;
create policy "public_read_store_assets" on storage.objects
  for select using (bucket_id = 'store-assets');

drop policy if exists "admin_write_store_assets" on storage.objects;
create policy "admin_write_store_assets" on storage.objects
  for all using (bucket_id = 'store-assets' and auth.role() = 'authenticated')
  with check (bucket_id = 'store-assets' and auth.role() = 'authenticated');

-- =========================================================
-- 10. SEED DATA PRODUK (contoh, sesuai mockup)
-- =========================================================
insert into products (nama_produk, kategori, sub_kategori, origin, foto_url, stok, harga_modal, harga_jual_lkr, tampil)
select * from (values
  ('Marlboro Red', 'Rokok', 'Impor Indonesia', 'Indonesia', null, 150, 1200::numeric, 1450::numeric, true),
  ('Sampoerna Mild', 'Rokok', 'Impor Indonesia', 'Indonesia', null, 120, 1050::numeric, 1300::numeric, true),
  ('Rokok Djarum Super', 'Rokok', 'Impor Indonesia', 'Indonesia', null, 90, 1000::numeric, 1300::numeric, true),
  ('Indomie Ayam Bawang', 'Makanan', null, 'Indonesia', null, 85, 300::numeric, 450::numeric, true),
  ('Oreo Original', 'Makanan', null, 'Lokal', null, 60, 280::numeric, 380::numeric, true),
  ('Coca-Cola 330ml', 'Makanan', null, 'Lokal', null, 100, 250::numeric, 350::numeric, true),
  ('ERIGO T-Shirt', 'Fashion', null, 'Indonesia', null, 40, 900::numeric, 1250::numeric, true),
  ('Headphone Wireless', 'Fashion', null, 'Lokal', null, 35, 5500::numeric, 7500::numeric, true)
) as v(nama_produk, kategori, sub_kategori, origin, foto_url, stok, harga_modal, harga_jual_lkr, tampil)
where not exists (select 1 from products);

-- =========================================================
-- SELESAI. Setelah menjalankan skrip ini:
-- 1. Buat user Admin lewat Supabase Auth > Users > Add User (email/password).
-- 2. Upload logo ke bucket 'store-assets' atau biarkan pakai URL default.
-- 3. Cek RLS aktif dan berjalan dari halaman storefront + admin.
-- =========================================================
