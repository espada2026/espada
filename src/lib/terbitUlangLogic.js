// Ringkasan keadaan "terbit ulang halaman berita" (sg_terbit_ulang_status) untuk panel di Kelola Beranda > Berita. Murni tampilan: server yang memutuskan kapan meminta
// deploy ke GitHub (supabase/sumber/29-terbit-ulang.sql); tidak ada aturan yang dicerminkan di sini.
import { fmtWaktu } from './format.js';

/**
 * @param {object|null} keadaan jawaban sg_terbit_ulang_status: { diatur, perlu, kirimTerakhir, status, pesan, gagalBeruntun, menyerah }
 * @returns {{ tingkat: 'belum'|'menyerah'|'gagal'|'menunggu'|'ok'|'baru', judul: string, rincian: string, bolehMinta: boolean }}
 */
export function ringkasTerbitUlang(keadaan) {
  if (!keadaan || keadaan.diatur !== true) {
    return {
      tingkat: 'belum',
      judul: 'Terbit ulang otomatis belum dipasang',
      rincian: 'Berita yang baru diterbitkan sudah langsung tampil di beranda, tetapi halaman beritanya sendiri (untuk pencarian Google dan pratinjau WhatsApp) baru muncul setelah situs diterbitkan ulang oleh pemilik proyek.',
      bolehMinta: false,
    };
  }
  const kapan = keadaan.kirimTerakhir ? fmtWaktu(keadaan.kirimTerakhir) : null;
  if (keadaan.menyerah) {
    return {
      tingkat: 'menyerah',
      judul: 'Terbit ulang berhenti setelah beberapa kali gagal',
      rincian: `${keadaan.pesan ?? 'Permintaan ke GitHub ditolak.'} Beri tahu pemilik proyek. Menerbitkan berita baru atau menekan tombol di bawah akan mencoba lagi.`,
      bolehMinta: true,
    };
  }
  if (keadaan.gagalBeruntun > 0) {
    return {
      tingkat: 'gagal',
      judul: 'Permintaan terbit ulang terakhir gagal, akan dicoba lagi otomatis',
      rincian: keadaan.pesan ?? '',
      bolehMinta: true,
    };
  }
  if (keadaan.perlu || (keadaan.status == null && keadaan.kirimTerakhir)) {
    return {
      tingkat: 'menunggu',
      judul: 'Halaman berita sedang menunggu diterbitkan ulang',
      rincian: `${kapan ? `Permintaan terakhir ${kapan}. ` : ''}Biasanya selesai dalam beberapa menit; halaman berita baru muncul setelahnya.`,
      bolehMinta: true,
    };
  }
  if (keadaan.status === 204 && kapan) {
    return { tingkat: 'ok', judul: 'Halaman berita mutakhir', rincian: `Terakhir diminta terbit ulang ${kapan}. Perubahan berita berikutnya akan diterbitkan otomatis.`, bolehMinta: true };
  }
  return { tingkat: 'baru', judul: 'Terbit ulang otomatis sudah dipasang', rincian: 'Akan berjalan sendiri begitu ada berita yang diterbitkan atau diubah.', bolehMinta: true };
}
