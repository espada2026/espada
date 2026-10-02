/**
 * PANDUAN PENGGUNA (tahap L10, murni tanpa React). Menentukan panduan peran mana yang tampil LEBIH DULU bagi seorang
 * pengguna; isi panduannya sendiri di src/data/panduanData.js. Semua peran dapat membaca panduan peran lain (tidak ada
 * yang dirahasiakan di sini, sekadar petunjuk pemakaian) -- hanya pilihan BAWAAN yang berbeda menurut peran dan tampilan
 * yang sedang aktif.
 */
import { PERAN_PANDUAN } from '../data/panduanData';

export { PERAN_PANDUAN };

/** Kode panduan (lihat PERAN_PANDUAN) yang paling sesuai untuk `user` (bentuk tampilan aktif dari AppContext). */
export function panduanAwal(user) {
  if (!user) return 'anggota';
  if (user.role === 'admin') return 'admin';
  if (user.role === 'penguji') return 'pembina';
  return 'anggota';
}
