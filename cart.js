// =========================================================
// KERANJANG BELANJA & CHECKOUT — Vanilla JS murni
// =========================================================
import { supabase } from "./supabaseClient.js";
import { formatHargaLKR, formatHargaIDR, konversiLKRkeIDR, escapeHtml, tampilkanToast } from "./utils.js";

// State keranjang disimpan di memori (array objek) selama sesi berjalan.
let keranjang = []; // { id, nama_produk, harga_jual_lkr, qty, foto_url }
let storeState = null; // diisi dari app.js: { kurs, mataUangAktif, whatsapp, telegram }

export function initCart(state) {
  storeState = state;
  document.getElementById("btn-buka-keranjang")?.addEventListener("click", bukaModalKeranjang);
  document.getElementById("btn-tutup-keranjang")?.addEventListener("click", tutupModalKeranjang);
  document.getElementById("overlay-keranjang")?.addEventListener("click", tutupModalKeranjang);
  document.getElementById("form-checkout")?.addEventListener("submit", (e) => e.preventDefault());
  document.getElementById("btn-pesan-whatsapp")?.addEventListener("click", () => prosesCheckout("WhatsApp"));
  document.getElementById("btn-pesan-telegram")?.addEventListener("click", () => prosesCheckout("Telegram"));
  renderBadgeKeranjang();
}

export function tambahKeKeranjang(produk) {
  const existing = keranjang.find((item) => item.id === produk.id);
  if (existing) {
    existing.qty += 1;
  } else {
    keranjang.push({
      id: produk.id,
      nama_produk: produk.nama_produk,
      harga_jual_lkr: produk.harga_jual_lkr,
      foto_url: produk.foto_url,
      qty: 1,
    });
  }
  renderBadgeKeranjang();
  tampilkanToast(`${produk.nama_produk} ditambahkan ke keranjang`, "sukses");
}

function ubahQty(id, delta) {
  const item = keranjang.find((i) => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    keranjang = keranjang.filter((i) => i.id !== id);
  }
  renderBadgeKeranjang();
  renderIsiKeranjang();
}

function hapusItem(id) {
  keranjang = keranjang.filter((i) => i.id !== id);
  renderBadgeKeranjang();
  renderIsiKeranjang();
}

function renderBadgeKeranjang() {
  const badge = document.getElementById("badge-keranjang");
  if (!badge) return;
  const totalItem = keranjang.reduce((sum, i) => sum + i.qty, 0);
  badge.textContent = totalItem;
  badge.style.display = totalItem > 0 ? "flex" : "none";
}

function hitungTotalLKR() {
  return keranjang.reduce((sum, i) => sum + i.harga_jual_lkr * i.qty, 0);
}

function renderIsiKeranjang() {
  const list = document.getElementById("list-item-keranjang");
  const kosong = document.getElementById("keranjang-kosong");
  const ringkasan = document.getElementById("ringkasan-checkout");
  if (!list) return;

  if (keranjang.length === 0) {
    list.innerHTML = "";
    kosong.style.display = "block";
    ringkasan.style.display = "none";
    return;
  }

  kosong.style.display = "none";
  ringkasan.style.display = "block";

  const kurs = storeState?.kurs || 54;
  const mataUang = storeState?.mataUangAktif || "LKR";

  list.innerHTML = keranjang
    .map((item) => {
      const subtotalLKR = item.harga_jual_lkr * item.qty;
      const hargaTampil =
        mataUang === "IDR" ? formatHargaIDR(konversiLKRkeIDR(item.harga_jual_lkr, kurs)) : formatHargaLKR(item.harga_jual_lkr);
      const subtotalTampil =
        mataUang === "IDR" ? formatHargaIDR(konversiLKRkeIDR(subtotalLKR, kurs)) : formatHargaLKR(subtotalLKR);

      return `
        <li class="item-keranjang" data-id="${item.id}">
          <img src="${escapeHtml(item.foto_url || "")}" alt="" class="item-keranjang__gambar" onerror="this.style.visibility='hidden'"/>
          <div class="item-keranjang__info">
            <p class="item-keranjang__nama">${escapeHtml(item.nama_produk)}</p>
            <p class="item-keranjang__harga">${hargaTampil} / pcs</p>
            <div class="item-keranjang__qty">
              <button type="button" class="btn-qty" data-aksi="kurang" data-id="${item.id}" aria-label="Kurangi jumlah">-</button>
              <span>${item.qty}</span>
              <button type="button" class="btn-qty" data-aksi="tambah" data-id="${item.id}" aria-label="Tambah jumlah">+</button>
            </div>
          </div>
          <div class="item-keranjang__aksi">
            <span class="item-keranjang__subtotal">${subtotalTampil}</span>
            <button type="button" class="btn-hapus-item" data-id="${item.id}" aria-label="Hapus produk">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/></svg>
            </button>
          </div>
        </li>`;
    })
    .join("");

  list.querySelectorAll(".btn-qty").forEach((btn) => {
    btn.addEventListener("click", () => {
      const delta = btn.dataset.aksi === "tambah" ? 1 : -1;
      ubahQty(btn.dataset.id, delta);
    });
  });
  list.querySelectorAll(".btn-hapus-item").forEach((btn) => {
    btn.addEventListener("click", () => hapusItem(btn.dataset.id));
  });

  const totalLKR = hitungTotalLKR();
  const totalTampil = mataUang === "IDR" ? formatHargaIDR(konversiLKRkeIDR(totalLKR, kurs)) : formatHargaLKR(totalLKR);
  document.getElementById("total-checkout").textContent = totalTampil;
}

function bukaModalKeranjang() {
  renderIsiKeranjang();
  document.getElementById("modal-keranjang").classList.add("modal--terbuka");
  document.body.style.overflow = "hidden";
}

function tutupModalKeranjang() {
  document.getElementById("modal-keranjang").classList.remove("modal--terbuka");
  document.body.style.overflow = "";
}

export function perbaruiTampilanKeranjang(state) {
  storeState = state;
  renderIsiKeranjang();
}

async function prosesCheckout(channel) {
  const namaInput = document.getElementById("input-nama-pembeli");
  const namaPembeli = namaInput?.value.trim();
  const metodeRadio = document.querySelector('input[name="metode-pembayaran"]:checked');

  if (keranjang.length === 0) {
    tampilkanToast("Keranjang Anda masih kosong.", "error");
    return;
  }
  if (!namaPembeli) {
    tampilkanToast("Mohon isi Nama Karyawan / Pembeli.", "error");
    namaInput?.focus();
    return;
  }
  if (!metodeRadio) {
    tampilkanToast("Mohon pilih metode pembayaran.", "error");
    return;
  }

  const metodePembayaran = metodeRadio.value; // 'Tunai' atau 'Kasbon'
  const kurs = storeState?.kurs || 54;
  const mataUang = storeState?.mataUangAktif || "LKR";
  const totalLKR = hitungTotalLKR();
  const totalIDR = konversiLKRkeIDR(totalLKR, kurs);

  // Susun teks pesan polos berbahasa Indonesia
  const barisItem = keranjang
    .map((item, idx) => {
      const subtotal = item.harga_jual_lkr * item.qty;
      return `${idx + 1}. ${item.nama_produk} x${item.qty} = LKR ${subtotal.toLocaleString("id-ID")}`;
    })
    .join("\n");

  const teksPesan =
    `*PESANAN BARU - CLAUD'S STORE*\n\n` +
    `Nama Pembeli: ${namaPembeli}\n` +
    `Metode Pembayaran: ${metodePembayaran === "Kasbon" ? "Hutang / Kasbon" : "Tunai"}\n\n` +
    `Rincian Pesanan:\n${barisItem}\n\n` +
    `Total (LKR): LKR ${totalLKR.toLocaleString("id-ID")}\n` +
    `Total (IDR): Rp ${totalIDR.toLocaleString("id-ID")}\n` +
    `Mata Uang Aktif: ${mataUang}`;

  // Simpan order ke Supabase (best-effort — checkout tetap lanjut walau gagal simpan)
  try {
    const { data: orderBaru, error } = await supabase
      .from("orders")
      .insert({
        nama_pembeli: namaPembeli,
        items: keranjang.map((i) => ({
          product_id: i.id,
          nama: i.nama_produk,
          qty: i.qty,
          harga_lkr: i.harga_jual_lkr,
        })),
        total_lkr: totalLKR,
        total_idr: totalIDR,
        mata_uang_aktif: mataUang,
        metode_pembayaran: metodePembayaran,
        channel_pesan: channel,
      })
      .select()
      .single();

    if (!error && metodePembayaran === "Kasbon") {
      await supabase.from("debt_records").insert({
        order_id: orderBaru?.id || null,
        nama_pelanggan: namaPembeli,
        jumlah: totalLKR,
        status: "Belum Lunas",
      });
    }
  } catch (err) {
    console.warn("Gagal menyimpan order ke Supabase:", err);
  }

  // Redirect ke WhatsApp / Telegram dengan teks pesanan sudah terisi
  const teksEncoded = encodeURIComponent(teksPesan);
  let url = "";
  if (channel === "WhatsApp") {
    const nomor = (storeState?.whatsapp || "").replace(/\D/g, "");
    url = `https://wa.me/${nomor}?text=${teksEncoded}`;
  } else {
    const username = (storeState?.telegram || "").replace("@", "");
    url = `https://t.me/${username}?text=${teksEncoded}`;
  }

  keranjang = [];
  renderBadgeKeranjang();
  tutupModalKeranjang();
  window.open(url, "_blank");
}

export function getJumlahItemKeranjang() {
  return keranjang.reduce((sum, i) => sum + i.qty, 0);
}
