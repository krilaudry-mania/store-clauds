// =========================================================
// UTILITAS BERSAMA — Vanilla JS murni
// =========================================================
import { MAX_IMAGE_SIZE_KB, MAX_IMAGE_DIMENSION } from "./config.js";

/** Format angka menjadi format mata uang Indonesia/Sri Lanka (tanpa simbol asing) */
export function formatAngka(nilai) {
  const n = Number(nilai) || 0;
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

export function formatHargaLKR(nilai) {
  return `LKR ${formatAngka(nilai)}`;
}

export function formatHargaIDR(nilai) {
  return `Rp ${formatAngka(nilai)}`;
}

/** Konversi harga LKR -> IDR berdasarkan kurs */
export function konversiLKRkeIDR(hargaLKR, kurs) {
  return Math.round(Number(hargaLKR) * Number(kurs));
}

/** Escape string agar aman disisipkan ke innerHTML */
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Debounce sederhana untuk input pencarian */
export function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Tampilkan toast notifikasi kecil di pojok bawah layar */
export function tampilkanToast(pesan, jenis = "info") {
  let wrap = document.getElementById("toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "toast-wrap";
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast--${jenis}`;
  toast.textContent = pesan;
  wrap.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast--show"));
  setTimeout(() => {
    toast.classList.remove("toast--show");
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

/**
 * Kompresi gambar sisi klien ke format WebP menggunakan Canvas API (vanilla JS).
 * Mengecilkan dimensi jika terlalu besar dan menurunkan kualitas bertahap
 * sampai ukuran file berada di bawah MAX_IMAGE_SIZE_KB.
 * @param {File} file - file gambar asli dari <input type="file">
 * @returns {Promise<File>} file baru berformat .webp
 */
export function kompresGambarKeWebP(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;
        const sisiTerpanjang = Math.max(width, height);
        if (sisiTerpanjang > MAX_IMAGE_DIMENSION) {
          const skala = MAX_IMAGE_DIMENSION / sisiTerpanjang;
          width = Math.round(width * skala);
          height = Math.round(height * skala);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const cobaKualitas = (kualitas) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Gagal mengompresi gambar."));
                return;
              }
              const ukuranKB = blob.size / 1024;
              if (ukuranKB <= MAX_IMAGE_SIZE_KB || kualitas <= 0.3) {
                const namaBaru = file.name.replace(/\.[^.]+$/, "") + ".webp";
                resolve(new File([blob], namaBaru, { type: "image/webp" }));
              } else {
                cobaKualitas(kualitas - 0.1);
              }
            },
            "image/webp",
            kualitas
          );
        };
        cobaKualitas(0.85);
      };
      img.onerror = () => reject(new Error("Gagal memuat gambar."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}

/** Buat elemen SVG placeholder produk (dipakai jika foto_url kosong) */
export function svgPlaceholder(teks = "?") {
  const inisial = escapeHtml(teks).slice(0, 1).toUpperCase();
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
      <rect width="300" height="300" fill="#F3F4F6"/>
      <text x="50%" y="50%" font-family="Inter, sans-serif" font-size="90" fill="#DC2626"
        text-anchor="middle" dominant-baseline="central">${inisial}</text>
    </svg>`)}`;
}
