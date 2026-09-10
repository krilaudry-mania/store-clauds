// =========================================================
// KONFIGURASI TOKO — CLAUD'S STORE
// Ganti nilai di bawah ini sesuai kredensial Supabase Anda.
// =========================================================
export const SUPABASE_URL = "https://zqmytafrttsxskyxzfpr.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbXl0YWZydHRzeHNreXh6ZnByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5OTQ1ODYsImV4cCI6MjEwNDU3MDU4Nn0.3smB6-DJ3hf9PGtmKDcE77_9hydE52Xv-SHMVPu-2ks";

// Nilai default (akan ditimpa oleh data dari tabel store_settings saat runtime)
export const DEFAULT_STORE_NAME = "CLAUD'S STORE";
export const DEFAULT_LOGO_URL = "https://i.imgur.com/mVG06zb.png";
export const DEFAULT_KURS_LKR_KE_IDR = 54;
export const DEFAULT_WHATSAPP_ADMIN = "6281334331776";
export const DEFAULT_TELEGRAM_ADMIN = "@erlanggakuat";

// Bucket storage
export const BUCKET_PRODUCT_IMAGES = "product-images";
export const BUCKET_STORE_ASSETS = "store-assets";

// Batas kompresi gambar
export const MAX_IMAGE_SIZE_KB = 500;
export const MAX_IMAGE_DIMENSION = 1200; // px, sisi terpanjang
