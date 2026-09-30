/**
 * KATALOG SKU PRAMUKA SIAGA (resmi)
 *
 * Sumber: Keputusan Kwartir Nasional Gerakan Pramuka Nomor 119 Tahun 2011, "Panduan Penyelesaian Syarat Kecakapan Umum Siaga"
 * (registri peraturan: `sku-siaga-2011`), bagian "Indikator": kolom Materi SKU tiap tingkat. Yang disalin hanya butir (materi) SKU;
 * kolom "Pencapaian Pengisian SKU" (indikator perincian) dan isi panduan lain tidak ikut.
 *   SKU Siaga Mula : 34 butir
 *   SKU Siaga Bantu: 33 butir
 *   SKU Siaga Tata : 33 butir
 * Butir nomor 1 (spiritual) bercabang menurut agama: Islam, Katolik, Protestan, Hindu, Buddha. Menurut SK, pencapaiannya diusulkan diisi
 * Pemimpin Umat agama masing-masing. Untuk agama lain (Khonghucu) dipakai satu butir pengganti (AGAMA_LAIN_SIAGA).
 *
 * Penulisan: kesalahan ketik pada sumber dibetulkan dan singkatan diluruskan tanpa mengubah makna. Butir 8 Siaga Bantu berbeda untuk putri dan
 * putra pada SK; keduanya dimuat dalam satu butir. Isi panduan pengujian (cara menguji, indikator) TIDAK disalin; lihat SK-nya.
 *
 * `area` = area pengembangan (spiritual, emosional, sosial, intelektual, fisik), diturunkan dari nomor butir menurut tabel SK:
 *   Mula : 1 spiritual, 2-10 emosional, 11-18 sosial, 19-25 intelektual, 26-34 fisik
 *   Bantu dan Tata: 1 spiritual, 2-10 emosional, 11-18 sosial, 19-24 intelektual, 25-33 fisik
 * Aturan id: MUL-xx / BNU-xx / TAT-xx untuk butir biasa, MUL-xx-ISL-n untuk sub-butir agama (id dipakai sebagai kunci penyimpanan; jangan diubah
 * setelah ada data progres).
 */

// AREA_SIAGA dan URUTAN_AREA_SIAGA ada di skuData.js (kecil, dipakai tampilan umum tanpa memuat katalog ini).
export { AREA_SIAGA, URUTAN_AREA_SIAGA } from './skuData.js';

/** Butir pengganti bagi agama yang tidak dirinci SK 119/2011 (mis. Khonghucu). */
export const AGAMA_LAIN_SIAGA = [
  'Materi uji butir agama ditetapkan Pembina bersama Pemimpin Umat agamanya (tidak dirinci pada SK Kwarnas 119/2011).',
];

const areaMula = (no) => (no === 1 ? 'spiritual' : no <= 10 ? 'emosional' : no <= 18 ? 'sosial' : no <= 25 ? 'intelektual' : 'fisik');
const areaBantuTata = (no) => (no === 1 ? 'spiritual' : no <= 10 ? 'emosional' : no <= 18 ? 'sosial' : no <= 24 ? 'intelektual' : 'fisik');
const beri = (daftar, area) => daftar.map((b) => ({ ...b, area: area(b.no) }));

/* ------------------------------- SIAGA MULA ------------------------------- */
export const BUTIR_MULA = beri([
  {
    no: 1,
    agama: {
      Islam: [
        'Dapat menyebutkan Rukun Iman dan Rukun Islam.',
        'Dapat mengucapkan Syahadat dan menyebutkan artinya.',
        'Dapat menghafal Surat Al-Fatihah dan menyebutkan artinya.',
        'Dapat menghafal 3 surat pendek dan menyebutkan artinya.',
        'Dapat mengetahui tata cara berwudhu beserta doanya.',
        'Dapat melaksanakan gerakan sholat dan bacaannya.',
        'Dapat menghafal sedikitnya 3 doa harian.',
      ],
      Katolik: [
        'Dapat membuat tanda salib.',
        'Dapat mengucapkan doa harian dan menyanyikan tiga buah lagu gereja.',
        'Dapat menerima dan mensyukuri keberadaan dirinya sebagai ciptaan Allah, dan memberikan contoh-contohnya.',
        'Dapat mengasihi keluarganya.',
        'Dapat mengasihi teman, guru, dan sesamanya baik di gugus depan, di sekolah, maupun di sekitarnya.',
      ],
      Protestan: [
        'Dapat menghafal Yohanes 3:16 dan berdoa sederhana.',
        'Dapat mewujudkan ucapan syukur atas keberadaan dirinya di dunia ini sebagai ciptaan Allah, sedikitnya tiga hal.',
        'Dapat mengasihi keluarganya.',
        'Dapat mengasihi teman, guru, dan sesamanya baik di gugus depan, di sekolah, maupun di sekitarnya.',
        'Telah mengikuti sekolah minggu 4 kali berturut-turut.',
      ],
      Hindu: [
        'Dapat menunjukkan sikap Anjali serta dapat mengucapkan salam Panganjali.',
        'Dapat memperagakan sikap/tata cara sembahyang.',
        'Dapat menyebutkan nama-nama bunga yang bisa dipakai sembahyang.',
        'Dapat menyebutkan nama tempat suci untuk melaksanakan sembahyang.',
        'Dapat menyebutkan jam atau waktu untuk melaksanakan persembahyangan/Puja Tri Sandhya.',
      ],
      Buddha: [
        'Dapat mengucapkan salam Buddhis.',
        'Dapat bersikap Anjali.',
        'Dapat melakukan Namaskara.',
      ],
    },
  },
  { no: 2, teks: 'Dapat menghafal Dwisatya dan Dwidarma.' },
  { no: 3, teks: 'Dapat menyebutkan jenis-jenis Salam Pramuka.' },
  { no: 4, teks: 'Telah memiliki buku tabungan, sekurang-kurangnya dalam waktu 6 minggu terakhir.' },
  { no: 5, teks: 'Setia membayar uang iuran kepada gugus depannya, sedapat-dapatnya dengan uang yang diperoleh dari usahanya sendiri.' },
  { no: 6, teks: 'Dapat menyebutkan lambang Gerakan Pramuka dan penciptanya.' },
  { no: 7, teks: 'Dapat menyebutkan salah satu seni budaya di daerah tempat tinggalnya.' },
  { no: 8, teks: 'Selalu bersikap hemat dan cermat dengan segala miliknya.' },
  { no: 9, teks: 'Dapat menyebutkan identitas diri dan keluarganya.' },
  { no: 10, teks: 'Dapat membedakan perbuatan baik dan perbuatan buruk.' },
  { no: 11, teks: 'Rajin dan giat mengikuti latihan perindukan Siaga, sekurang-kurangnya 6 kali latihan berturut-turut.' },
  { no: 12, teks: 'Dapat dengan hafal menyanyikan lagu kebangsaan Indonesia Raya bait pertama di depan perindukannya.' },
  { no: 13, teks: 'Dapat menyebutkan arti kiasan warna Sang Merah Putih.' },
  { no: 14, teks: 'Dapat menyebutkan sedikitnya 3 hari besar nasional dan 3 hari besar keagamaan.' },
  { no: 15, teks: 'Dapat menyebutkan 5 peraturan keluarga.' },
  { no: 16, teks: 'Dapat menyebutkan 3 peraturan di lingkungannya.' },
  { no: 17, teks: 'Dapat menyebutkan 2 macam adat/budaya di lingkungannya.' },
  { no: 18, teks: 'Dapat menyampaikan ucapan dengan baik dan sopan serta hormat kepada orang tua, sesama teman, dan orang lain.' },
  { no: 19, teks: 'Dapat menyebutkan nama dan alamat Ketua RT, Ketua RW, Lurah, dan Camat di sekitar tempat tinggalnya.' },
  { no: 20, teks: 'Dapat menyebutkan sila-sila Pancasila.' },
  { no: 21, teks: 'Dapat mengumpulkan keterangan untuk memperoleh pertolongan pertama pada kecelakaan dan dapat menginformasikan kepada orang dewasa di sekitarnya.' },
  { no: 22, teks: 'Dapat membaca jam digital dan analog.' },
  { no: 23, teks: 'Dapat menunjukkan 4 arah mata angin.' },
  { no: 24, teks: 'Dapat berbahasa Indonesia dalam mengikuti pertemuan-pertemuan Siaga.' },
  { no: 25, teks: 'Dapat menyebutkan sedikitnya 2 macam alat komunikasi tradisional dan modern.' },
  { no: 26, teks: 'Dapat menyebutkan organ tubuh.' },
  { no: 27, teks: 'Dapat menyebutkan gerakan dasar olahraga.' },
  { no: 28, teks: 'Dapat melipat selimut dan merapikan tempat tidurnya.' },
  { no: 29, teks: 'Selalu berpakaian rapi dan memelihara kebersihan pribadi.' },
  { no: 30, teks: 'Dapat menjalankan latihan-latihan keseimbangan, dapat melempar dan menerima bola dengan tangan kanan dan kiri sedikitnya 5 kali tangkapan.' },
  { no: 31, teks: 'Dapat menyebutkan makanan dan minuman yang bergizi (4 sehat 5 sempurna).' },
  { no: 32, teks: 'Dapat memelihara sedikitnya satu macam tanaman berguna, atau satu jenis binatang ternak, selama kira-kira 1 bulan.' },
  { no: 33, teks: 'Dapat melipat kertas yang dibentuk menyerupai pesawat, kapal, flora, dan fauna.' },
  { no: 34, teks: 'Dapat membuat simpul mati, simpul hidup, simpul anyam, simpul pangkal, dan simpul jangkar.' },
], areaMula);

/* ------------------------------- SIAGA BANTU ------------------------------ */
export const BUTIR_BANTU = beri([
  {
    no: 1,
    agama: {
      Islam: [
        'Dapat melaksanakan tayamum.',
        'Dapat melaksanakan sholat wajib.',
        'Dapat melaksanakan sholat berjamaah.',
        'Dapat menyebutkan Rasul-rasul Allah.',
        'Dapat melafalkan adzan, iqamah untuk putra dan iqamah untuk putri.',
        'Dapat menghafal sedikitnya 6 doa harian.',
      ],
      Katolik: [
        'Dapat mengucapkan doa harian dan menyanyikan tiga buah lagu gereja.',
        'Dapat menyebutkan hikayat dari Alkitab.',
        'Dapat memberikan yang terbaik kepada keluarga.',
        'Dapat memelihara salah satu ciptaan Allah.',
      ],
      Protestan: [
        'Dapat menyanyikan tiga nyanyian Kristen.',
        'Hafal Doa Bapa Kami.',
        'Dapat menyebutkan hikayat dari Alkitab.',
        'Dapat memberikan yang terbaik kepada keluarga.',
        'Dapat memelihara salah satu ciptaan Allah.',
        'Telah mengikuti sekolah minggu 8 kali berturut-turut.',
      ],
      Hindu: [
        'Dapat menyebutkan nama tempat-tempat suci untuk melaksanakan persembahyangan.',
        'Dapat mempraktikkan tata cara sembahyang dengan doa Gayatri Mantram.',
        'Dapat menyebutkan nama-nama pura yang ada di sekitarnya.',
        'Dapat menyebutkan nama kitab suci agama Hindu.',
        'Dapat menyebutkan bagian Tri Kaya Parisudha.',
        'Dapat menyebutkan contoh-contoh perbuatan yang baik.',
        'Dapat membedakan perbuatan yang baik dan perbuatan yang buruk.',
      ],
      Buddha: [
        'Dapat mengucapkan kata Buddha, Dharma, Sangha (Tri Ratna).',
        'Dapat melakukan sifat karuna (kasih sayang) kepada semua makhluk.',
        'Dapat melakukan sikap berdoa.',
      ],
    },
  },
  { no: 2, teks: 'Dapat melaksanakan Dwisatya dan Dwidarma.' },
  { no: 3, teks: 'Dapat melakukan Salam Pramuka dengan benar.' },
  { no: 4, teks: 'Telah memiliki buku tabungan dan sudah menabung uang secara teratur dalam buku tabungannya selama sekurang-kurangnya 8 minggu sejak menjadi Siaga Mula, yang diperoleh dari usahanya sendiri.' },
  { no: 5, teks: 'Setia membayar uang iuran kepada gugus depan dengan uang yang sebagian diperoleh dari usahanya sendiri.' },
  { no: 6, teks: 'Dapat menyebutkan arti lambang Gerakan Pramuka.' },
  { no: 7, teks: 'Dapat menyebutkan sedikitnya 5 macam seni budaya yang ada di Indonesia.' },
  { no: 8, teks: 'Untuk putri: dapat memasang buah baju dan menyalakan kompor/alat sejenis lainnya. Untuk putra: dapat membuat hasta karya dengan dua macam bahan yang berbeda.' },
  { no: 9, teks: 'Dapat menyampaikan pendapat tentang lingkungan sekitarnya.' },
  { no: 10, teks: 'Dapat memperhatikan dan melaksanakan nasihat orang tua, yanda dan bunda, serta gurunya.' },
  { no: 11, teks: 'Rajin dan giat mengikuti latihan perindukan sebagai Siaga Mula sekurang-kurangnya 8 kali latihan.' },
  { no: 12, teks: 'Dapat memperlihatkan sikap yang harus dilakukan jika lagu kebangsaan diperdengarkan atau dinyanyikan pada suatu upacara.' },
  { no: 13, teks: 'Dapat memperlihatkan cara mengibarkan dan menyimpan bendera merah putih pada upacara pembukaan dan penutupan latihan.' },
  { no: 14, teks: 'Dapat menyebutkan sedikitnya 6 hari besar nasional dan 5 orang nama pahlawan nasional.' },
  { no: 15, teks: 'Dapat mengikuti acara-acara adat/budaya di lingkungan tempat tinggalnya.' },
  { no: 16, teks: 'Dapat menyebutkan 3 peraturan di lingkungan tempat tinggalnya.' },
  { no: 17, teks: 'Dapat menjadi contoh yang baik bagi temannya.' },
  { no: 18, teks: 'Dapat menyebutkan nama kota/kabupaten, ibukota provinsi, dan kepala daerahnya, negara, ibukota negara, kepala negara dan wakilnya.' },
  { no: 19, teks: 'Dapat menyebutkan sila-sila Pancasila sesuai dengan lambangnya.' },
  { no: 20, teks: 'Dapat mengumpulkan keterangan untuk memperoleh pertolongan pertama pada kecelakaan dan dapat menginformasikan kepada petugas Puskesmas/rumah sakit/polisi.' },
  { no: 21, teks: 'Dapat menyebutkan perbedaan jam digital dan jam analog serta dapat memperkirakan waktu tanpa bantuan alat.' },
  { no: 22, teks: 'Dapat menunjukkan 8 arah mata angin.' },
  { no: 23, teks: 'Dapat menyampaikan berita secara lisan dengan menggunakan bahasa Indonesia.' },
  { no: 24, teks: 'Dapat menggunakan alat komunikasi tradisional dan modern.' },
  { no: 25, teks: 'Dapat menyebutkan fungsi organ tubuh.' },
  { no: 26, teks: 'Dapat melakukan gerakan dasar olahraga.' },
  { no: 27, teks: 'Dapat mencuci, menjemur, melipat, dan menyimpan pakaiannya dengan rapi.' },
  { no: 28, teks: 'Dapat memelihara kebersihan salah satu ruangan di rumah, sekolah, tempat ibadah, dan tempat lainnya.' },
  { no: 29, teks: 'Dapat melakukan senam Pramuka.' },
  { no: 30, teks: 'Dapat menunjukkan bahan-bahan makanan yang bergizi.' },
  { no: 31, teks: 'Dapat memelihara sedikitnya satu macam tanaman yang berguna, atau satu jenis binatang ternak, selama kira-kira 2 bulan.' },
  { no: 32, teks: 'Dapat membuat satu macam hasta karya dari barang bekas.' },
  { no: 33, teks: 'Dapat menggunakan simpul mati, simpul hidup, simpul anyam, simpul pangkal, dan simpul jangkar.' },
], areaBantuTata);

/* ------------------------------- SIAGA TATA ------------------------------- */
export const BUTIR_TATA = beri([
  {
    no: 1,
    agama: {
      Islam: [
        'Dapat membaca Al Quran dan mengetahui tanda bacanya.',
        'Dapat menyebutkan Asmaul Husna dan artinya.',
        'Dapat mengetahui dan menceritakan salah satu kisah Rasul.',
        'Dapat menyebutkan 10 nama malaikat dan tugasnya.',
      ],
      Katolik: [
        'Tahu doa Iman, doa harapan, doa cinta kasih, dan doa tobat.',
        'Telah mengikuti Perayaan Ekaristi dan tahu arti Konsekrasi.',
        'Dapat mengenal nama Pastor Paroki dan nama Uskup setempat.',
        'Dapat menunjukkan kemahakuasaan Allah.',
        'Dapat menunjukkan tindakan manusia yang bergantung kepada Allah.',
      ],
      Protestan: [
        'Dapat menghafal Lukas 10:27 (hukum kasih).',
        'Dapat mengucap dan menggunakan doa sederhana pada kesempatan tertentu.',
        'Dapat menunjukkan kemahakuasaan Allah, sedikitnya 5 macam.',
        'Dapat menunjukkan tindakan manusia yang bergantung kepada Allah, sedikitnya 5 macam.',
        'Rajin mengikuti sekolah minggu di gerejanya.',
      ],
      Hindu: [
        'Dapat menghafal bait-bait Puja Tri Sandya.',
        'Dapat menyebutkan hari-hari suci agama Hindu.',
        'Dapat memahami perbedaan makna dari perayaan hari-hari besar/suci agama Hindu.',
        'Dapat menyebutkan beberapa nama pura besar di Indonesia.',
        'Dapat menyebutkan bagian dari Panca Sradha.',
        'Dapat menyebutkan bagian dari Panca Yadnya.',
        'Dapat melakukan salah satu gerakan dalam Yoga Asanas.',
      ],
      Buddha: [
        'Dapat melafalkan Paritta Namaskara.',
        'Dapat mengucapkan Paritta Vandana.',
        'Dapat mengucapkan Paritta Pancasila Buddhis (bahasa Indonesia).',
      ],
    },
  },
  { no: 2, teks: 'Dapat mengajak temannya untuk mengamalkan Dwisatya dan Dwidarma.' },
  { no: 3, teks: 'Dapat menjelaskan tentang Salam Pramuka kepada teman sebarungnya.' },
  { no: 4, teks: 'Telah memiliki buku tabungan dan sudah menabung uang secara teratur dalam buku tabungannya selama sekurang-kurangnya 12 minggu sejak menjadi Siaga Bantu. Seluruh atau sebagian dari uang itu diperoleh dari usahanya sendiri.' },
  { no: 5, teks: 'Setia membayar uang iuran kepada gugus depan dengan uang yang diperoleh dari usahanya sendiri.' },
  { no: 6, teks: 'Dapat membuat lambang Gerakan Pramuka dari bahan yang ada.' },
  { no: 7, teks: 'Dapat memperagakan satu macam kegiatan seni budaya asal daerahnya.' },
  { no: 8, teks: 'Telah memiliki sedikitnya 5 tanda kecakapan khusus.' },
  { no: 9, teks: 'Dapat mengkritisi sesuatu masalah dengan baik.' },
  { no: 10, teks: 'Dapat menolong seseorang dan peduli terhadap lingkungan sekitarnya.' },
  { no: 11, teks: 'Rajin dan giat mengikuti latihan perindukan sebagai Siaga Bantu sekurang-kurangnya 12 kali latihan.' },
  { no: 12, teks: 'Dapat menceritakan sejarah Lagu Kebangsaan Indonesia Raya.' },
  { no: 13, teks: 'Dapat menceritakan sejarah bendera kebangsaan Indonesia dan tahu sikap yang harus dilakukan pada waktu bendera kebangsaan dikibarkan atau diturunkan serta dapat memelihara bendera kebangsaan.' },
  { no: 14, teks: 'Dapat menyebutkan sedikitnya 7 hari besar nasional, 4 hari besar dunia, dan 10 nama pahlawan nasional.' },
  { no: 15, teks: 'Dapat menyebutkan akibat melanggar peraturan di keluarga, barung, perindukan, dan sekolah.' },
  { no: 16, teks: 'Dapat menyebutkan akibat melanggar adat/budaya di lingkungannya.' },
  { no: 17, teks: 'Dapat mengajak temannya berbuat baik dan berkata benar.' },
  { no: 18, teks: 'Dapat menyebutkan negara-negara ASEAN dan menunjukkan bendera kebangsaannya.' },
  { no: 19, teks: 'Dapat menyebutkan perbuatan yang baik sesuai dengan sila-sila Pancasila.' },
  { no: 20, teks: 'Dapat mengumpulkan keterangan untuk memperoleh pertolongan pertama pada kecelakaan dan menyampaikan kepada dokter, rumah sakit, polisi, dan keluarga korban.' },
  { no: 21, teks: 'Dapat menceritakan dasar terjadinya perbedaan waktu yang ada di wilayah Indonesia.' },
  { no: 22, teks: 'Dapat menunjuk 8 macam arah mata angin dengan menggunakan kompas.' },
  { no: 23, teks: 'Dapat menulis surat kepada teman atau saudaranya dengan menggunakan bahasa Indonesia.' },
  { no: 24, teks: 'Dapat merawat peralatan elektronik, peralatan listrik, dan alat komunikasi yang ada di rumahnya.' },
  { no: 25, teks: 'Dapat memelihara organ tubuh.' },
  { no: 26, teks: 'Dapat melakukan olahraga secara tim.' },
  { no: 27, teks: 'Dapat mencuci peralatan dapur.' },
  { no: 28, teks: 'Dapat memelihara kebersihan halaman di rumah, sekolah, tempat ibadah, atau di tempat lainnya.' },
  { no: 29, teks: 'Dapat melakukan salah satu cabang olahraga atletik atau salah satu gaya cabang olahraga renang.' },
  { no: 30, teks: 'Dapat menyebutkan 5 macam penyakit menular.' },
  { no: 31, teks: 'Dapat memelihara sedikitnya dua macam tanaman berguna, atau satu jenis binatang ternak, selama kira-kira 4 bulan.' },
  { no: 32, teks: 'Dapat membuat 2 (dua) macam hasta karya dengan bahan yang berbeda.' },
  { no: 33, teks: 'Dapat membuat sedikitnya 2 (dua) macam ikatan.' },
], areaBantuTata);
