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

export const TRI_SATYA = [
  'Menjalankan kewajibanku terhadap Tuhan Yang Maha Esa, Negara Kesatuan Republik Indonesia, dan mengamalkan Pancasila.',
  'Menolong sesama hidup dan ikut serta membangun masyarakat.',
  'Menepati Dasa Darma.',
];

export const DASA_DARMA = [
  'Takwa kepada Tuhan Yang Maha Esa',
  'Cinta alam dan kasih sayang sesama manusia',
  'Patriot yang sopan dan kesatria',
  'Patuh dan suka bermusyawarah',
  'Rela menolong dan tabah',
  'Rajin, terampil, dan gembira',
  'Hemat, cermat, dan bersahaja',
  'Disiplin, berani, dan setia',
  'Bertanggung jawab dan dapat dipercaya',
  'Suci dalam pikiran, perkataan, dan perbuatan',
];

/** Program gudep: `ikon` = nama ikon SVG di bagian.jsx. */
export const PROGRAM = [
  { id: 'latihan', ikon: 'tenda', judul: 'Latihan Jumat', besar: true,
    isi: 'Pertemuan mingguan bersama sangga. Kehadiran dicatat, iuran bumbung kepramukaan terkelola, dan Pembina memantau lewat rekap semester.' },
  { id: 'sku', ikon: 'kompas', judul: 'SKU Bantara dan Laksana', besar: true,
    isi: 'Butir kecakapan diuji bertahap: dinilai Pinsa dan Bina Damping lebih dulu, lalu diputuskan Pembina. Setiap hasil dapat diperiksa keasliannya lewat kode.' },
  { id: 'garuda', ikon: 'bintang', judul: 'Menuju Garuda',
    isi: 'Portofolio, Syarat Pramuka Garuda, dan pendampingan sampai penilaian di tingkat Kwartir Cabang.' },
  { id: 'tkk', ikon: 'simpul', judul: 'TKK dan Saka',
    isi: 'Ragam Tanda Kecakapan Khusus dan keanggotaan Satuan Karya sesuai minat.' },
  { id: 'gladi', ikon: 'api', judul: 'Perkemahan dan Gladi',
    isi: 'Perkemahan, Gladi Tangguh, dan pengembaraan sebagai ajang uji mental dan kerja sama.' },
];

export const PERJALANAN = [
  { id: 'calon-bantara', ikon: 'tunas', judul: 'Calon Bantara', isi: 'Mengenal gudep, sangga, dan dasar kepramukaan.' },
  { id: 'bantara', ikon: 'simpul', judul: 'Bantara', isi: 'SKU Bantara selesai dan dilantik sebagai Penegak Bantara.' },
  { id: 'laksana', ikon: 'kompas', judul: 'Laksana', isi: 'SKU Laksana selesai, mulai membimbing dan mengelola kegiatan.' },
  { id: 'garuda', ikon: 'bintang', judul: 'Garuda', isi: 'Portofolio, Syarat Pramuka Garuda, dan penilaian tim Kwarcab.', puncak: true },
];

/** Pertanyaan umum bawaan (Fase 2 memindahkannya ke menu Kelola Beranda). Jawaban tidak boleh memuat janji yang belum tentu benar: rujuk Pembina. */
export const TANYA_JAWAB = [
  { t: 'Kapan dan di mana latihan berlangsung?', j: 'Latihan rutin setiap Jumat di lingkungan SMA Negeri 1 Bukateja. Jadwal khusus, seperti gladi dan perkemahan, diumumkan di bagian Agenda.' },
  { t: 'Siapa yang menjadi anggota?', j: 'Penegak adalah siswa kelas X sampai XII. Pendaftaran dan pembagian rombel diurus Admin gudep bersama Pembina.' },
  { t: 'Perlu seragam dan perlengkapan apa?', j: 'Seragam Pramuka Penegak dan perlengkapan dasar. Daftar lengkapnya diberikan Pembina pada pertemuan pertama.' },
  { t: 'Apakah ada iuran?', j: 'Ada iuran bumbung kepramukaan yang dicatat rapi di aplikasi dan dapat dilihat Penegak sendiri. Nominal dan aturannya disampaikan Pembina.' },
  { t: 'Bagaimana kemajuan Penegak dipantau?', j: 'Kemajuan SKU, kehadiran, dan portofolio dicatat di SIGARDA. Penegak dapat menunjukkan catatannya kepada orang tua, atau orang tua dapat menghubungi Pembina.' },
  { t: 'Bagaimana memeriksa keaslian surat atau sertifikat dari gudep?', j: 'Masukkan kode yang tercetak di dokumen pada kotak "Cek keaslian dokumen" di bawah, atau pindai kode QR-nya.' },
];
