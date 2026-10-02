// Daftar penggantian teks pesan galat dan isi notifikasi di SQL dari istilah Penegak/Dewan Ambalan ke istilah Pramuka Siaga.
// SATU sumber untuk tiga pemakai: (1) skrip yang mengubah supabase/sumber (scripts/migrasi/terapkan-istilah-siaga.mjs), (2) pembangun migrasi
// 2026-10-istilah-siaga.sql (scripts/migrasi/2026-10-istilah-siaga.mjs), dan (3) uji (uji/migrasi-istilah-siaga.mjs).
// Hanya TEKS pesan yang diganti; nilai data seperti jabatan 'Dewan Ambalan' dan nama modul Penegak (Saka, Pinsa, SPG, TKK Penegak) TIDAK disentuh.
// Setiap `dari` harus unik cukup untuk tidak mengenai kode; pasangan diterapkan berurutan pada isi fungsi.

export const PETA = [
  // absensi, iuran, sesi (dipakai gugus depan Siaga)
  ['Hanya Dewan Ambalan, Pembina, atau admin yang dapat mencatat absensi.', 'Hanya Pembina atau admin yang dapat mencatat absensi.'],
  ['Dewan Ambalan perlu mengosongkannya lebih dulu sebelum sesi dihapus.', 'Pembina perlu mengosongkannya lebih dulu sebelum sesi dihapus.'],
  ['Hanya Dewan Ambalan atau asisten bendahara yang dapat mencatat iuran.', 'Hanya Pembina atau asisten bendahara yang dapat mencatat iuran.'],
  ['Hanya Dewan Ambalan atau asisten bendahara yang dapat membuka lembar iuran.', 'Hanya Pembina atau asisten bendahara yang dapat membuka lembar iuran.'],
  ['Iuran Anda sendiri dicatat oleh Dewan Ambalan.', 'Iuran Anda sendiri dicatat oleh Pembina.'],
  ['Hanya Dewan Ambalan atau Pembina yang dapat menutup kas.', 'Hanya Pembina yang dapat menutup kas.'],
  ['Hanya Dewan Ambalan atau Pembina yang dapat menunjuk asisten bendahara.', 'Hanya Pembina yang dapat menunjuk asisten bendahara.'],
  ['Hanya pengurus yang dapat melihat ringkasan iuran Penegak.', 'Hanya pengurus yang dapat melihat ringkasan iuran anggota.'],
  ['Hanya Dewan Ambalan atau Pembina yang dapat mencatat iuran susulan.', 'Hanya Pembina yang dapat mencatat iuran susulan.'],
  ['Hanya Dewan Ambalan, Pembina, atau Admin Gudep yang dapat mengelola sesi ujian.', 'Hanya Pembina atau Admin Gudep yang dapat mengelola sesi ujian.'],
  // pencatatan hasil SKU dan penguji
  ['Hanya Pembina atau Dewan Ambalan yang dapat mencatat hasil.', 'Hanya Pembina yang dapat mencatat hasil.'],
  ['Daftar penguji hanya untuk Penegak, Pembina, dan Admin Gudep.', 'Daftar penguji hanya untuk anggota, Pembina, dan Admin Gudep.'],
  ['rombel Penegak tersebut.', 'rombel anggota tersebut.'],
  ['Butir agama hanya dapat dinilai oleh Pembina yang seagama dengan Penegak.', 'Butir agama hanya dapat dinilai oleh Pembina yang seagama dengan anggota.'],
  // rombel dan status anggota
  ['Hanya Admin Gudep yang dapat memperbarui rombel Penegak.', 'Hanya Admin Gudep yang dapat memperbarui rombel anggota.'],
  ['Baris %: Penegak dengan NIS "%" tidak ditemukan.', 'Baris %: anggota dengan NIS "%" tidak ditemukan.'],
  ['Pengajuan dibatalkan: Penegak menjadi alumni', 'Pengajuan dibatalkan: anggota menjadi alumni'],
  ['Pengajuan dibatalkan: Penegak tidak melanjutkan Pramuka', 'Pengajuan dibatalkan: anggota tidak melanjutkan Pramuka'],
  ['Penegak ini sudah berstatus %.', 'Anggota ini sudah berstatus %.'],
  // beranda, notifikasi, pemeriksaan, eskalasi
  ['(Pembina, Admin Gudep, dan Dewan Ambalan)', '(Pembina dan Admin Gudep)'],
  ['(Pembina, Dewan Ambalan, dan Admin Gudep)', '(Pembina dan Admin Gudep)'],
  ['Hanya Pembina, Dewan Ambalan, dan Admin Gudep yang dapat melihat daftar ini.', 'Hanya Pembina dan Admin Gudep yang dapat melihat daftar ini.'],
  ['Hubungi Pembina atau Dewan bila ada kendala.', 'Hubungi Pembina bila ada kendala.'],
  ['Hubungi Dewan atau asisten bendahara bila ada kendala.', 'Hubungi Pembina atau asisten bendahara bila ada kendala.'],
  // agenda
  ['Maksimal 500 Penegak terkait.', 'Maksimal 500 anggota terkait.'],
  ['Salah satu Penegak terkait tidak ditemukan atau tidak aktif.', 'Salah satu anggota terkait tidak ditemukan atau tidak aktif.'],
];

/** Terapkan semua penggantian pada satu teks (urut). */
export const terapkanPeta = (teks) => PETA.reduce((t, [dari, ke]) => t.split(dari).join(ke), teks);
