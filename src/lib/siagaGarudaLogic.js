/**
 * SYARAT SIAGA GARUDA (murni, tanpa React; Pramuka Siaga, Fase 6)
 *
 * Server hanya menyimpan PENETAPAN Pembina (sg_siaga_garuda_catat/_hapus). Saran otomatis butir 1 (SKU Tata + 2 bulan sejak pelantikan Tata), butir 2 (TKK per bidang), butir 4 dan 5 (ikut kegiatan Agenda berjenis pertemuan_siaga/persari) dihitung
 * di sini dari data yang sudah ada, tanpa padanan SQL. Yang dicerminkan dan DIBANDINGKAN LANGSUNG dengan SQL pada kisi masukan (uji/siaga-garuda.mjs) hanyalah `periksaSiagaGaruda`.
 * Penetapan Pembina (bila ada) menang; tanpa penetapan, butir otomatis mengikuti saran dan butir manual berstatus 'belum'. Tanggal memakai WIB (`hariIni`).
 */
import { hariIni, fmtTanggal } from './format';
import { tanggalValid } from './absensiLogic';
import { tambahBulan } from './spgLogic';
import { tingkatSelesai } from './skuLogic';
import { pelantikanPeserta } from './pelantikanLogic';
import { ringkasTkkSiaga } from './tkkSiagaLogic';
import { kegiatanDiikuti } from './agendaLogic';
import { BIDANG_TKK } from '../data/tkkData';
import { BUTIR_SIAGA_GARUDA, BULAN_LATIH_TATA, TKK_PER_BIDANG } from '../data/siagaGarudaData';

export const TANGGAL_MIN = '2015-01-01';
const rapikan = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const TERLARANG = /[\u0000-\u001f\u007f<>]/;

export const STATUS_SIAGA_GARUDA = {
  terpenuhi: { label: 'Terpenuhi', kelas: 'bg-emerald-50 text-emerald-800 ring-emerald-300' },
  belum: { label: 'Belum', kelas: 'bg-stone-100 text-stone-700 ring-stone-300' },
};

/** Penetapan anak ini: { [butir]: baris }. */
export const penetapanAnak = (penetapan = [], pesertaId) => Object.fromEntries(penetapan.filter((p) => p.pesertaId === pesertaId).map((p) => [p.butir, p]));

/** Memeriksa isian satu penetapan (sebelum memeriksa anak dan SKU Tata, yang bergantung data dan diperiksa server). Pesan sama dengan server. */
export function periksaSiagaGaruda({ butir, nilai, tanggal, catatan = '' }, hari = hariIni()) {
  if (!Number.isInteger(butir) || butir < 1 || butir > BUTIR_SIAGA_GARUDA.length) return { ok: false, pesan: 'Butir Siaga Garuda harus 1 sampai 6.' };
  if (nilai !== 0 && nilai !== 100) return { ok: false, pesan: 'Nilai harus 100 (memenuhi) atau 0 (belum).' };
  const tgl = String(tanggal ?? '').trim();
  if (!tanggalValid(tgl)) return { ok: false, pesan: 'Tanggal pengujian wajib diisi.' };
  if (tgl < TANGGAL_MIN || tgl > hari) return { ok: false, pesan: 'Tanggal pengujian harus antara 1 Januari 2015 dan hari ini.' };
  const c = rapikan(catatan);
  if (c.length > 200 || TERLARANG.test(c)) return { ok: false, pesan: 'Catatan maksimal 200 karakter, tanpa tanda < atau >.' };
  return { ok: true, nilai: { butir, nilai, tanggal: tgl, catatan: c } };
}

function saran(butir, { peserta, progress, pelantikan, tkk, agenda, hari }) {
  if (butir.aturan === 'agenda') {
    const ikut = kegiatanDiikuti(agenda, peserta.id, butir.jenisAgenda, hari);
    return ikut.length
      ? { terpenuhi: true, teks: `Tercatat ikut: ${ikut[0].judul}, ${fmtTanggal(ikut[0].tanggal)}${ikut.length > 1 ? ` (dan ${ikut.length - 1} kegiatan lain)` : ''}.` }
      : { terpenuhi: false, teks: 'Belum ada kegiatan ini di Agenda yang menandai anak ini ikut (menu Agenda, kolom anak yang ikut).' };
  }
  if (butir.aturan === 'sku-tata') {
    if (!tingkatSelesai(progress, peserta, 'Tata')) return { terpenuhi: false, teks: 'SKU Tata belum selesai.' };
    const pl = pelantikanPeserta(pelantikan, peserta.id).tata;
    if (!pl) return { terpenuhi: false, teks: 'SKU Tata selesai; pelantikan Tata belum dicatat (menu Pelantikan).' };
    const genap = tambahBulan(pl.tanggal, BULAN_LATIH_TATA);
    return hari >= genap
      ? { terpenuhi: true, teks: `Dilantik Tata ${fmtTanggal(pl.tanggal)}; sudah berlatih ${BULAN_LATIH_TATA} bulan sejak ${fmtTanggal(genap)}.` }
      : { terpenuhi: false, teks: `Dilantik Tata ${fmtTanggal(pl.tanggal)}; genap ${BULAN_LATIH_TATA} bulan pada ${fmtTanggal(genap)}.` };
  }
  if (butir.aturan === 'tkk') {
    const r = ringkasTkkSiaga(tkk);
    const kurang = Object.entries(BIDANG_TKK).filter(([no]) => r.perBidang[no] < TKK_PER_BIDANG).map(([no, b]) => `${b.singkat} ${r.perBidang[no]}/${TKK_PER_BIDANG}`);
    return kurang.length
      ? { terpenuhi: false, teks: `${r.total} TKK tercatat; belum ${TKK_PER_BIDANG} di bidang: ${kurang.join(', ')}.` }
      : { terpenuhi: true, teks: `${r.total} TKK tercatat; tiap bidang sudah ${TKK_PER_BIDANG} atau lebih.` };
  }
  return { terpenuhi: false, teks: '' };
}

/**
 * Keadaan 6 butir satu anak: [{ no, judul, uraian, jenis, saran: { terpenuhi, teks }, penetapan, status ('terpenuhi'|'belum'), nilai (100|0), sumber ('pembina'|'otomatis'|null) }].
 * `data` = { peserta, progress, pelantikan, tkk (baris TKK anak ini), agenda (semua kegiatan Agenda), penetapan (semua), hari }.
 */
export function hitungSiagaGaruda(data) {
  const { peserta, penetapan = [], hari = hariIni() } = data;
  const ada = penetapanAnak(penetapan, peserta.id);
  return BUTIR_SIAGA_GARUDA.map((b) => {
    const s = b.jenis === 'otomatis' ? saran(b, { ...data, hari }) : { terpenuhi: false, teks: '' };
    const p = ada[b.no] ?? null;
    let status = 'belum', sumber = null;
    if (p) { status = p.nilai === 100 ? 'terpenuhi' : 'belum'; sumber = 'pembina'; }
    else if (b.jenis === 'otomatis' && s.terpenuhi) { status = 'terpenuhi'; sumber = 'otomatis'; }
    return { ...b, saran: s, penetapan: p, status, nilai: status === 'terpenuhi' ? 100 : 0, sumber };
  });
}

/** { terpenuhi, total, siap }: siap = seluruh butir terpenuhi. */
export function ringkasSiagaGaruda(butir = []) {
  const terpenuhi = butir.filter((b) => b.status === 'terpenuhi').length;
  return { terpenuhi, total: butir.length, siap: butir.length > 0 && terpenuhi === butir.length };
}
