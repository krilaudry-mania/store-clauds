# CLAUD'S STORE — Vanilla JavaScript (Tanpa React)

Aplikasi e-commerce mobile-first untuk CLAUD'S STORE, dibangun murni dengan **HTML + CSS + Vanilla JavaScript (ES Modules)** dan terhubung ke **Supabase**.

## Struktur File

```
clauds-store/
├── index.html          → Halaman storefront (pelanggan)
├── admin.html           → Halaman dashboard admin
├── css/
│   ├── styles.css       → Styling storefront, keranjang, chatbot
│   └── admin.css        → Styling dashboard admin
├── js/
│   ├── config.js         → Kredensial Supabase & pengaturan default
│   ├── supabaseClient.js → Inisialisasi Supabase client
│   ├── utils.js           → Format harga, kompresi gambar WebP, toast, dll
│   ├── cart.js            → Logika keranjang & checkout WA/Telegram
│   ├── chatbot.js         → Bot FAQ dengan Fuse.js (fuzzy search) & eskalasi
│   ├── app.js             → Logika utama storefront
│   └── admin.js           → Logika dashboard admin (auth, CRUD, dll)
└── sql/
    └── schema.sql         → Skema tabel, RLS, storage bucket & data contoh
```

Tidak ada React/Vue/Angular sama sekali — semua rendering dilakukan lewat manipulasi DOM langsung (`document.querySelector`, template string, `innerHTML`).

## Langkah Setup

1. **Jalankan skrip SQL**
   Buka Supabase SQL Editor pada project Anda, lalu jalankan seluruh isi `sql/schema.sql`. Ini akan membuat tabel, kebijakan RLS, storage bucket, dan beberapa data contoh (produk & FAQ).

2. **Buat akun Admin**
   Di Supabase Dashboard → Authentication → Users → **Add User**, buat akun dengan email & password untuk login ke `admin.html`.

3. **Buka file di browser**
   Karena project ini memakai ES Modules (`<script type="module">`), file HTML **tidak bisa dibuka langsung lewat `file://`** — jalankan lewat server lokal, misalnya:
   ```bash
   npx serve .
   # atau
   python3 -m http.server 5500
   ```
   Lalu buka `http://localhost:5500/index.html` (storefront) dan `http://localhost:5500/admin.html` (admin).

4. **Deploy**
   Karena ini murni file statis (HTML/CSS/JS), Anda bisa langsung deploy ke Netlify, Vercel (static), GitHub Pages, atau hosting statis apa pun — tidak perlu proses build.

## Kredensial yang Sudah Ditanam (`js/config.js`)

- Supabase URL & Anon Key sudah diisi sesuai konfigurasi Anda.
- Nomor WhatsApp Admin, Username Telegram, dan Kurs awal juga sudah diisi sebagai default — namun nilai final tetap diambil dari tabel `store_settings` di Supabase (bisa diubah lewat menu **Pengaturan Toko** di admin).

## Catatan Penting

- **Kompresi gambar** dilakukan di sisi klien (Canvas API) sebelum upload — otomatis dikonversi ke WebP dan dikecilkan hingga ≤500KB.
- **Delete cascade & overwrite storage**: saat produk/logo dihapus atau diperbarui, file lama di Supabase Storage otomatis ikut terhapus (lihat `js/admin.js`).
- **RLS**: publik hanya bisa membaca produk yang `tampil = true`, serta FAQ & pengaturan toko. Semua tulis/ubah/hapus memerlukan sesi login admin (`auth.role() = 'authenticated'`).
- Karena `esm.sh` dan CDN lain diakses langsung dari browser pengguna, pastikan koneksi internet aktif saat aplikasi dijalankan.
