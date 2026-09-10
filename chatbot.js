// =========================================================
// SMART LIVE CHAT BOT / FAQ — Vanilla JS + Fuse.js (CDN, non-React)
// =========================================================
import { supabase } from "./supabaseClient.js";
import { escapeHtml } from "./utils.js";

let fuse = null;
let faqList = [];
let botSettings = {
  nama_bot: "Claud Assistant",
  avatar_url: "",
  warna_aksen: "#DC2626",
  pesan_sambutan: "Halo! Ada yang bisa Claud Assistant bantu seputar toko?",
  teaser_text: "Ada pertanyaan seputar toko? Tanya Claud Assistant di sini!",
};
let jumlahGagalBerturut = 0;
let storeContact = { whatsapp: "", telegram: "" };

export async function initChatbot(contact) {
  storeContact = contact;

  await muatPengaturanBot();
  await muatFaq();

  renderTeaserBanner();
  renderHeaderBot();
  renderPesanSambutan();

  document.getElementById("btn-toggle-chat")?.addEventListener("click", toggleChatWidget);
  document.getElementById("btn-tutup-chat")?.addEventListener("click", tutupChatWidget);
  document.getElementById("form-chat")?.addEventListener("submit", (e) => {
    e.preventDefault();
    kirimPesanPengguna();
  });
}

async function muatPengaturanBot() {
  try {
    const { data, error } = await supabase.from("bot_settings").select("*").limit(1).single();
    if (!error && data) botSettings = { ...botSettings, ...data };
  } catch (err) {
    console.warn("Memakai pengaturan bot default:", err);
  }
}

async function muatFaq() {
  try {
    const { data, error } = await supabase.from("bot_faqs").select("*");
    if (!error && data) faqList = data;
  } catch (err) {
    console.warn("Gagal memuat FAQ, memakai daftar kosong:", err);
    faqList = [];
  }

  // Inisialisasi Fuse.js untuk fuzzy matching (vanilla, dimuat via CDN di HTML)
  if (window.Fuse) {
    fuse = new window.Fuse(faqList, {
      includeScore: true,
      threshold: 0.4, // ambang toleransi kemiripan (~ >70% match)
      keys: [
        { name: "pertanyaan", weight: 0.6 },
        { name: "kata_kunci", weight: 0.4 },
      ],
    });
  }
}

function renderTeaserBanner() {
  const teaser = document.getElementById("teaser-chat");
  if (teaser) teaser.textContent = botSettings.teaser_text;
}

function renderHeaderBot() {
  const namaEl = document.getElementById("nama-bot-header");
  const avatarEl = document.getElementById("avatar-bot-header");
  if (namaEl) namaEl.textContent = botSettings.nama_bot;
  if (avatarEl && botSettings.avatar_url) {
    avatarEl.src = botSettings.avatar_url;
    avatarEl.style.display = "block";
  }
  document.documentElement.style.setProperty("--warna-aksen-bot", botSettings.warna_aksen || "#DC2626");
}

function renderPesanSambutan() {
  tambahBubbleBot(botSettings.pesan_sambutan);
  renderSaranFaq();
}

function renderSaranFaq() {
  const wrap = document.getElementById("saran-faq");
  if (!wrap) return;
  wrap.innerHTML = faqList
    .slice(0, 4)
    .map((f) => `<button type="button" class="pill-saran-faq" data-pertanyaan="${escapeHtml(f.pertanyaan)}">${escapeHtml(f.pertanyaan)}</button>`)
    .join("");
  wrap.querySelectorAll(".pill-saran-faq").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("input-chat").value = btn.dataset.pertanyaan;
      kirimPesanPengguna();
    });
  });
}

function toggleChatWidget() {
  const widget = document.getElementById("widget-chat");
  widget.classList.toggle("widget-chat--terbuka");
}

function tutupChatWidget() {
  document.getElementById("widget-chat").classList.remove("widget-chat--terbuka");
}

function tambahBubbleBot(teks, htmlEkstra = "") {
  const area = document.getElementById("area-percakapan");
  const bubble = document.createElement("div");
  bubble.className = "bubble bubble--bot";
  bubble.innerHTML = `<p>${escapeHtml(teks)}</p>${htmlEkstra}`;
  area.appendChild(bubble);
  area.scrollTop = area.scrollHeight;
}

function tambahBubblePengguna(teks) {
  const area = document.getElementById("area-percakapan");
  const bubble = document.createElement("div");
  bubble.className = "bubble bubble--pengguna";
  bubble.innerHTML = `<p>${escapeHtml(teks)}</p>`;
  area.appendChild(bubble);
  area.scrollTop = area.scrollHeight;
}

function kirimPesanPengguna() {
  const input = document.getElementById("input-chat");
  const teks = input.value.trim();
  if (!teks) return;

  tambahBubblePengguna(teks);
  input.value = "";

  const hasil = fuse ? fuse.search(teks) : [];
  const cocok = hasil.length > 0 && hasil[0].score <= 0.4 ? hasil[0].item : null;

  if (cocok) {
    jumlahGagalBerturut = 0;
    setTimeout(() => tambahBubbleBot(cocok.jawaban), 350);
    return;
  }

  jumlahGagalBerturut += 1;

  if (jumlahGagalBerturut === 1) {
    setTimeout(() => {
      tambahBubbleBot("Maaf, saya belum memahami pertanyaan Anda. Bisa coba tulis ulang, atau pilih salah satu FAQ berikut:");
      renderSaranFaq();
    }, 350);
  } else if (jumlahGagalBerturut === 2) {
    setTimeout(() => {
      tambahBubbleBot("Mohon maaf, saya masih belum menemukan jawaban yang sesuai. Anda bisa menghubungi tim support kami secara langsung.");
    }, 350);
  } else {
    setTimeout(() => {
      const teksEncoded = encodeURIComponent(`Halo, saya punya pertanyaan yang belum terjawab oleh bot: "${teks}"`);
      const nomor = (storeContact.whatsapp || "").replace(/\D/g, "");
      const username = (storeContact.telegram || "").replace("@", "");
      const htmlTombol = `
        <div class="tombol-eskalasi">
          <a class="btn-eskalasi btn-eskalasi--wa" target="_blank" rel="noopener" href="https://wa.me/${nomor}?text=${teksEncoded}">Hubungi via WhatsApp</a>
          <a class="btn-eskalasi btn-eskalasi--tg" target="_blank" rel="noopener" href="https://t.me/${username}?text=${teksEncoded}">Hubungi via Telegram</a>
        </div>`;
      tambahBubbleBot("Pertanyaan Anda akan diteruskan ke Admin kami. Silakan pilih salah satu kanal berikut:", htmlTombol);
      jumlahGagalBerturut = 0; // reset setelah eskalasi ditampilkan
    }, 350);
  }
}
