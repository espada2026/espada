/**
 * TEMA TAMPILAN
 *
 * Dua tema: 'siaga' (bawaan: biru langit, kuning, merah hasduk, font Baloo 2 dan Nunito) dan 'asli' (cokelat-emas, font Bitter dan Public Sans).
 * Tema berlaku untuk seluruh gudep dan diatur Admin (pengaturan `tampilan.tema`, sg_tema_simpan; dibaca tanpa login lewat sg_gudep_publik).
 * Nilai warna, font, dan sudut ada sebagai variabel CSS pada src/index.css; tema aktif dipasang sebagai atribut data-tema pada <html>.
 * Tema terakhir yang diketahui disimpan di perambah (localStorage) dan dipasang oleh skrip kecil di index.html sebelum halaman tergambar,
 * supaya muat ulang tidak berkedip; sumber kebenarannya tetap server.
 */

export const TEMA_BAWAAN = 'siaga';
export const KUNCI_TEMA = 'sigarda_tema';

export const DAFTAR_TEMA = [
  { id: 'siaga', nama: 'Siaga', keterangan: 'Biru langit, kuning, dan merah hasduk dengan huruf bulat yang ramah anak. Bawaan untuk Pramuka Siaga.' },
  { id: 'asli', nama: 'Asli (cokelat-emas)', keterangan: 'Tampilan semula SIGARDA: cokelat Pramuka dan emas dengan huruf bergaya buku.' },
];

export const temaSah = (t) => DAFTAR_TEMA.some((x) => x.id === t);

/** Memasang tema pada halaman dan mengingatnya di perambah. Nilai yang tidak dikenal diabaikan. Aman dipanggil di luar perambah (prarender). */
export function pasangTema(tema) {
  if (!temaSah(tema)) return false;
  try {
    if (typeof document !== 'undefined') document.documentElement.dataset.tema = tema;
  } catch { /* tanpa dokumen */ }
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KUNCI_TEMA, tema);
  } catch { /* penyimpanan diblokir */ }
  return true;
}

/** Tema yang sedang terpasang pada halaman. */
export function temaAktif() {
  try {
    const t = typeof document !== 'undefined' ? document.documentElement.dataset.tema : null;
    if (temaSah(t)) return t;
  } catch { /* tanpa dokumen */ }
  return TEMA_BAWAAN;
}
