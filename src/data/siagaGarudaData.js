/**
 * SYARAT SIAGA GARUDA, 6 butir (Pramuka Siaga, Fase 6).
 *
 * Sumber: Jukran Kwarnas 038/2017 (Petunjuk Penyelenggaraan Pramuka Garuda, bagian golongan Siaga). Hanya bunyi singkat butir; isi rubrik pengujian tidak disimpan di repositori.
 * Penilaian perseorangan oleh Pembina (pengamatan, wawancara, keterangan guru/orang tua/teman), tanpa tim Kwarcab.
 *
 * jenis:
 *   'otomatis' = aplikasi memberi SARAN dari data yang sudah tercatat (SKU, pelantikan, TKK, kegiatan Agenda yang diikuti); Pembina tetap menetapkan.
 *   'manual'   = dinilai Pembina sepenuhnya (belum ada datanya di aplikasi).
 * Jangan ubah `no` setelah ada data penetapan (server membatasi 1 sampai 6).
 */
export const BUTIR_SIAGA_GARUDA = [
  { no: 1, judul: 'SKU Tata dan berlatih 2 bulan', uraian: 'Telah menyelesaikan SKU Siaga Tata dan berlatih sekurang-kurangnya 2 (dua) bulan sesudah dilantik.', jenis: 'otomatis', aturan: 'sku-tata' },
  { no: 2, judul: 'Tanda Kecakapan Khusus (TKK)', uraian: 'Memiliki TKK Siaga sekurang-kurangnya 4 (empat) macam dari masing-masing bidang.', jenis: 'otomatis', aturan: 'tkk' },
  { no: 3, judul: 'Tiga hasta karya', uraian: 'Membuat sekurang-kurangnya 3 (tiga) hasta karya.', jenis: 'manual' },
  { no: 4, judul: 'Pertemuan Siaga di kwartir', uraian: 'Pernah mengikuti pertemuan Pramuka Siaga di tingkat kwartir.', jenis: 'otomatis', aturan: 'agenda', jenisAgenda: 'pertemuan_siaga' },
  { no: 5, judul: 'Persari', uraian: 'Pernah mengikuti Persari (Perkemahan Siaga Sari).', jenis: 'otomatis', aturan: 'agenda', jenisAgenda: 'persari' },
  { no: 6, judul: 'Komputer', uraian: 'Dapat memakai komputer.', jenis: 'manual' },
];

export const INDEKS_SIAGA_GARUDA = Object.fromEntries(BUTIR_SIAGA_GARUDA.map((b) => [b.no, b]));
/** Bulan berlatih sesudah dilantik Siaga Tata (butir 1). */
export const BULAN_LATIH_TATA = 2;
/** Jumlah TKK minimal per bidang untuk saran butir 2. KALIMAT SUMBER AMBIGU ("4 macam dari masing-masing bidang"): hanya saran, dikonfirmasi ke Kwarcab. */
export const TKK_PER_BIDANG = 4;
