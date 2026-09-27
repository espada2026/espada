/**
 * KELOLA BERANDA: konten (murni, tanpa React) — berita, prestasi, galeri, media sosial, dan pertanyaan umum (FAQ).
 *
 * Berita, Prestasi, dan Galeri berbagi alur yang sama: Dewan Ambalan hanya menulis draf atau mengajukan ('menunggu'); Pembina dan
 * Admin Gudep dapat menerbitkan langsung ('terbit') atau meninjau pengajuan (menyetujui atau menolak dengan catatan). Media sosial
 * tanpa alur (langsung tampil); FAQ hanya Pembina dan Admin Gudep. Aturan di sini HARUS sama dengan 586-aksi-beranda-konten.sql
 * (dibandingkan langsung oleh uji/beranda-konten-klien.mjs).
 */
import { rapikan, rapikanParagraf, tautanSah } from './berandaLogic';
import { hariIni as hariIniWib } from './format';

export const KATEGORI_BERITA = ['kegiatan', 'pengumuman', 'lainnya'];
export const LABEL_KATEGORI_BERITA = { kegiatan: 'Kegiatan', pengumuman: 'Pengumuman', lainnya: 'Lainnya' };

export const TINGKAT_PRESTASI = ['gudep', 'ranting', 'cabang', 'provinsi', 'nasional'];
export const LABEL_TINGKAT_PRESTASI = { gudep: 'Gudep', ranting: 'Ranting', cabang: 'Cabang', provinsi: 'Provinsi', nasional: 'Nasional' };

export const KELOMPOK_GALERI = ['latihan', 'perkemahan', 'pelantikan', 'lainnya'];
export const LABEL_KELOMPOK_GALERI = { latihan: 'Latihan Jumat', perkemahan: 'Perkemahan', pelantikan: 'Pelantikan', lainnya: 'Lainnya' };

export const PLATFORM_SOSIAL = ['instagram', 'youtube', 'facebook', 'tiktok'];
export const LABEL_PLATFORM = { instagram: 'Instagram', youtube: 'YouTube', facebook: 'Facebook', tiktok: 'TikTok' };

export const LABEL_STATUS = { draf: 'Draf', menunggu: 'Menunggu Pembina', terbit: 'Terbit', ditolak: 'Ditolak' };

/** Panjang dalam karakter sesungguhnya (sama dengan char_length SQL); `.length` bawaan JS menghitung emoji dua kali. */
const panjang = (s) => [...String(s ?? '')].length;
const antara = (s, min, maks) => { const n = panjang(String(s ?? '').trim()); return n >= min && n <= maks; };

/** Tahun berjalan (WIB), dari 'YYYY-MM-DD'; dipakai membatasi tahun prestasi supaya tidak mengetik tahun yang akan datang. */
export const tahunDari = (hariIni) => Number(String(hariIni).slice(0, 4));

/** Status yang boleh disimpan langsung lewat sg_*_simpan (bukan lewat tinjauan): 'terbit' hanya untuk Pembina/Admin Gudep. */
export const statusTersedia = (bolehTerbit) => (bolehTerbit ? ['draf', 'menunggu', 'terbit'] : ['draf', 'menunggu']);

/** Boleh mengubah atau menghapus baris ini? Sama dengan sigarda.beranda_konten_boleh_ubah. */
export const bolehUbah = (bolehTerbit, dibuatOleh, status, akunId) =>
  bolehTerbit || (dibuatOleh === akunId && ['draf', 'menunggu', 'ditolak'].includes(status));

// ------------------------------- Berita -------------------------------
export const untukFormBerita = (b) => ({
  kategori: KATEGORI_BERITA.includes(b?.kategori) ? b.kategori : 'kegiatan',
  judul: typeof b?.judul === 'string' ? b.judul : '',
  ringkasan: typeof b?.ringkasan === 'string' ? b.ringkasan : '',
  isi: typeof b?.isi === 'string' ? b.isi : '',
  sampulUrl: typeof b?.sampulUrl === 'string' ? b.sampulUrl : '',
});

/**
 * { kolom: pesan } (kosong = sah); `status` ('draf'|'menunggu'|'terbit') dan `bolehTerbit` menentukan apakah status itu boleh dipakai.
 * Kategori diperiksa dari NILAI ASLI `b.kategori` (bukan lewat untukFormBerita, yang melunakkan nilai tak dikenal ke bawaan untuk formulir) supaya
 * nilai yang tidak dikenal tetap ditolak di sini, sama seperti server.
 */
export function periksaBerita(b, status, bolehTerbit) {
  const f = untukFormBerita(b);
  const judul = rapikan(f.judul), ringkasan = rapikan(f.ringkasan), isi = rapikanParagraf(f.isi), sampul = rapikan(f.sampulUrl);
  const galat = {};
  if (!KATEGORI_BERITA.includes(b?.kategori)) galat.kategori = 'Kategori tidak dikenal.';
  if (!antara(judul, 1, 150)) galat.judul = 'Wajib diisi, maksimal 150 karakter.';
  if (panjang(ringkasan) > 200) galat.ringkasan = 'Maksimal 200 karakter.';
  if (!antara(isi, 1, 4000)) galat.isi = 'Wajib diisi, maksimal 4000 karakter.';
  if (sampul && !tautanSah(sampul)) galat.sampulUrl = 'Harus diawali https:// dan berupa alamat yang sah.';
  if (!statusTersedia(bolehTerbit).includes(status)) galat.status = bolehTerbit ? 'Status tidak sah.' : 'Hanya Pembina dan Admin Gudep yang dapat menerbitkan.';
  return galat;
}

// ------------------------------- Prestasi -------------------------------
export const untukFormPrestasi = (p) => ({
  judul: typeof p?.judul === 'string' ? p.judul : '',
  tingkat: TINGKAT_PRESTASI.includes(p?.tingkat) ? p.tingkat : 'ranting',
  peringkat: typeof p?.peringkat === 'string' ? p.peringkat : '',
  tahun: typeof p?.tahun === 'number' ? p.tahun : Number(p?.tahun) || '',
  diraihOleh: typeof p?.diraihOleh === 'string' ? p.diraihOleh : '',
  fotoUrl: typeof p?.fotoUrl === 'string' ? p.fotoUrl : '',
});

export function periksaPrestasi(p, status, bolehTerbit, hariIni = hariIniWib()) {
  const f = untukFormPrestasi(p);
  const judul = rapikan(f.judul), peringkat = rapikan(f.peringkat), diraih = rapikan(f.diraihOleh), foto = rapikan(f.fotoUrl);
  const galat = {};
  if (!TINGKAT_PRESTASI.includes(p?.tingkat)) galat.tingkat = 'Tingkat tidak dikenal.';
  if (!antara(judul, 1, 150)) galat.judul = 'Wajib diisi, maksimal 150 karakter.';
  if (!antara(peringkat, 1, 60)) galat.peringkat = 'Wajib diisi, maksimal 60 karakter.';
  const tahun = Number(f.tahun);
  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > tahunDari(hariIni)) galat.tahun = 'Tahun tidak sah.';
  if (!antara(diraih, 1, 150)) galat.diraihOleh = 'Wajib diisi, maksimal 150 karakter.';
  if (foto && !tautanSah(foto)) galat.fotoUrl = 'Harus diawali https:// dan berupa alamat yang sah.';
  if (!statusTersedia(bolehTerbit).includes(status)) galat.status = bolehTerbit ? 'Status tidak sah.' : 'Hanya Pembina dan Admin Gudep yang dapat menerbitkan.';
  return galat;
}

// ------------------------------- Galeri -------------------------------
export const untukFormGaleri = (g) => ({
  judul: typeof g?.judul === 'string' ? g.judul : '',
  tautan: typeof g?.tautan === 'string' ? g.tautan : '',
  sampulUrl: typeof g?.sampulUrl === 'string' ? g.sampulUrl : '',
  kelompok: KELOMPOK_GALERI.includes(g?.kelompok) ? g.kelompok : 'lainnya',
});

export function periksaGaleri(g, status, bolehTerbit) {
  const f = untukFormGaleri(g);
  const judul = rapikan(f.judul), tautan = rapikan(f.tautan), sampul = rapikan(f.sampulUrl);
  const galat = {};
  if (!antara(judul, 1, 100)) galat.judul = 'Wajib diisi, maksimal 100 karakter.';
  if (!tautanSah(tautan)) galat.tautan = 'Harus diawali https:// dan berupa alamat yang sah.';
  if (sampul && !tautanSah(sampul)) galat.sampulUrl = 'Harus diawali https:// dan berupa alamat yang sah.';
  if (!KELOMPOK_GALERI.includes(g?.kelompok)) galat.kelompok = 'Kelompok tidak dikenal.';
  if (!statusTersedia(bolehTerbit).includes(status)) galat.status = bolehTerbit ? 'Status tidak sah.' : 'Hanya Pembina dan Admin Gudep yang dapat menampilkan di beranda.';
  return galat;
}

// ------------------------------- Media sosial -------------------------------
export const untukFormSosial = (s) => ({
  platform: PLATFORM_SOSIAL.includes(s?.platform) ? s.platform : 'instagram',
  tautan: typeof s?.tautan === 'string' ? s.tautan : '',
  keterangan: typeof s?.keterangan === 'string' ? s.keterangan : '',
  gambarUrl: typeof s?.gambarUrl === 'string' ? s.gambarUrl : '',
  tampil: s?.tampil !== false,
});

export function periksaSosial(s) {
  const f = untukFormSosial(s);
  const tautan = rapikan(f.tautan), ket = rapikan(f.keterangan), gambar = rapikan(f.gambarUrl);
  const galat = {};
  if (!PLATFORM_SOSIAL.includes(s?.platform)) galat.platform = 'Platform tidak dikenal.';
  if (!tautanSah(tautan)) galat.tautan = 'Harus diawali https:// dan berupa alamat yang sah.';
  if (panjang(ket) > 200) galat.keterangan = 'Maksimal 200 karakter.';
  if (gambar && !tautanSah(gambar)) galat.gambarUrl = 'Harus diawali https:// dan berupa alamat yang sah.';
  return galat;
}

// ------------------------------- FAQ -------------------------------
export const untukFormFaq = (f) => ({ pertanyaan: typeof f?.pertanyaan === 'string' ? f.pertanyaan : '', jawaban: typeof f?.jawaban === 'string' ? f.jawaban : '' });

export function periksaFaq(f) {
  const v = untukFormFaq(f);
  const pertanyaan = rapikan(v.pertanyaan), jawaban = rapikan(v.jawaban);
  const galat = {};
  if (!antara(pertanyaan, 1, 200)) galat.pertanyaan = 'Wajib diisi, maksimal 200 karakter.';
  if (!antara(jawaban, 1, 1000)) galat.jawaban = 'Wajib diisi, maksimal 1000 karakter.';
  return galat;
}
