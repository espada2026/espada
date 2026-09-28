/**
 * Sampul otomatis album Google Photos (murni): menentukan kapan formulir Galeri boleh meminta sampul ke fungsi server `galeri-sampul`
 * (supabase/functions/galeri-sampul/index.ts). Fungsi itu memeriksa ulang semuanya; pemeriksaan di sini hanya menghindari permintaan yang pasti ditolak.
 * `albumGooglePhotos` dicerminkan dari fungsi server yang sama dan dibandingkan langsung di uji/galeri-sampul.mjs.
 */

const HOST_ALBUM = new Set(['photos.app.goo.gl', 'photos.google.com']);

/** Tautan album Google Photos yang dibagikan (https, host dikenal). */
export function albumGooglePhotos(tautan) {
  try {
    const u = new URL(String(tautan ?? '').trim());
    return u.protocol === 'https:' && HOST_ALBUM.has(u.hostname.toLowerCase());
  } catch { return false; }
}

/**
 * Perlu mengambil sampul otomatis untuk isian ini? Ya bila tautannya album Google Photos, sampul belum diisi, dan tautan itu belum dicoba
 * (`sudahDicoba` = tautan terakhir yang sudah diminta), supaya satu tautan tidak diminta berulang-ulang tiap ketikan.
 */
export const perluAmbilSampul = ({ tautan, sampulUrl }, sudahDicoba = '') => albumGooglePhotos(tautan) && !String(sampulUrl ?? '').trim() && String(tautan).trim() !== sudahDicoba;
