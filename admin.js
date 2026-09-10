// =========================================================
// ADMIN DASHBOARD — CLAUD'S STORE (Vanilla JS, tanpa React)
// =========================================================
import { supabase } from "./supabaseClient.js";
import { BUCKET_PRODUCT_IMAGES, BUCKET_STORE_ASSETS } from "./config.js";
import { formatHargaLKR, escapeHtml, kompresGambarKeWebP, tampilkanToast, svgPlaceholder } from "./utils.js";

// ---------------------------------------------------------
// STATE
// ---------------------------------------------------------
let produkList = [];
let debtList = [];
let orderList = [];
let faqList = [];
let storeSettings = null;
let produkSedangDiedit = null; // id produk yg sedang diedit, null = tambah baru
let faqSedangDiedit = null;
let fileFotoBaru = null; // File webp hasil kompresi untuk produk
let fileLogoBaru = null;

// ---------------------------------------------------------
// INISIALISASI
// ---------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  lucide?.createIcons();
  pasangEventLogin();
  pasangEventSidebar();
  pasangEventProduk();
  pasangEventFaq();
  pasangEventSettings();
  cekSesiLogin();
});

async function cekSesiLogin() {
  const { data } = await supabase.auth.getSession();
  if (data?.session) {
    tampilkanDashboard();
  } else {
    tampilkanLayarLogin();
  }

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") tampilkanLayarLogin();
  });
}

function tampilkanLayarLogin() {
  document.getElementById("layar-login").style.display = "flex";
  document.getElementById("admin-shell").classList.remove("admin-shell--aktif");
}

async function tampilkanDashboard() {
  document.getElementById("layar-login").style.display = "none";
  document.getElementById("admin-shell").classList.add("admin-shell--aktif");
  await muatSemuaData();
  renderDashboard();
  renderTabelProduk();
  renderTabelKasbon();
  renderTabelFaq();
  isiFormSettings();
}

// ---------------------------------------------------------
// LOGIN / LOGOUT
// ---------------------------------------------------------
function pasangEventLogin() {
  document.getElementById("form-login")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("input-email-login").value.trim();
    const password = document.getElementById("input-password-login").value;
    const pesanError = document.getElementById("pesan-error-login");
    pesanError.textContent = "";

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      pesanError.textContent = "Email atau kata sandi salah. Silakan coba lagi.";
      return;
    }
    tampilkanDashboard();
  });

  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    tampilkanLayarLogin();
  });
}

// ---------------------------------------------------------
// SIDEBAR & NAVIGASI TAB
// ---------------------------------------------------------
function pasangEventSidebar() {
  document.getElementById("btn-buka-sidebar")?.addEventListener("click", () => {
    document.getElementById("admin-sidebar").classList.add("admin-sidebar--terbuka");
    document.getElementById("admin-overlay-sidebar").classList.add("admin-overlay-sidebar--aktif");
  });
  document.getElementById("admin-overlay-sidebar")?.addEventListener("click", tutupSidebar);

  document.querySelectorAll(".admin-nav__item").forEach((item) => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".admin-nav__item").forEach((i) => i.classList.remove("admin-nav__item--aktif"));
      item.classList.add("admin-nav__item--aktif");

      document.querySelectorAll(".tab-konten").forEach((tab) => (tab.style.display = "none"));
      document.getElementById(`tab-${item.dataset.tab}`).style.display = "block";
      document.getElementById("admin-topbar-judul").textContent = item.dataset.label;
      tutupSidebar();
    });
  });
}

function tutupSidebar() {
  document.getElementById("admin-sidebar").classList.remove("admin-sidebar--terbuka");
  document.getElementById("admin-overlay-sidebar").classList.remove("admin-overlay-sidebar--aktif");
}

// ---------------------------------------------------------
// MUAT SEMUA DATA DARI SUPABASE
// ---------------------------------------------------------
async function muatSemuaData() {
  const [{ data: produk }, { data: debt }, { data: orders }, { data: faqs }, { data: settings }] = await Promise.all([
    supabase.from("products").select("*").order("created_at", { ascending: false }),
    supabase.from("debt_records").select("*").order("tanggal", { ascending: false }),
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
    supabase.from("bot_faqs").select("*").order("created_at", { ascending: false }),
    supabase.from("store_settings").select("*").limit(1).single(),
  ]);

  produkList = produk || [];
  debtList = debt || [];
  orderList = orders || [];
  faqList = faqs || [];
  storeSettings = settings || null;
}

// ---------------------------------------------------------
// DASHBOARD RINGKASAN
// ---------------------------------------------------------
function renderDashboard() {
  const totalPendapatan = orderList.reduce((sum, o) => sum + Number(o.total_lkr || 0), 0);

  const labaBersih = orderList.reduce((sum, o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    const labaOrder = items.reduce((s, item) => {
      const produk = produkList.find((p) => p.id === item.product_id);
      const modal = produk ? Number(produk.harga_modal) : 0;
      return s + (Number(item.harga_lkr) - modal) * Number(item.qty);
    }, 0);
    return sum + labaOrder;
  }, 0);

  const totalKasbon = debtList
    .filter((d) => d.status === "Belum Lunas")
    .reduce((sum, d) => sum + Number(d.jumlah || 0), 0);

  const saldoTunai = orderList
    .filter((o) => o.metode_pembayaran === "Tunai")
    .reduce((sum, o) => sum + Number(o.total_lkr || 0), 0);

  const totalStok = produkList.reduce((sum, p) => sum + Number(p.stok || 0), 0);

  document.getElementById("stat-total-pendapatan").textContent = formatHargaLKR(totalPendapatan);
  document.getElementById("stat-laba-bersih").textContent = formatHargaLKR(labaBersih);
  document.getElementById("stat-total-kasbon").textContent = formatHargaLKR(totalKasbon);
  document.getElementById("stat-total-stok").textContent = `${totalStok} Item`;

  document.getElementById("analitik-saldo-tunai").textContent = formatHargaLKR(saldoTunai);
  document.getElementById("analitik-piutang").textContent = formatHargaLKR(totalKasbon);
}

// ===========================================================
// MANAJEMEN PRODUK (CRUD)
// ===========================================================
function pasangEventProduk() {
  document.getElementById("btn-tambah-produk")?.addEventListener("click", () => bukaModalProduk(null));
  document.getElementById("btn-tutup-modal-produk")?.addEventListener("click", tutupModalProduk);
  document.getElementById("overlay-modal-produk")?.addEventListener("click", (e) => {
    if (e.target.id === "overlay-modal-produk") tutupModalProduk();
  });

  document.getElementById("input-foto-produk")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      tampilkanToast("Mengompresi gambar...", "info");
      fileFotoBaru = await kompresGambarKeWebP(file);
      document.getElementById("preview-foto-produk").src = URL.createObjectURL(fileFotoBaru);
      tampilkanToast(`Gambar dikompresi menjadi ${(fileFotoBaru.size / 1024).toFixed(0)} KB`, "sukses");
    } catch (err) {
      tampilkanToast("Gagal mengompresi gambar.", "error");
      console.error(err);
    }
  });

  document.getElementById("form-produk")?.addEventListener("submit", simpanProduk);

  document.getElementById("input-cari-produk")?.addEventListener("input", (e) => {
    renderTabelProduk(e.target.value.trim().toLowerCase());
  });
}

function renderTabelProduk(katakunci = "") {
  const tbody = document.getElementById("tbody-produk");
  const daftar = produkList.filter((p) => !katakunci || p.nama_produk.toLowerCase().includes(katakunci));

  if (daftar.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="teks-kosong-tabel">Belum ada produk.</td></tr>`;
    return;
  }

  tbody.innerHTML = daftar
    .map((p, idx) => {
      const tersedia = Number(p.stok) > 0;
      return `
        <tr>
          <td>${idx + 1}</td>
          <td><img class="gambar-tabel" src="${escapeHtml(p.foto_url || svgPlaceholder(p.nama_produk))}" alt="" /></td>
          <td>${escapeHtml(p.nama_produk)}</td>
          <td>${escapeHtml(p.kategori)}</td>
          <td>${p.stok}</td>
          <td>${formatHargaLKR(p.harga_modal)}</td>
          <td>${formatHargaLKR(p.harga_jual_lkr)}</td>
          <td><span class="badge-status ${tersedia ? "badge-status--tersedia" : "badge-status--habis"}">${tersedia ? "Tersedia" : "Habis"}</span></td>
          <td>
            <div class="aksi-tabel">
              <button type="button" class="btn-icon-tabel btn-icon-tabel--edit" data-id="${p.id}" data-aksi="edit" title="Ubah">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </button>
              <button type="button" class="btn-icon-tabel btn-icon-tabel--hapus" data-id="${p.id}" data-aksi="hapus" title="Hapus">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  tbody.querySelectorAll('[data-aksi="edit"]').forEach((btn) => {
    btn.addEventListener("click", () => bukaModalProduk(produkList.find((p) => p.id === btn.dataset.id)));
  });
  tbody.querySelectorAll('[data-aksi="hapus"]').forEach((btn) => {
    btn.addEventListener("click", () => hapusProduk(btn.dataset.id));
  });
}

function bukaModalProduk(produk) {
  produkSedangDiedit = produk?.id || null;
  fileFotoBaru = null;

  document.getElementById("judul-modal-produk").textContent = produk ? "Ubah Produk" : "Tambah Produk";
  document.getElementById("input-nama-produk").value = produk?.nama_produk || "";
  document.getElementById("input-kategori-produk").value = produk?.kategori || "Rokok";
  document.getElementById("input-subkategori-produk").value = produk?.sub_kategori || "";
  document.getElementById("input-origin-produk").value = produk?.origin || "Indonesia";
  document.getElementById("input-stok-produk").value = produk?.stok ?? 0;
  document.getElementById("input-modal-produk").value = produk?.harga_modal ?? 0;
  document.getElementById("input-jual-produk").value = produk?.harga_jual_lkr ?? 0;
  document.getElementById("input-tampil-produk").checked = produk ? produk.tampil : true;
  document.getElementById("preview-foto-produk").src = produk?.foto_url || svgPlaceholder(produk?.nama_produk || "?");
  document.getElementById("input-foto-produk").value = "";

  document.getElementById("overlay-modal-produk").classList.add("overlay-form-modal--aktif");
}

function tutupModalProduk() {
  document.getElementById("overlay-modal-produk").classList.remove("overlay-form-modal--aktif");
}

async function simpanProduk(e) {
  e.preventDefault();
  const btnSubmit = e.target.querySelector('button[type="submit"]');
  btnSubmit.disabled = true;
  btnSubmit.textContent = "Menyimpan...";

  try {
    const dataProduk = {
      nama_produk: document.getElementById("input-nama-produk").value.trim(),
      kategori: document.getElementById("input-kategori-produk").value,
      sub_kategori: document.getElementById("input-subkategori-produk").value.trim() || null,
      origin: document.getElementById("input-origin-produk").value,
      stok: Number(document.getElementById("input-stok-produk").value),
      harga_modal: Number(document.getElementById("input-modal-produk").value),
      harga_jual_lkr: Number(document.getElementById("input-jual-produk").value),
      tampil: document.getElementById("input-tampil-produk").checked,
      updated_at: new Date().toISOString(),
    };

    let produkLama = produkSedangDiedit ? produkList.find((p) => p.id === produkSedangDiedit) : null;

    // Upload foto baru jika ada
    if (fileFotoBaru) {
      const pathBaru = `produk/${Date.now()}-${fileFotoBaru.name}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET_PRODUCT_IMAGES).upload(pathBaru, fileFotoBaru);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(BUCKET_PRODUCT_IMAGES).getPublicUrl(pathBaru);
      dataProduk.foto_url = urlData.publicUrl;
      dataProduk.foto_path = pathBaru;

      // Hapus foto lama dari storage agar tidak jadi file yatim
      if (produkLama?.foto_path) {
        await supabase.storage.from(BUCKET_PRODUCT_IMAGES).remove([produkLama.foto_path]);
      }
    }

    if (produkSedangDiedit) {
      const { error } = await supabase.from("products").update(dataProduk).eq("id", produkSedangDiedit);
      if (error) throw error;
      tampilkanToast("Produk berhasil diperbarui.", "sukses");
    } else {
      const { error } = await supabase.from("products").insert(dataProduk);
      if (error) throw error;
      tampilkanToast("Produk baru berhasil ditambahkan.", "sukses");
    }

    tutupModalProduk();
    await muatSemuaData();
    renderTabelProduk();
    renderDashboard();
  } catch (err) {
    console.error(err);
    tampilkanToast("Gagal menyimpan produk. Periksa kembali data Anda.", "error");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Simpan Produk";
  }
}

async function hapusProduk(id) {
  if (!confirm("Yakin ingin menghapus produk ini? Foto produk juga akan dihapus dari storage.")) return;

  const produk = produkList.find((p) => p.id === id);
  try {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;

    // Delete cascade: hapus juga file gambar dari storage bucket
    if (produk?.foto_path) {
      await supabase.storage.from(BUCKET_PRODUCT_IMAGES).remove([produk.foto_path]);
    }

    tampilkanToast("Produk berhasil dihapus.", "sukses");
    await muatSemuaData();
    renderTabelProduk();
    renderDashboard();
  } catch (err) {
    console.error(err);
    tampilkanToast("Gagal menghapus produk.", "error");
  }
}

// ===========================================================
// MANAJEMEN KASBON / HUTANG
// ===========================================================
function renderTabelKasbon() {
  const tbody = document.getElementById("tbody-kasbon");

  if (debtList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="teks-kosong-tabel">Belum ada catatan kasbon.</td></tr>`;
    return;
  }

  tbody.innerHTML = debtList
    .map((d) => {
      const lunas = d.status === "Lunas";
      return `
        <tr>
          <td>${escapeHtml(d.nama_pelanggan)}</td>
          <td>${formatHargaLKR(d.jumlah)}</td>
          <td>${new Date(d.tanggal).toLocaleDateString("id-ID")}</td>
          <td><span class="badge-status ${lunas ? "badge-status--lunas" : "badge-status--belum-lunas"}">${lunas ? "Lunas" : "Belum Lunas"}</span></td>
          <td>
            ${lunas ? "-" : `<button type="button" class="btn-icon-tabel btn-icon-tabel--lunas" data-id="${d.id}" data-aksi="lunas">Tandai Lunas</button>`}
          </td>
        </tr>`;
    })
    .join("");

  tbody.querySelectorAll('[data-aksi="lunas"]').forEach((btn) => {
    btn.addEventListener("click", () => tandaiLunas(btn.dataset.id));
  });
}

async function tandaiLunas(id) {
  try {
    const { error } = await supabase.from("debt_records").update({ status: "Lunas" }).eq("id", id);
    if (error) throw error;
    tampilkanToast("Kasbon ditandai lunas.", "sukses");
    await muatSemuaData();
    renderTabelKasbon();
    renderDashboard();
  } catch (err) {
    console.error(err);
    tampilkanToast("Gagal memperbarui status kasbon.", "error");
  }
}

// ===========================================================
// MANAJEMEN FAQ & BOT
// ===========================================================
function pasangEventFaq() {
  document.getElementById("btn-tambah-faq")?.addEventListener("click", () => bukaModalFaq(null));
  document.getElementById("btn-tutup-modal-faq")?.addEventListener("click", tutupModalFaq);
  document.getElementById("overlay-modal-faq")?.addEventListener("click", (e) => {
    if (e.target.id === "overlay-modal-faq") tutupModalFaq();
  });
  document.getElementById("form-faq")?.addEventListener("submit", simpanFaq);
}

function renderTabelFaq() {
  const tbody = document.getElementById("tbody-faq");

  if (faqList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="teks-kosong-tabel">Belum ada FAQ.</td></tr>`;
    return;
  }

  tbody.innerHTML = faqList
    .map(
      (f) => `
        <tr>
          <td>${escapeHtml(f.pertanyaan)}</td>
          <td>${escapeHtml(f.jawaban)}</td>
          <td>
            <div class="aksi-tabel">
              <button type="button" class="btn-icon-tabel btn-icon-tabel--edit" data-id="${f.id}" data-aksi="edit" title="Ubah">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </button>
              <button type="button" class="btn-icon-tabel btn-icon-tabel--hapus" data-id="${f.id}" data-aksi="hapus" title="Hapus">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/></svg>
              </button>
            </div>
          </td>
        </tr>`
    )
    .join("");

  tbody.querySelectorAll('[data-aksi="edit"]').forEach((btn) => {
    btn.addEventListener("click", () => bukaModalFaq(faqList.find((f) => f.id === btn.dataset.id)));
  });
  tbody.querySelectorAll('[data-aksi="hapus"]').forEach((btn) => {
    btn.addEventListener("click", () => hapusFaq(btn.dataset.id));
  });
}

function bukaModalFaq(faq) {
  faqSedangDiedit = faq?.id || null;
  document.getElementById("judul-modal-faq").textContent = faq ? "Ubah FAQ" : "Tambah FAQ";
  document.getElementById("input-pertanyaan-faq").value = faq?.pertanyaan || "";
  document.getElementById("input-jawaban-faq").value = faq?.jawaban || "";
  document.getElementById("input-kata-kunci-faq").value = faq?.kata_kunci || "";
  document.getElementById("overlay-modal-faq").classList.add("overlay-form-modal--aktif");
}

function tutupModalFaq() {
  document.getElementById("overlay-modal-faq").classList.remove("overlay-form-modal--aktif");
}

async function simpanFaq(e) {
  e.preventDefault();
  const dataFaq = {
    pertanyaan: document.getElementById("input-pertanyaan-faq").value.trim(),
    jawaban: document.getElementById("input-jawaban-faq").value.trim(),
    kata_kunci: document.getElementById("input-kata-kunci-faq").value.trim(),
  };

  try {
    if (faqSedangDiedit) {
      const { error } = await supabase.from("bot_faqs").update(dataFaq).eq("id", faqSedangDiedit);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("bot_faqs").insert(dataFaq);
      if (error) throw error;
    }
    tampilkanToast("FAQ berhasil disimpan.", "sukses");
    tutupModalFaq();
    await muatSemuaData();
    renderTabelFaq();
  } catch (err) {
    console.error(err);
    tampilkanToast("Gagal menyimpan FAQ.", "error");
  }
}

async function hapusFaq(id) {
  if (!confirm("Yakin ingin menghapus FAQ ini?")) return;
  try {
    const { error } = await supabase.from("bot_faqs").delete().eq("id", id);
    if (error) throw error;
    tampilkanToast("FAQ berhasil dihapus.", "sukses");
    await muatSemuaData();
    renderTabelFaq();
  } catch (err) {
    console.error(err);
    tampilkanToast("Gagal menghapus FAQ.", "error");
  }
}

// ===========================================================
// PENGATURAN TOKO
// ===========================================================
function pasangEventSettings() {
  document.getElementById("input-logo-toko-upload")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      fileLogoBaru = await kompresGambarKeWebP(file);
      document.getElementById("preview-logo-toko").src = URL.createObjectURL(fileLogoBaru);
    } catch (err) {
      tampilkanToast("Gagal memproses logo.", "error");
    }
  });

  document.getElementById("form-settings")?.addEventListener("submit", simpanSettings);
}

function isiFormSettings() {
  if (!storeSettings) return;
  document.getElementById("input-nama-toko-settings").value = storeSettings.nama_toko || "";
  document.getElementById("preview-logo-toko").src = storeSettings.logo_url || "";
  document.getElementById("input-kurs-settings").value = storeSettings.kurs_lkr_ke_idr || 54;
  document.getElementById("input-whatsapp-settings").value = storeSettings.whatsapp_admin || "";
  document.getElementById("input-telegram-settings").value = storeSettings.telegram_admin || "";
}

async function simpanSettings(e) {
  e.preventDefault();
  const btnSubmit = e.target.querySelector('button[type="submit"]');
  btnSubmit.disabled = true;

  try {
    const dataSettings = {
      nama_toko: document.getElementById("input-nama-toko-settings").value.trim(),
      kurs_lkr_ke_idr: Number(document.getElementById("input-kurs-settings").value),
      whatsapp_admin: document.getElementById("input-whatsapp-settings").value.trim(),
      telegram_admin: document.getElementById("input-telegram-settings").value.trim(),
      updated_at: new Date().toISOString(),
    };

    if (fileLogoBaru) {
      const pathBaru = `logo/${Date.now()}-${fileLogoBaru.name}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET_STORE_ASSETS).upload(pathBaru, fileLogoBaru);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(BUCKET_STORE_ASSETS).getPublicUrl(pathBaru);
      dataSettings.logo_url = urlData.publicUrl;
      dataSettings.logo_path = pathBaru;

      if (storeSettings?.logo_path) {
        await supabase.storage.from(BUCKET_STORE_ASSETS).remove([storeSettings.logo_path]);
      }
    }

    const { error } = await supabase.from("store_settings").update(dataSettings).eq("id", storeSettings.id);
    if (error) throw error;

    tampilkanToast("Pengaturan toko berhasil disimpan.", "sukses");
    fileLogoBaru = null;
    await muatSemuaData();
    isiFormSettings();
  } catch (err) {
    console.error(err);
    tampilkanToast("Gagal menyimpan pengaturan toko.", "error");
  } finally {
    btnSubmit.disabled = false;
  }
}
