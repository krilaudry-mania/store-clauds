// =========================================================
// APLIKASI STOREFRONT — CLAUD'S STORE (Vanilla JS, tanpa React)
// =========================================================
import { supabase } from "./supabaseClient.js";
import {
  DEFAULT_STORE_NAME,
  DEFAULT_LOGO_URL,
  DEFAULT_KURS_LKR_KE_IDR,
  DEFAULT_WHATSAPP_ADMIN,
  DEFAULT_TELEGRAM_ADMIN,
} from "./config.js";
import { formatHargaLKR, formatHargaIDR, konversiLKRkeIDR, escapeHtml, debounce, svgPlaceholder, tampilkanToast } from "./utils.js";
import { initCart, tambahKeKeranjang, perbaruiTampilanKeranjang } from "./cart.js";
import { initChatbot } from "./chatbot.js";

const state = {
  produk: [],
  kategoriAktif: "Semua",
  kataKunciPencarian: "",
  mataUangAktif: "LKR",
  kurs: DEFAULT_KURS_LKR_KE_IDR,
  whatsapp: DEFAULT_WHATSAPP_ADMIN,
  telegram: DEFAULT_TELEGRAM_ADMIN,
};

document.addEventListener("DOMContentLoaded", async () => {
  lucide?.createIcons();
  await muatPengaturanToko();
  await muatProduk();
  pasangEventListener();
  initCart({ kurs: state.kurs, mataUangAktif: state.mataUangAktif, whatsapp: state.whatsapp, telegram: state.telegram });
  initChatbot({ whatsapp: state.whatsapp, telegram: state.telegram });
});

async function muatPengaturanToko() {
  try {
    const { data, error } = await supabase.from("store_settings").select("*").limit(1).single();
    if (!error && data) {
      state.kurs = Number(data.kurs_lkr_ke_idr) || DEFAULT_KURS_LKR_KE_IDR;
      state.whatsapp = data.whatsapp_admin || DEFAULT_WHATSAPP_ADMIN;
      state.telegram = data.telegram_admin || DEFAULT_TELEGRAM_ADMIN;
      document.getElementById("nama-toko-header").textContent = data.nama_toko || DEFAULT_STORE_NAME;
      document.getElementById("logo-toko").src = data.logo_url || DEFAULT_LOGO_URL;
      document.title = `${data.nama_toko || DEFAULT_STORE_NAME} | Toko Retail & Kebutuhan Expat`;
      return;
    }
  } catch (err) {
    console.warn("Memakai pengaturan toko default:", err);
  }
  document.getElementById("nama-toko-header").textContent = DEFAULT_STORE_NAME;
  document.getElementById("logo-toko").src = DEFAULT_LOGO_URL;
}

async function muatProduk() {
  const grid = document.getElementById("grid-produk");
  grid.innerHTML = `<p class="teks-status">Memuat produk...</p>`;
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("tampil", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    state.produk = data || [];
  } catch (err) {
    console.warn("Gagal memuat produk dari Supabase:", err);
    state.produk = [];
    grid.innerHTML = `<p class="teks-status">Belum ada produk yang tersedia saat ini.</p>`;
    return;
  }
  renderGridProduk();
}

function pasangEventListener() {
  // Toggle mata uang
  document.getElementById("toggle-mata-uang")?.addEventListener("change", (e) => {
    state.mataUangAktif = e.target.checked ? "IDR" : "LKR";
    document.getElementById("label-mata-uang").textContent = state.mataUangAktif;
    renderGridProduk();
    perbaruiTampilanKeranjang({ kurs: state.kurs, mataUangAktif: state.mataUangAktif, whatsapp: state.whatsapp, telegram: state.telegram });
  });

  // Pencarian produk
  document.getElementById("input-pencarian")?.addEventListener(
    "input",
    debounce((e) => {
      state.kataKunciPencarian = e.target.value.trim().toLowerCase();
      renderGridProduk();
    }, 200)
  );

  // Filter kategori (pill buttons)
  document.querySelectorAll(".pill-kategori").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pill-kategori").forEach((b) => b.classList.remove("pill-kategori--aktif"));
      btn.classList.add("pill-kategori--aktif");
      state.kategoriAktif = btn.dataset.kategori;
      renderGridProduk();
    });
  });

  // Tombol "Belanja Sekarang" di banner -> scroll ke grid produk
  document.getElementById("btn-belanja-sekarang")?.addEventListener("click", () => {
    document.getElementById("grid-produk")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function produkTersaring() {
  return state.produk.filter((p) => {
    const cocokKategori = state.kategoriAktif === "Semua" || p.kategori === state.kategoriAktif;
    const cocokPencarian =
      !state.kataKunciPencarian || p.nama_produk.toLowerCase().includes(state.kataKunciPencarian);
    return cocokKategori && cocokPencarian;
  });
}

function renderGridProduk() {
  const grid = document.getElementById("grid-produk");
  const daftar = produkTersaring();

  if (daftar.length === 0) {
    grid.innerHTML = `<p class="teks-status">Produk tidak ditemukan.</p>`;
    return;
  }

  grid.innerHTML = daftar.map((p) => kartuProdukHTML(p)).join("");

  grid.querySelectorAll(".btn-tambah-keranjang").forEach((btn) => {
    btn.addEventListener("click", () => {
      const produk = state.produk.find((p) => p.id === btn.dataset.id);
      if (produk) tambahKeKeranjang(produk);
    });
  });

  lucide?.createIcons();
}

function kartuProdukHTML(p) {
  const hargaTampil =
    state.mataUangAktif === "IDR"
      ? formatHargaIDR(konversiLKRkeIDR(p.harga_jual_lkr, state.kurs))
      : formatHargaLKR(p.harga_jual_lkr);

  const stokHabis = Number(p.stok) <= 0;
  const gambar = p.foto_url || svgPlaceholder(p.nama_produk);

  return `
    <article class="kartu-produk">
      <div class="kartu-produk__gambar-wrap">
        <img src="${escapeHtml(gambar)}" alt="${escapeHtml(p.nama_produk)}" class="kartu-produk__gambar" loading="lazy" />
        ${p.origin ? `<span class="badge-origin">${escapeHtml(p.origin)}</span>` : ""}
        ${stokHabis ? `<span class="badge-stok-habis">Stok Habis</span>` : ""}
      </div>
      <div class="kartu-produk__isi">
        <p class="kartu-produk__kategori">${escapeHtml(p.sub_kategori || p.kategori)}</p>
        <h3 class="kartu-produk__nama">${escapeHtml(p.nama_produk)}</h3>
        <p class="kartu-produk__harga">${hargaTampil}</p>
        <button
          type="button"
          class="btn-tambah-keranjang"
          data-id="${p.id}"
          ${stokHabis ? "disabled" : ""}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          Tambah ke Keranjang
        </button>
      </div>
    </article>`;
}
