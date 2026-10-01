/**
 * TABUNGAN ANAK SIAGA (murni, tanpa React; Pramuka Siaga, Fase 3)
 *
 * SK Kwarnas 119/2011, butir 4 tiap tingkat: anak punya buku tabungan dan menabung teratur (Mula 6 minggu, Bantu 8 minggu, Tata 12 minggu), sedapat-dapatnya
 * dari uang usahanya sendiri. Uang tetap di buku anak: aplikasi hanya mencatat bahwa pada sebuah tanggal Pembina memeriksa buku dan melihat setoran minggu itu
 * (tabel tabungan_cek). "Minggu menabung" = jumlah minggu (Senin-Minggu) yang punya sedikitnya satu pemeriksaan.
 *
 * `periksaTabungan` mencerminkan sigarda sg_tabungan_catat dan DIBANDINGKAN LANGSUNG dengan SQL oleh uji/tabungan-klien.mjs (pesan sama dengan server).
 * Ringkasan minggu hanya tampilan (Pembina yang menilai butirnya).
 */
import { geserHari, tanggalValid } from './absensiLogic';
import { hariIni, keIso } from './format';

export const TARGET_MINGGU = { Mula: 6, Bantu: 8, Tata: 12 };
export const JUMLAH_MAKS = 100000000;
export const CATATAN_MAKS = 200;
export const TANGGAL_MIN = '2015-01-01';

/**
 * Memeriksa satu catatan pemeriksaan tabungan. `d` = { tanggal, jumlah, catatan? }; `hari` = hari ini (WIB).
 * Mengembalikan { ok: true, nilai: { tanggal, jumlah, catatan } } atau { ok: false, pesan }.
 */
export function periksaTabungan(d, hari = hariIni()) {
  if (d === null || typeof d !== 'object' || Array.isArray(d)) return { ok: false, pesan: 'Data tabungan tidak valid.' };
  const tanggal = String(d.tanggal ?? '').trim();
  if (!tanggalValid(tanggal)) return { ok: false, pesan: 'Tanggal pemeriksaan wajib diisi.' };
  if (tanggal < TANGGAL_MIN || tanggal > hari) return { ok: false, pesan: 'Tanggal pemeriksaan harus antara 1 Januari 2015 dan hari ini.' };
  const jumlah = typeof d.jumlah === 'string' && d.jumlah.trim() !== '' ? Number(d.jumlah) : d.jumlah;
  if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > JUMLAH_MAKS) return { ok: false, pesan: 'Setoran harus antara Rp 1 dan Rp 100.000.000.' };
  const catatan = String(d.catatan ?? '').trim();
  if (catatan.length > CATATAN_MAKS) return { ok: false, pesan: 'Catatan maksimal 200 karakter.' };
  return { ok: true, nilai: { tanggal, jumlah, catatan } };
}

/** Senin pada minggu yang memuat tanggal ini (kunci minggu). */
export function mingguSenin(iso) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return keIso(d);
}

/**
 * Ringkasan menabung dari baris [{ tanggal, jumlah }]. `sejak` (tanggal ISO atau null) membatasi pada pemeriksaan sejak tanggal itu
 * (mis. sejak anak menyelesaikan tingkat sebelumnya). Hasil: { minggu, beruntun, terakhir, terputus, total, pemeriksaan }.
 *   minggu    jumlah minggu berbeda yang punya pemeriksaan
 *   beruntun  minggu berturut-turut yang berakhir pada minggu pemeriksaan terbaru
 *   terputus  true bila pemeriksaan terbaru lebih lama dari minggu lalu (anak belum menabung pekan ini maupun pekan lalu)
 */
export function ringkasTabungan(baris, { sejak = null, hari = hariIni() } = {}) {
  const dipakai = (baris ?? []).filter((b) => (!sejak || b.tanggal >= sejak) && b.tanggal <= hari);
  const pekan = [...new Set(dipakai.map((b) => mingguSenin(b.tanggal)))].sort();
  let beruntun = 0;
  for (let i = pekan.length - 1; i >= 0; i -= 1) {
    if (i === pekan.length - 1 || pekan[i] === geserHari(pekan[i + 1], -7)) beruntun += 1;
    else break;
  }
  const terakhirMinggu = pekan[pekan.length - 1] ?? null;
  return {
    minggu: pekan.length,
    beruntun,
    terakhir: dipakai.length ? dipakai.map((b) => b.tanggal).sort().pop() : null,
    terputus: terakhirMinggu !== null && terakhirMinggu < geserHari(mingguSenin(hari), -7),
    total: dipakai.reduce((n, b) => n + b.jumlah, 0),
    pemeriksaan: dipakai.length,
  };
}
