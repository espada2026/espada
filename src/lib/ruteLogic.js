/**
 * RUTE AWAL (murni, tanpa React): apa yang tampil saat alamat dibuka, dan bagaimana alamat berubah sesudahnya.
 *
 * Tanpa pustaka rute (situs statis di GitHub Pages): alamat dasar `/` menampilkan halaman muka (landing) bagi pengunjung yang belum masuk,
 * dan aplikasi bagi yang punya sesi tersimpan di peramban ini.
 *   ?v=KODE atau ?berkas=TOKEN : halaman publik verifikasi dan tautan berbagi (selalu, apa pun sesinya)
 *   #masuk                     : aplikasi (halaman masuk bila belum ada sesi)
 *   #beranda                   : halaman muka (juga bagi yang sudah masuk, mis. "Lihat beranda publik")
 *   sesi tersimpan             : aplikasi
 *   ?masuk= ?data= ?ulang= ?buka= : aplikasi (mode uji lokal dan klik notifikasi)
 *   mode lokal                 : aplikasi, kecuali #beranda (alur `npm run dev:lokal` tidak berubah)
 * Pilihan ini juga ditulis (tanpa modul) di skrip kecil pada index.html supaya halaman muka hasil prarender tidak berkedip bagi yang akan masuk ke aplikasi;
 * uji/rute.mjs membandingkan keduanya.
 */
import { parameterBerkasGaruda } from './garudaLogic';
import { parameterVerifikasi } from './verifikasiLogic';

const POLA_KUNCI_SESI = /^sb-.+-auth-token$/;
const KUNCI_SESI_LOKAL = 'sigarda_lokal_sesi';

/** Ada sesi tersimpan di peramban ini? (Supabase menyimpan `sb-<proyek>-auth-token`; mode lokal `sigarda_lokal_sesi`.) Tidak pernah melempar galat. */
export function sesiTersimpan(penyimpan = globalThis.localStorage) {
  try {
    if (!penyimpan) return false;
    for (let i = 0; i < penyimpan.length; i++) {
      const k = penyimpan.key(i);
      if (POLA_KUNCI_SESI.test(k) || k === KUNCI_SESI_LOKAL) return true;
    }
  } catch { /* penyimpanan diblokir: dianggap belum masuk */ }
  return false;
}

/** 'verifikasi' | 'berkas' | 'aplikasi' | 'landing'. */
export function pilihRute({ search = '', hash = '', sesi = false, lokal = false } = {}) {
  if (parameterVerifikasi(search) !== null) return 'verifikasi';
  if (parameterBerkasGaruda(search) !== null) return 'berkas';
  if (hash === '#beranda') return 'landing';
  if (hash === '#masuk' || sesi || lokal) return 'aplikasi';
  if (/[?&](masuk|data|ulang|buka)=/.test(search)) return 'aplikasi';
  return 'landing';
}

/**
 * Rute sesudah alamat berubah (hashchange). Hanya #masuk dan #beranda memindahkan; jangkar lain (#tentang, #kontak) hanya menggulir halaman muka,
 * jadi rute tidak berubah. Halaman publik (verifikasi, berkas) tidak dipindahkan oleh perubahan hash.
 */
export function ruteSesudahHash(sekarang, hash) {
  if (sekarang === 'verifikasi' || sekarang === 'berkas') return sekarang;
  if (hash === '#masuk') return 'aplikasi';
  if (hash === '#beranda') return 'landing';
  return sekarang;
}
