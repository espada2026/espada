/**
 * Rekap kelulusan SKU Siaga untuk dasbor Admin (Fase 9; murni, tanpa React). Hanya anggota Siaga AKTIF; katalog SKU Siaga
 * harus sudah terdaftar (impor data/skuSiaga) sebelum dipanggil. Padanan rekapAnggota/rekapPerSangga milik Penegak.
 */
import { anggotaSiaga } from './siagaLogic';
import { hitungProgres, tanggalLulusTingkat } from './skuLogic';

export const TINGKAT_REKAP_SIAGA = ['Mula', 'Bantu', 'Tata'];

/** Satu baris per anak aktif: { user, mula, bantu, tata (hitungProgres), tglMula, tglBantu, tglTata }. */
export function rekapSiaga(progress, users) {
  return anggotaSiaga(users).filter((u) => (u.status ?? 'aktif') === 'aktif').map((u) => ({
    user: u,
    mula: hitungProgres(progress, u, 'Mula'),
    bantu: hitungProgres(progress, u, 'Bantu'),
    tata: hitungProgres(progress, u, 'Tata'),
    tglMula: tanggalLulusTingkat(progress, u, 'Mula'),
    tglBantu: tanggalLulusTingkat(progress, u, 'Bantu'),
    tglTata: tanggalLulusTingkat(progress, u, 'Tata'),
  }));
}

/** Jumlah anak yang seluruh butir tingkatnya lulus, dan rata-rata persen tingkat Mula. */
export function ringkasRekapSiaga(rekap) {
  const selesai = (t) => rekap.filter((r) => r[t].persen === 100).length;
  return {
    jumlah: rekap.length,
    mula: selesai('mula'),
    bantu: selesai('bantu'),
    tata: selesai('tata'),
    rataMula: rekap.length ? Math.round(rekap.reduce((n, r) => n + r.mula.persen, 0) / rekap.length) : 0,
  };
}

/** Per barung (perindukan + barung; anak tanpa kelompok di baris "Belum berbarung"), diurutkan nama. */
export function rekapPerBarung(rekap) {
  const peta = new Map();
  for (const r of rekap) {
    const p = r.user.perindukan || '';
    const b = r.user.barung || '';
    const kunci = p && b ? `${p}|${b}` : '';
    const label = p && b ? `${b} (${p})` : 'Belum berbarung';
    const g = peta.get(kunci) ?? { kunci, barung: label, jumlah: 0, mulaLulus: 0, bantuLulus: 0, tataLulus: 0, totalMula: 0 };
    g.jumlah += 1;
    g.mulaLulus += r.mula.persen === 100 ? 1 : 0;
    g.bantuLulus += r.bantu.persen === 100 ? 1 : 0;
    g.tataLulus += r.tata.persen === 100 ? 1 : 0;
    g.totalMula += r.mula.persen;
    peta.set(kunci, g);
  }
  return [...peta.values()]
    .map((g) => ({ ...g, rataMula: Math.round(g.totalMula / g.jumlah) }))
    .sort((a, b) => (a.kunci === '') - (b.kunci === '') || a.barung.localeCompare(b.barung, 'id', { numeric: true }));
}
