/**
 * TKK ANAK SIAGA (murni, tanpa React; Pramuka Siaga, Fase 5)
 *
 * SK Kwarnas 134/1976 dan 132/1979: TKK Siaga SATU tingkat saja (tanpa Purwa/Madya/Utama), dikenakan sesudah Siaga Bantu, diuji Pembina. Katalognya 84 SKK SK 132/1979
 * (`tkkUntukSiaga`). `periksaTkkSiaga` mencerminkan sg_tkk_siaga_catat pada isian dan DIBANDINGKAN LANGSUNG dengan SQL oleh uji/tkk-siaga-klien.mjs (pesan sama dengan server).
 * Ringkasan per bidang hanya tampilan; ambang Siaga Garuda ("minimal 4 macam dari tiap bidang" pada Jukran 038/2017) ambigu dan baru dipakai di Fase 6.
 */
import { hariIni } from './format';
import { tanggalValid } from './absensiLogic';
import { BIDANG_TKK, INDEKS_TKK, tkkUntukSiaga } from '../data/tkkData';

export { BIDANG_TKK, tkkUntukSiaga };
export const TANGGAL_MIN = '2015-01-01';

const rapikan = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const TERLARANG = /[\u0000-\u001f\u007f<>]/;
const urlSah = (u) => !u || (/^https?:\/\//i.test(u) && u.length <= 500 && !/[\u0000-\u001f\u007f\s<>]/.test(u));

/**
 * Memeriksa isian satu catatan TKK anak Siaga (sebelum memeriksa anak dan Bantu yang bergantung data, yang diperiksa server). `agama` = agama anak.
 * Mengembalikan { ok: true, nilai } atau { ok: false, pesan }.
 */
export function periksaTkkSiaga({ tkkId, tanggal, penguji, buktiUrl = '', catatan = '', agama = null }, hari = hariIni()) {
  const t = INDEKS_TKK[tkkId];
  if (!t) return { ok: false, pesan: 'TKK tidak dikenal.' };
  if (!tkkUntukSiaga(agama).some((x) => x.id === tkkId)) {
    return { ok: false, pesan: t.sumber !== 'skk-132-1979' ? `TKK ${t.nama} belum dipakai untuk golongan Siaga.` : `TKK ${t.nama} khusus penganut agama ${t.agama}.` };
  }
  const tgl = String(tanggal ?? '').trim();
  if (!tanggalValid(tgl)) return { ok: false, pesan: 'Tanggal lulus wajib diisi.' };
  if (tgl < TANGGAL_MIN || tgl > hari) return { ok: false, pesan: 'Tanggal lulus harus antara 1 Januari 2015 dan hari ini.' };
  const p = rapikan(penguji);
  if (p.length < 1 || p.length > 80 || TERLARANG.test(p)) return { ok: false, pesan: 'Isi nama penguji (maksimal 80 karakter, tanpa tanda < atau >).' };
  const url = String(buktiUrl ?? '').trim();
  if (!urlSah(url)) return { ok: false, pesan: 'Tautan bukti harus berawalan http:// atau https:// (maksimal 500 karakter, tanpa spasi).' };
  const c = rapikan(catatan);
  if (c.length > 200 || TERLARANG.test(c)) return { ok: false, pesan: 'Catatan maksimal 200 karakter, tanpa tanda < atau >.' };
  return { ok: true, nilai: { tkkId, tanggal: tgl, penguji: p, buktiUrl: url, catatan: c } };
}

/** Ringkasan satu anak dari baris [{ tkkId }]: { total, perBidang: { 1..5 } }; baris dengan TKK yang tak dikenal diabaikan. */
export function ringkasTkkSiaga(baris = []) {
  const perBidang = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const b of baris) { const bid = INDEKS_TKK[b.tkkId]?.bidang; if (bid) { perBidang[bid] += 1; total += 1; } }
  return { total, perBidang };
}

/** Pilihan TKK untuk anak beragama `agama`, per bidang, tanpa yang sudah dimiliki: [{ bidang, singkat, daftar }] (bidang tanpa pilihan tidak ikut). */
export function pilihanTkkSiaga(agama, sudah = []) {
  const punya = new Set(sudah.map((b) => b.tkkId));
  const boleh = tkkUntukSiaga(agama).filter((t) => !punya.has(t.id));
  return Object.entries(BIDANG_TKK)
    .map(([no, b]) => ({ bidang: Number(no), singkat: b.singkat, daftar: boleh.filter((t) => t.bidang === Number(no)) }))
    .filter((g) => g.daftar.length > 0);
}
