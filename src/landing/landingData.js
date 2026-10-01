/**
 * Isi tetap halaman muka (landing page). Isi yang diatur pengurus (kontak, sambutan, cerita gudep) dan agenda mendatang datang dari server
 * (src/lib/berandaLogic.js); sisanya di sini. Tidak memuat data pribadi: halaman ini juga dirender ke HTML saat build (prarender) dan dibaca mesin pencari.
 */

/** Alamat utama situs untuk tautan bagikan (halaman muka dirender saat build tanpa window). Harus sama dengan canonical di index.html (dijaga uji/landing.mjs). */
export const ALAMAT_SITUS = 'https://espada2026.github.io/espada/';

/** `bilaAda` = bagian itu hanya dirender bila ada isinya (Media Sosial), jadi tautannya juga hanya tampil bila ada; lihat menuTampil. Empat butir pertama dipakai pula di kaki halaman. */
export const MENU = [
  { href: '#tentang', label: 'Tentang' },
  { href: '#program', label: 'Program' },
  { href: '#berita', label: 'Berita' },
  { href: '#galeri', label: 'Galeri' },
  { href: '#sosial', label: 'Media Sosial', bilaAda: 'sosial' },
  { href: '#kabar', label: 'Agenda' },
  { href: '#tanya', label: 'Tanya Jawab' },
  { href: '#kontak', label: 'Kontak' },
];

/** Menu yang ditampilkan: butir ber-`bilaAda` hanya bila `ada[bilaAda]` benar (mis. `{ sosial: true }` bila ada kiriman media sosial). Tanpa argumen = tanpa butir bersyarat (HTML prarender). */
export const menuTampil = (ada = {}) => MENU.filter((m) => !m.bilaAda || ada[m.bilaAda] === true);

/** Dwisatya Pramuka Siaga (nama ekspor TRI_SATYA dipertahankan dari kerangka Penegak; isinya Dwisatya). */
export const TRI_SATYA = [
  'Menjalankan kewajibanku terhadap Tuhan Yang Maha Esa, Negara Kesatuan Republik Indonesia dan menurut aturan keluarga.',
  'Setiap hari berbuat kebaikan.',
];

/** Dwidarma Pramuka Siaga (nama ekspor DASA_DARMA dipertahankan dari kerangka Penegak). */
export const DASA_DARMA = [
  'Siaga berbakti pada ayah dan ibundanya',
  'Siaga berani dan tidak putus asa',
];

/** Program gudep: `ikon` = nama ikon SVG di bagian.jsx. */
export const PROGRAM = [
  { id: 'latihan', ikon: 'tenda', judul: 'Latihan Perindukan', besar: true,
    isi: 'Pertemuan rutin bersama barung. Kehadiran dicatat, dan setiap tingkat memerlukan sedikitnya 12 kali latihan. Menabung dibimbing Pembina dengan uang tetap di buku anak.' },
  { id: 'sku', ikon: 'kompas', judul: 'SKU Mula, Bantu, dan Tata', besar: true,
    isi: 'Butir kecakapan dalam lima area (spiritual, emosional, sosial, intelektual, fisik) diuji Pembina secara informal dan menyenangkan. Setiap hasil dapat diperiksa keasliannya lewat kode.' },
  { id: 'garuda', ikon: 'bintang', judul: 'Menuju Siaga Garuda',
    isi: 'Setelah SKU Tata dan dilantik, anak berlatih dan memenuhi syarat Siaga Garuda yang dinilai Pembina.' },
  { id: 'tkk', ikon: 'simpul', judul: 'TKK Siaga',
    isi: 'Tanda Kecakapan Khusus sesuai minat anak, diberikan sesudah Siaga Bantu.' },
  { id: 'gladi', ikon: 'api', judul: 'Pesta Siaga dan Persari',
    isi: 'Pertemuan Siaga dan perkemahan sebagai ajang bergembira, belajar, dan bekerja sama.' },
];

export const PERJALANAN = [
  { id: 'calon-siaga', ikon: 'tunas', judul: 'Calon Siaga', isi: 'Mengenal gudep, barung, dan Dwisatya Dwidarma.' },
  { id: 'mula', ikon: 'simpul', judul: 'Siaga Mula', isi: 'SKU Mula selesai dan dilantik dalam upacara kenaikan tingkat.' },
  { id: 'bantu', ikon: 'kompas', judul: 'Siaga Bantu', isi: 'SKU Bantu selesai; mulai meraih Tanda Kecakapan Khusus.' },
  { id: 'tata', ikon: 'bintang', judul: 'Siaga Tata', isi: 'SKU Tata selesai, lalu menuju Siaga Garuda.', puncak: true },
];

/** Pertanyaan umum bawaan (pengurus dapat menggantinya lewat menu Kelola Beranda). Jawaban tidak boleh memuat janji yang belum tentu benar: rujuk Pembina. */
export const TANYA_JAWAB = [
  { t: 'Kapan dan di mana latihan berlangsung?', j: 'Latihan perindukan berlangsung di lingkungan sekolah sesuai jadwal dari Pembina. Jadwal khusus, seperti Pesta Siaga dan perkemahan, diumumkan di bagian Agenda.' },
  { t: 'Siapa yang menjadi anggota?', j: 'Pramuka Siaga adalah anak sekolah dasar, umumnya kelas 1 sampai 6. Pendaftaran dan pembagian barung diurus Pembina bersama Admin gudep.' },
  { t: 'Perlu seragam dan perlengkapan apa?', j: 'Seragam Pramuka Siaga dan perlengkapan dasar. Daftar lengkapnya diberikan Pembina pada pertemuan pertama.' },
  { t: 'Apakah ada iuran atau tabungan?', j: 'Ada iuran dan kebiasaan menabung. Uang tabungan tetap di buku anak; Pembina hanya memeriksa dan mencatatnya. Nominal dan aturannya disampaikan Pembina.' },
  { t: 'Bagaimana kemajuan anak dipantau?', j: 'Kemajuan SKU, kehadiran latihan, dan pelantikan dicatat Pembina di SIGASI. Orang tua dapat menanyakan catatannya kepada Pembina.' },
  { t: 'Bagaimana memeriksa keaslian surat atau sertifikat dari gudep?', j: 'Masukkan kode yang tercetak di dokumen pada kotak "Cek keaslian dokumen" di bawah, atau pindai kode QR-nya.' },
];
