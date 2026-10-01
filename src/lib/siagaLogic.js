/**
 * ANGGOTA SIAGA TANPA AKUN (murni, tanpa React)
 *
 * Anak Siaga tidak punya akun: profilnya (`tanpaAkun`) dibuat dan dirawat Pembina/Admin. Kelas berupa angka 1-6 dengan paralel opsional (1, 4A, 5B).
 * Kelompok: perindukan (3-4 barung, 18-24 anak) dan barung (6-8 anak) sesuai SK Kwarnas 119/2011.
 * `periksaSiaga` mencerminkan sigarda.siaga_periksa (server) dan DIBANDINGKAN LANGSUNG dengan SQL oleh uji/siaga-klien.mjs.
 * Ringkasan kelompok dan peringatan ukuran hanya tampilan (server tidak memblokir ukuran kelompok).
 */
import { AGAMA } from '../data/skuData';
import { urutTeks } from './format';

export const POLA_KELAS_SIAGA = /^[1-6][A-Z]?$/;
export const PESAN_KELAS_SIAGA = 'Kelas harus angka 1 sampai 6, boleh diikuti satu huruf paralel (contoh: 4, 5A).';
export const BARUNG_MIN = 6;
export const BARUNG_MAKS = 8;
export const PERINDUKAN_BARUNG_MIN = 3;
export const PERINDUKAN_BARUNG_MAKS = 4;
const NIS_POLA = /^[0-9A-Za-z./-]{3,20}$/;
const rapi = (t) => String(t ?? '').trim().replace(/\s+/g, ' ');

/** "4 a" -> "4A"; bentuk lain dikembalikan apa adanya tanpa spasi (diperiksa POLA_KELAS_SIAGA). */
export const bakukanKelasSiaga = (t) => String(t ?? '').replace(/\s+/g, '').toUpperCase();
export const kelasSiagaSah = (t) => POLA_KELAS_SIAGA.test(String(t ?? ''));

/**
 * Memeriksa satu anggota Siaga. `d` = { nama, kelas, jk?, agama?, nis?, perindukan?, barung? }.
 * `ada` = { nis: (nis) => bool (dipakai anggota lain), perindukan: (teks) => penulisan yang sudah ada | undefined, barung: (teks, perindukan) => idem } untuk menyamakan penulisan;
 * tanpa `ada`, hanya pemeriksaan bentuk. Mengembalikan { ok: true, nilai } atau { ok: false, pesan } (pesan sama dengan server).
 */
export function periksaSiaga(d, ada = {}) {
  if (d === null || typeof d !== 'object' || Array.isArray(d)) return { ok: false, pesan: 'Data anggota tidak valid.' };
  const nama = rapi(d.nama);
  if (nama === '') return { ok: false, pesan: 'Nama wajib diisi.' };
  if (nama.length > 120) return { ok: false, pesan: 'Nama maksimal 120 karakter.' };
  const kelas = bakukanKelasSiaga(d.kelas);
  if (!POLA_KELAS_SIAGA.test(kelas)) return { ok: false, pesan: PESAN_KELAS_SIAGA };
  const jk = String(d.jk ?? '').trim().toUpperCase();
  if (!['', 'L', 'P'].includes(jk)) return { ok: false, pesan: 'Jenis kelamin harus L atau P.' };
  const agama = String(d.agama ?? '').trim();
  if (agama !== '' && !AGAMA.includes(agama)) return { ok: false, pesan: 'Agama tidak dikenal.' };
  const nis = String(d.nis ?? '').trim();
  if (nis !== '' && !NIS_POLA.test(nis)) return { ok: false, pesan: 'NIS hanya boleh berisi huruf, angka, titik, garis miring, atau tanda hubung (3 sampai 20 karakter).' };
  if (nis !== '' && ada.nis?.(nis)) return { ok: false, pesan: `NIS ${nis} sudah dipakai anggota lain.` };
  let perindukan = rapi(d.perindukan);
  let barung = rapi(d.barung);
  if (perindukan.length > 40 || barung.length > 40) return { ok: false, pesan: 'Nama perindukan dan barung maksimal 40 karakter.' };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f-\u009f<>]/.test(perindukan) || /[\u0000-\u001f\u007f-\u009f<>]/.test(barung)) return { ok: false, pesan: 'Nama perindukan dan barung tidak boleh memuat karakter < atau >.' };
  if (barung !== '' && perindukan === '') return { ok: false, pesan: 'Barung harus berada di sebuah perindukan: isi perindukannya.' };
  if (perindukan !== '') perindukan = ada.perindukan?.(perindukan) ?? perindukan;
  if (barung !== '') barung = ada.barung?.(barung, perindukan) ?? barung;
  return { ok: true, nilai: { nama, kelas, jk: jk || null, agama: agama || null, nis: nis || null, perindukan: perindukan || null, barung: barung || null } };
}

/** Anggota Siaga dari daftar pengguna: anak tanpa akun, atau anak berkelas SD yang punya akun masuk (dibuat Pembina/Admin seperti akun Penegak). */
export const anggotaSiaga = (users) => (users ?? []).filter((u) => u.role === 'peserta' && (u.tanpaAkun || kelasSiagaSah(u.kelas)));

/** Penulisan perindukan/barung yang sudah dipakai (tanpa membedakan huruf besar/kecil), untuk menyamakan isian baru. */
export function penyamaKelompok(users) {
  const per = new Map();
  const bar = new Map();
  for (const u of anggotaSiaga(users)) {
    if (u.perindukan && !per.has(u.perindukan.toLowerCase())) per.set(u.perindukan.toLowerCase(), u.perindukan);
    if (u.perindukan && u.barung) {
      const k = `${u.perindukan.toLowerCase()}|${u.barung.toLowerCase()}`;
      if (!bar.has(k)) bar.set(k, u.barung);
    }
  }
  return {
    nis: (nis) => (users ?? []).some((u) => u.nis === nis),
    perindukan: (t) => per.get(t.toLowerCase()),
    barung: (t, p) => bar.get(`${String(p).toLowerCase()}|${t.toLowerCase()}`),
  };
}

/**
 * Susunan kelompok anggota AKTIF: [{ perindukan, jumlah, putra, putri, barung: [{ nama, anggota[], peringatan }], peringatan }] ditambah `tanpaKelompok` (belum ditempatkan).
 * Peringatan = ukuran di luar anjuran 6-8 anak per barung dan 3-4 barung per perindukan (hanya anjuran).
 */
export function susunKelompok(users) {
  const aktif = anggotaSiaga(users).filter((u) => (u.status ?? 'aktif') === 'aktif');
  const urut = (a, b) => urutTeks(a.nama, b.nama);
  const peta = new Map();
  const tanpaKelompok = [];
  for (const u of aktif) {
    if (!u.perindukan) { tanpaKelompok.push(u); continue; }
    if (!peta.has(u.perindukan)) peta.set(u.perindukan, new Map());
    const b = u.barung || '';
    if (!peta.get(u.perindukan).has(b)) peta.get(u.perindukan).set(b, []);
    peta.get(u.perindukan).get(b).push(u);
  }
  const perindukan = [...peta.entries()].sort((a, b) => urutTeks(a[0], b[0])).map(([nama, mapBarung]) => {
    const barung = [...mapBarung.entries()].sort((a, b) => urutTeks(a[0], b[0])).map(([bn, anggota]) => {
      anggota.sort(urut);
      const peringatan = bn === '' ? 'Belum masuk barung.'
        : anggota.length < BARUNG_MIN ? `Barung ${bn} baru ${anggota.length} anak (anjuran ${BARUNG_MIN}-${BARUNG_MAKS}).`
        : anggota.length > BARUNG_MAKS ? `Barung ${bn} ${anggota.length} anak (anjuran ${BARUNG_MIN}-${BARUNG_MAKS}).` : '';
      return { nama: bn, anggota, peringatan };
    });
    const bernama = barung.filter((b) => b.nama !== '').length;
    const jumlah = barung.reduce((n, b) => n + b.anggota.length, 0);
    const semua = barung.flatMap((b) => b.anggota);
    const peringatan = bernama < PERINDUKAN_BARUNG_MIN ? `Baru ${bernama} barung (anjuran ${PERINDUKAN_BARUNG_MIN}-${PERINDUKAN_BARUNG_MAKS}).`
      : bernama > PERINDUKAN_BARUNG_MAKS ? `${bernama} barung (anjuran ${PERINDUKAN_BARUNG_MIN}-${PERINDUKAN_BARUNG_MAKS}).` : '';
    return { perindukan: nama, jumlah, putra: semua.filter((u) => u.jenisKelamin === 'L').length, putri: semua.filter((u) => u.jenisKelamin === 'P').length, barung, peringatan };
  });
  return { perindukan, tanpaKelompok: tanpaKelompok.sort(urut) };
}

/**
 * Membaca tempelan teks (satu anak per baris; kolom dipisah tab atau titik koma atau koma): Nama, Kelas, JK, Agama, NIS, Perindukan, Barung.
 * Baris kosong dilewati; kolom yang tak ada dikosongkan. Mengembalikan larik { nama, kelas, jk, agama, nis, perindukan, barung } (belum diperiksa).
 */
export function bacaTempelanSiaga(teks) {
  return String(teks ?? '').split(/\r?\n/).map((b) => b.trim()).filter(Boolean).map((b) => {
    const k = b.split(/\t|;|,/).map((x) => x.trim());
    return { nama: k[0] ?? '', kelas: k[1] ?? '', jk: k[2] ?? '', agama: k[3] ?? '', nis: k[4] ?? '', perindukan: k[5] ?? '', barung: k[6] ?? '' };
  });
}

/** Memeriksa banyak baris sekaligus; mengembalikan { baris: [{ no, nilai?, pesan? }], galat: jumlah }. NIS kembar di dalam daftar ikut ditolak. */
export function periksaBanyakSiaga(daftar, users) {
  const ada = penyamaKelompok(users);
  const nisDalam = new Set();
  const per = new Map();
  const bar = new Map();
  const adaBaris = {
    nis: (n) => ada.nis(n) || nisDalam.has(n),
    perindukan: (t) => ada.perindukan(t) ?? per.get(t.toLowerCase()),
    barung: (t, p) => ada.barung(t, p) ?? bar.get(`${String(p).toLowerCase()}|${t.toLowerCase()}`),
  };
  let galat = 0;
  const baris = daftar.map((d, i) => {
    const r = periksaSiaga(d, adaBaris);
    if (!r.ok) { galat += 1; return { no: i + 1, pesan: r.pesan }; }
    const n = r.nilai;
    if (n.nis) nisDalam.add(n.nis);
    if (n.perindukan && !per.has(n.perindukan.toLowerCase())) per.set(n.perindukan.toLowerCase(), n.perindukan);
    if (n.barung) { const k = `${n.perindukan.toLowerCase()}|${n.barung.toLowerCase()}`; if (!bar.has(k)) bar.set(k, n.barung); }
    return { no: i + 1, nilai: n };
  });
  return { baris, galat };
}
