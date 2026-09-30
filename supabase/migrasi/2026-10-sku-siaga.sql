-- ============================================================================
-- MIGRASI: Pramuka Siaga, Fase 2: SKU Siaga (Mula, Bantu, Tata). AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-10-siaga-anggota.sql (lihat README). Isi:
--   * Kendala sku_butir_tingkat_check diperluas: tingkat Mula, Bantu, Tata (selain Bantara dan Laksana).
--   * Katalog SKU Siaga (SK Kwarnas 119/2011): 100 butir dan 175 unit (sub-butir agama), isi sama dengan src/data/skuSiagaData.js. Tidak menimpa baris yang sudah ada.
--   * Fungsi baru sigarda.prasyarat_tingkat (Laksana menunggu Bantara, Bantu menunggu Mula, Tata menunggu Bantu).
--   * sg_sku_ajukan dan sg_sku_catat_internal ditulis ulang (tanda tangan sama): aturan "tingkat sebelumnya selesai dulu" berlaku umum, bukan hanya Laksana.
--   * sigarda.tolak_peserta_tak_aktif ditulis ulang: pesan untuk anak Siaga tanpa agama menyuruh Pembina mengisinya di menu Anggota Siaga.
--   * sigarda.eskalasi_proses dan sg_eskalasi_daftar ditulis ulang (tanda tangan sama): anak Siaga tanpa akun tidak ikut tangga pengingat "tidak bergerak" dan Tindak Lanjut.
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'tanpa_akun') then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (sampai 2026-10-siaga-anggota.sql; lihat README), baru migrasi ini.';
  end if;
end $$;

-- Katalog: kendala tingkat diperluas lebih dulu, baru baris Siaga dimasukkan.
alter table public.sku_butir drop constraint if exists sku_butir_tingkat_check;
alter table public.sku_butir add constraint sku_butir_tingkat_check check (tingkat in ('Bantara','Laksana','Mula','Bantu','Tata'));

insert into public.sku_butir (id, tingkat, no, teks) values
  ('MUL-01', 'Mula', 1, 'Sesuai agama yang dianut (ketakwaan)'),
  ('MUL-02', 'Mula', 2, 'Dapat menghafal Dwisatya dan Dwidarma.'),
  ('MUL-03', 'Mula', 3, 'Dapat menyebutkan jenis-jenis Salam Pramuka.'),
  ('MUL-04', 'Mula', 4, 'Telah memiliki buku tabungan, sekurang-kurangnya dalam waktu 6 minggu terakhir.'),
  ('MUL-05', 'Mula', 5, 'Setia membayar uang iuran kepada gugus depannya, sedapat-dapatnya dengan uang yang diperoleh dari usahanya sendiri.'),
  ('MUL-06', 'Mula', 6, 'Dapat menyebutkan lambang Gerakan Pramuka dan penciptanya.'),
  ('MUL-07', 'Mula', 7, 'Dapat menyebutkan salah satu seni budaya di daerah tempat tinggalnya.'),
  ('MUL-08', 'Mula', 8, 'Selalu bersikap hemat dan cermat dengan segala miliknya.'),
  ('MUL-09', 'Mula', 9, 'Dapat menyebutkan identitas diri dan keluarganya.'),
  ('MUL-10', 'Mula', 10, 'Dapat membedakan perbuatan baik dan perbuatan buruk.'),
  ('MUL-11', 'Mula', 11, 'Rajin dan giat mengikuti latihan perindukan Siaga, sekurang-kurangnya 6 kali latihan berturut-turut.'),
  ('MUL-12', 'Mula', 12, 'Dapat dengan hafal menyanyikan lagu kebangsaan Indonesia Raya bait pertama di depan perindukannya.'),
  ('MUL-13', 'Mula', 13, 'Dapat menyebutkan arti kiasan warna Sang Merah Putih.'),
  ('MUL-14', 'Mula', 14, 'Dapat menyebutkan sedikitnya 3 hari besar nasional dan 3 hari besar keagamaan.'),
  ('MUL-15', 'Mula', 15, 'Dapat menyebutkan 5 peraturan keluarga.'),
  ('MUL-16', 'Mula', 16, 'Dapat menyebutkan 3 peraturan di lingkungannya.'),
  ('MUL-17', 'Mula', 17, 'Dapat menyebutkan 2 macam adat/budaya di lingkungannya.'),
  ('MUL-18', 'Mula', 18, 'Dapat menyampaikan ucapan dengan baik dan sopan serta hormat kepada orang tua, sesama teman, dan orang lain.'),
  ('MUL-19', 'Mula', 19, 'Dapat menyebutkan nama dan alamat Ketua RT, Ketua RW, Lurah, dan Camat di sekitar tempat tinggalnya.'),
  ('MUL-20', 'Mula', 20, 'Dapat menyebutkan sila-sila Pancasila.'),
  ('MUL-21', 'Mula', 21, 'Dapat mengumpulkan keterangan untuk memperoleh pertolongan pertama pada kecelakaan dan dapat menginformasikan kepada orang dewasa di sekitarnya.'),
  ('MUL-22', 'Mula', 22, 'Dapat membaca jam digital dan analog.'),
  ('MUL-23', 'Mula', 23, 'Dapat menunjukkan 4 arah mata angin.'),
  ('MUL-24', 'Mula', 24, 'Dapat berbahasa Indonesia dalam mengikuti pertemuan-pertemuan Siaga.'),
  ('MUL-25', 'Mula', 25, 'Dapat menyebutkan sedikitnya 2 macam alat komunikasi tradisional dan modern.'),
  ('MUL-26', 'Mula', 26, 'Dapat menyebutkan organ tubuh.'),
  ('MUL-27', 'Mula', 27, 'Dapat menyebutkan gerakan dasar olahraga.'),
  ('MUL-28', 'Mula', 28, 'Dapat melipat selimut dan merapikan tempat tidurnya.'),
  ('MUL-29', 'Mula', 29, 'Selalu berpakaian rapi dan memelihara kebersihan pribadi.'),
  ('MUL-30', 'Mula', 30, 'Dapat menjalankan latihan-latihan keseimbangan, dapat melempar dan menerima bola dengan tangan kanan dan kiri sedikitnya 5 kali tangkapan.'),
  ('MUL-31', 'Mula', 31, 'Dapat menyebutkan makanan dan minuman yang bergizi (4 sehat 5 sempurna).'),
  ('MUL-32', 'Mula', 32, 'Dapat memelihara sedikitnya satu macam tanaman berguna, atau satu jenis binatang ternak, selama kira-kira 1 bulan.'),
  ('MUL-33', 'Mula', 33, 'Dapat melipat kertas yang dibentuk menyerupai pesawat, kapal, flora, dan fauna.'),
  ('MUL-34', 'Mula', 34, 'Dapat membuat simpul mati, simpul hidup, simpul anyam, simpul pangkal, dan simpul jangkar.'),
  ('BNU-01', 'Bantu', 1, 'Sesuai agama yang dianut (ketakwaan)'),
  ('BNU-02', 'Bantu', 2, 'Dapat melaksanakan Dwisatya dan Dwidarma.'),
  ('BNU-03', 'Bantu', 3, 'Dapat melakukan Salam Pramuka dengan benar.'),
  ('BNU-04', 'Bantu', 4, 'Telah memiliki buku tabungan dan sudah menabung uang secara teratur dalam buku tabungannya selama sekurang-kurangnya 8 minggu sejak menjadi Siaga Mula, yang diperoleh dari usahanya sendiri.'),
  ('BNU-05', 'Bantu', 5, 'Setia membayar uang iuran kepada gugus depan dengan uang yang sebagian diperoleh dari usahanya sendiri.'),
  ('BNU-06', 'Bantu', 6, 'Dapat menyebutkan arti lambang Gerakan Pramuka.'),
  ('BNU-07', 'Bantu', 7, 'Dapat menyebutkan sedikitnya 5 macam seni budaya yang ada di Indonesia.'),
  ('BNU-08', 'Bantu', 8, 'Untuk putri: dapat memasang buah baju dan menyalakan kompor/alat sejenis lainnya. Untuk putra: dapat membuat hasta karya dengan dua macam bahan yang berbeda.'),
  ('BNU-09', 'Bantu', 9, 'Dapat menyampaikan pendapat tentang lingkungan sekitarnya.'),
  ('BNU-10', 'Bantu', 10, 'Dapat memperhatikan dan melaksanakan nasihat orang tua, yanda dan bunda, serta gurunya.'),
  ('BNU-11', 'Bantu', 11, 'Rajin dan giat mengikuti latihan perindukan sebagai Siaga Mula sekurang-kurangnya 8 kali latihan.'),
  ('BNU-12', 'Bantu', 12, 'Dapat memperlihatkan sikap yang harus dilakukan jika lagu kebangsaan diperdengarkan atau dinyanyikan pada suatu upacara.'),
  ('BNU-13', 'Bantu', 13, 'Dapat memperlihatkan cara mengibarkan dan menyimpan bendera merah putih pada upacara pembukaan dan penutupan latihan.'),
  ('BNU-14', 'Bantu', 14, 'Dapat menyebutkan sedikitnya 6 hari besar nasional dan 5 orang nama pahlawan nasional.'),
  ('BNU-15', 'Bantu', 15, 'Dapat mengikuti acara-acara adat/budaya di lingkungan tempat tinggalnya.'),
  ('BNU-16', 'Bantu', 16, 'Dapat menyebutkan 3 peraturan di lingkungan tempat tinggalnya.'),
  ('BNU-17', 'Bantu', 17, 'Dapat menjadi contoh yang baik bagi temannya.'),
  ('BNU-18', 'Bantu', 18, 'Dapat menyebutkan nama kota/kabupaten, ibukota provinsi, dan kepala daerahnya, negara, ibukota negara, kepala negara dan wakilnya.'),
  ('BNU-19', 'Bantu', 19, 'Dapat menyebutkan sila-sila Pancasila sesuai dengan lambangnya.'),
  ('BNU-20', 'Bantu', 20, 'Dapat mengumpulkan keterangan untuk memperoleh pertolongan pertama pada kecelakaan dan dapat menginformasikan kepada petugas Puskesmas/rumah sakit/polisi.'),
  ('BNU-21', 'Bantu', 21, 'Dapat menyebutkan perbedaan jam digital dan jam analog serta dapat memperkirakan waktu tanpa bantuan alat.'),
  ('BNU-22', 'Bantu', 22, 'Dapat menunjukkan 8 arah mata angin.'),
  ('BNU-23', 'Bantu', 23, 'Dapat menyampaikan berita secara lisan dengan menggunakan bahasa Indonesia.'),
  ('BNU-24', 'Bantu', 24, 'Dapat menggunakan alat komunikasi tradisional dan modern.'),
  ('BNU-25', 'Bantu', 25, 'Dapat menyebutkan fungsi organ tubuh.'),
  ('BNU-26', 'Bantu', 26, 'Dapat melakukan gerakan dasar olahraga.'),
  ('BNU-27', 'Bantu', 27, 'Dapat mencuci, menjemur, melipat, dan menyimpan pakaiannya dengan rapi.'),
  ('BNU-28', 'Bantu', 28, 'Dapat memelihara kebersihan salah satu ruangan di rumah, sekolah, tempat ibadah, dan tempat lainnya.'),
  ('BNU-29', 'Bantu', 29, 'Dapat melakukan senam Pramuka.'),
  ('BNU-30', 'Bantu', 30, 'Dapat menunjukkan bahan-bahan makanan yang bergizi.'),
  ('BNU-31', 'Bantu', 31, 'Dapat memelihara sedikitnya satu macam tanaman yang berguna, atau satu jenis binatang ternak, selama kira-kira 2 bulan.'),
  ('BNU-32', 'Bantu', 32, 'Dapat membuat satu macam hasta karya dari barang bekas.'),
  ('BNU-33', 'Bantu', 33, 'Dapat menggunakan simpul mati, simpul hidup, simpul anyam, simpul pangkal, dan simpul jangkar.'),
  ('TAT-01', 'Tata', 1, 'Sesuai agama yang dianut (ketakwaan)'),
  ('TAT-02', 'Tata', 2, 'Dapat mengajak temannya untuk mengamalkan Dwisatya dan Dwidarma.'),
  ('TAT-03', 'Tata', 3, 'Dapat menjelaskan tentang Salam Pramuka kepada teman sebarungnya.'),
  ('TAT-04', 'Tata', 4, 'Telah memiliki buku tabungan dan sudah menabung uang secara teratur dalam buku tabungannya selama sekurang-kurangnya 12 minggu sejak menjadi Siaga Bantu. Seluruh atau sebagian dari uang itu diperoleh dari usahanya sendiri.'),
  ('TAT-05', 'Tata', 5, 'Setia membayar uang iuran kepada gugus depan dengan uang yang diperoleh dari usahanya sendiri.'),
  ('TAT-06', 'Tata', 6, 'Dapat membuat lambang Gerakan Pramuka dari bahan yang ada.'),
  ('TAT-07', 'Tata', 7, 'Dapat memperagakan satu macam kegiatan seni budaya asal daerahnya.'),
  ('TAT-08', 'Tata', 8, 'Telah memiliki sedikitnya 5 tanda kecakapan khusus.'),
  ('TAT-09', 'Tata', 9, 'Dapat mengkritisi sesuatu masalah dengan baik.'),
  ('TAT-10', 'Tata', 10, 'Dapat menolong seseorang dan peduli terhadap lingkungan sekitarnya.'),
  ('TAT-11', 'Tata', 11, 'Rajin dan giat mengikuti latihan perindukan sebagai Siaga Bantu sekurang-kurangnya 12 kali latihan.'),
  ('TAT-12', 'Tata', 12, 'Dapat menceritakan sejarah Lagu Kebangsaan Indonesia Raya.'),
  ('TAT-13', 'Tata', 13, 'Dapat menceritakan sejarah bendera kebangsaan Indonesia dan tahu sikap yang harus dilakukan pada waktu bendera kebangsaan dikibarkan atau diturunkan serta dapat memelihara bendera kebangsaan.'),
  ('TAT-14', 'Tata', 14, 'Dapat menyebutkan sedikitnya 7 hari besar nasional, 4 hari besar dunia, dan 10 nama pahlawan nasional.'),
  ('TAT-15', 'Tata', 15, 'Dapat menyebutkan akibat melanggar peraturan di keluarga, barung, perindukan, dan sekolah.'),
  ('TAT-16', 'Tata', 16, 'Dapat menyebutkan akibat melanggar adat/budaya di lingkungannya.'),
  ('TAT-17', 'Tata', 17, 'Dapat mengajak temannya berbuat baik dan berkata benar.'),
  ('TAT-18', 'Tata', 18, 'Dapat menyebutkan negara-negara ASEAN dan menunjukkan bendera kebangsaannya.'),
  ('TAT-19', 'Tata', 19, 'Dapat menyebutkan perbuatan yang baik sesuai dengan sila-sila Pancasila.'),
  ('TAT-20', 'Tata', 20, 'Dapat mengumpulkan keterangan untuk memperoleh pertolongan pertama pada kecelakaan dan menyampaikan kepada dokter, rumah sakit, polisi, dan keluarga korban.'),
  ('TAT-21', 'Tata', 21, 'Dapat menceritakan dasar terjadinya perbedaan waktu yang ada di wilayah Indonesia.'),
  ('TAT-22', 'Tata', 22, 'Dapat menunjuk 8 macam arah mata angin dengan menggunakan kompas.'),
  ('TAT-23', 'Tata', 23, 'Dapat menulis surat kepada teman atau saudaranya dengan menggunakan bahasa Indonesia.'),
  ('TAT-24', 'Tata', 24, 'Dapat merawat peralatan elektronik, peralatan listrik, dan alat komunikasi yang ada di rumahnya.'),
  ('TAT-25', 'Tata', 25, 'Dapat memelihara organ tubuh.'),
  ('TAT-26', 'Tata', 26, 'Dapat melakukan olahraga secara tim.'),
  ('TAT-27', 'Tata', 27, 'Dapat mencuci peralatan dapur.'),
  ('TAT-28', 'Tata', 28, 'Dapat memelihara kebersihan halaman di rumah, sekolah, tempat ibadah, atau di tempat lainnya.'),
  ('TAT-29', 'Tata', 29, 'Dapat melakukan salah satu cabang olahraga atletik atau salah satu gaya cabang olahraga renang.'),
  ('TAT-30', 'Tata', 30, 'Dapat menyebutkan 5 macam penyakit menular.'),
  ('TAT-31', 'Tata', 31, 'Dapat memelihara sedikitnya dua macam tanaman berguna, atau satu jenis binatang ternak, selama kira-kira 4 bulan.'),
  ('TAT-32', 'Tata', 32, 'Dapat membuat 2 (dua) macam hasta karya dengan bahan yang berbeda.'),
  ('TAT-33', 'Tata', 33, 'Dapat membuat sedikitnya 2 (dua) macam ikatan.')
on conflict (id) do nothing;

insert into public.sku_unit (id, butir_id, tingkat, butir_no, agama, sub) values
  ('BNU-01-BUD-1', 'BNU-01', 'Bantu', 1, 'Buddha', 1),
  ('BNU-01-BUD-2', 'BNU-01', 'Bantu', 1, 'Buddha', 2),
  ('BNU-01-BUD-3', 'BNU-01', 'Bantu', 1, 'Buddha', 3),
  ('BNU-01-HIN-1', 'BNU-01', 'Bantu', 1, 'Hindu', 1),
  ('BNU-01-HIN-2', 'BNU-01', 'Bantu', 1, 'Hindu', 2),
  ('BNU-01-HIN-3', 'BNU-01', 'Bantu', 1, 'Hindu', 3),
  ('BNU-01-HIN-4', 'BNU-01', 'Bantu', 1, 'Hindu', 4),
  ('BNU-01-HIN-5', 'BNU-01', 'Bantu', 1, 'Hindu', 5),
  ('BNU-01-HIN-6', 'BNU-01', 'Bantu', 1, 'Hindu', 6),
  ('BNU-01-HIN-7', 'BNU-01', 'Bantu', 1, 'Hindu', 7),
  ('BNU-01-ISL-1', 'BNU-01', 'Bantu', 1, 'Islam', 1),
  ('BNU-01-ISL-2', 'BNU-01', 'Bantu', 1, 'Islam', 2),
  ('BNU-01-ISL-3', 'BNU-01', 'Bantu', 1, 'Islam', 3),
  ('BNU-01-ISL-4', 'BNU-01', 'Bantu', 1, 'Islam', 4),
  ('BNU-01-ISL-5', 'BNU-01', 'Bantu', 1, 'Islam', 5),
  ('BNU-01-ISL-6', 'BNU-01', 'Bantu', 1, 'Islam', 6),
  ('BNU-01-KAT-1', 'BNU-01', 'Bantu', 1, 'Katolik', 1),
  ('BNU-01-KAT-2', 'BNU-01', 'Bantu', 1, 'Katolik', 2),
  ('BNU-01-KAT-3', 'BNU-01', 'Bantu', 1, 'Katolik', 3),
  ('BNU-01-KAT-4', 'BNU-01', 'Bantu', 1, 'Katolik', 4),
  ('BNU-01-KHO-1', 'BNU-01', 'Bantu', 1, 'Khonghucu', 1),
  ('BNU-01-PRO-1', 'BNU-01', 'Bantu', 1, 'Protestan', 1),
  ('BNU-01-PRO-2', 'BNU-01', 'Bantu', 1, 'Protestan', 2),
  ('BNU-01-PRO-3', 'BNU-01', 'Bantu', 1, 'Protestan', 3),
  ('BNU-01-PRO-4', 'BNU-01', 'Bantu', 1, 'Protestan', 4),
  ('BNU-01-PRO-5', 'BNU-01', 'Bantu', 1, 'Protestan', 5),
  ('BNU-01-PRO-6', 'BNU-01', 'Bantu', 1, 'Protestan', 6),
  ('BNU-02', 'BNU-02', 'Bantu', 2, null, null),
  ('BNU-03', 'BNU-03', 'Bantu', 3, null, null),
  ('BNU-04', 'BNU-04', 'Bantu', 4, null, null),
  ('BNU-05', 'BNU-05', 'Bantu', 5, null, null),
  ('BNU-06', 'BNU-06', 'Bantu', 6, null, null),
  ('BNU-07', 'BNU-07', 'Bantu', 7, null, null),
  ('BNU-08', 'BNU-08', 'Bantu', 8, null, null),
  ('BNU-09', 'BNU-09', 'Bantu', 9, null, null),
  ('BNU-10', 'BNU-10', 'Bantu', 10, null, null),
  ('BNU-11', 'BNU-11', 'Bantu', 11, null, null),
  ('BNU-12', 'BNU-12', 'Bantu', 12, null, null),
  ('BNU-13', 'BNU-13', 'Bantu', 13, null, null),
  ('BNU-14', 'BNU-14', 'Bantu', 14, null, null),
  ('BNU-15', 'BNU-15', 'Bantu', 15, null, null),
  ('BNU-16', 'BNU-16', 'Bantu', 16, null, null),
  ('BNU-17', 'BNU-17', 'Bantu', 17, null, null),
  ('BNU-18', 'BNU-18', 'Bantu', 18, null, null),
  ('BNU-19', 'BNU-19', 'Bantu', 19, null, null),
  ('BNU-20', 'BNU-20', 'Bantu', 20, null, null),
  ('BNU-21', 'BNU-21', 'Bantu', 21, null, null),
  ('BNU-22', 'BNU-22', 'Bantu', 22, null, null),
  ('BNU-23', 'BNU-23', 'Bantu', 23, null, null),
  ('BNU-24', 'BNU-24', 'Bantu', 24, null, null),
  ('BNU-25', 'BNU-25', 'Bantu', 25, null, null),
  ('BNU-26', 'BNU-26', 'Bantu', 26, null, null),
  ('BNU-27', 'BNU-27', 'Bantu', 27, null, null),
  ('BNU-28', 'BNU-28', 'Bantu', 28, null, null),
  ('BNU-29', 'BNU-29', 'Bantu', 29, null, null),
  ('BNU-30', 'BNU-30', 'Bantu', 30, null, null),
  ('BNU-31', 'BNU-31', 'Bantu', 31, null, null),
  ('BNU-32', 'BNU-32', 'Bantu', 32, null, null),
  ('BNU-33', 'BNU-33', 'Bantu', 33, null, null),
  ('MUL-01-BUD-1', 'MUL-01', 'Mula', 1, 'Buddha', 1),
  ('MUL-01-BUD-2', 'MUL-01', 'Mula', 1, 'Buddha', 2),
  ('MUL-01-BUD-3', 'MUL-01', 'Mula', 1, 'Buddha', 3),
  ('MUL-01-HIN-1', 'MUL-01', 'Mula', 1, 'Hindu', 1),
  ('MUL-01-HIN-2', 'MUL-01', 'Mula', 1, 'Hindu', 2),
  ('MUL-01-HIN-3', 'MUL-01', 'Mula', 1, 'Hindu', 3),
  ('MUL-01-HIN-4', 'MUL-01', 'Mula', 1, 'Hindu', 4),
  ('MUL-01-HIN-5', 'MUL-01', 'Mula', 1, 'Hindu', 5),
  ('MUL-01-ISL-1', 'MUL-01', 'Mula', 1, 'Islam', 1),
  ('MUL-01-ISL-2', 'MUL-01', 'Mula', 1, 'Islam', 2),
  ('MUL-01-ISL-3', 'MUL-01', 'Mula', 1, 'Islam', 3),
  ('MUL-01-ISL-4', 'MUL-01', 'Mula', 1, 'Islam', 4),
  ('MUL-01-ISL-5', 'MUL-01', 'Mula', 1, 'Islam', 5),
  ('MUL-01-ISL-6', 'MUL-01', 'Mula', 1, 'Islam', 6),
  ('MUL-01-ISL-7', 'MUL-01', 'Mula', 1, 'Islam', 7),
  ('MUL-01-KAT-1', 'MUL-01', 'Mula', 1, 'Katolik', 1),
  ('MUL-01-KAT-2', 'MUL-01', 'Mula', 1, 'Katolik', 2),
  ('MUL-01-KAT-3', 'MUL-01', 'Mula', 1, 'Katolik', 3),
  ('MUL-01-KAT-4', 'MUL-01', 'Mula', 1, 'Katolik', 4),
  ('MUL-01-KAT-5', 'MUL-01', 'Mula', 1, 'Katolik', 5),
  ('MUL-01-KHO-1', 'MUL-01', 'Mula', 1, 'Khonghucu', 1),
  ('MUL-01-PRO-1', 'MUL-01', 'Mula', 1, 'Protestan', 1),
  ('MUL-01-PRO-2', 'MUL-01', 'Mula', 1, 'Protestan', 2),
  ('MUL-01-PRO-3', 'MUL-01', 'Mula', 1, 'Protestan', 3),
  ('MUL-01-PRO-4', 'MUL-01', 'Mula', 1, 'Protestan', 4),
  ('MUL-01-PRO-5', 'MUL-01', 'Mula', 1, 'Protestan', 5),
  ('MUL-02', 'MUL-02', 'Mula', 2, null, null),
  ('MUL-03', 'MUL-03', 'Mula', 3, null, null),
  ('MUL-04', 'MUL-04', 'Mula', 4, null, null),
  ('MUL-05', 'MUL-05', 'Mula', 5, null, null),
  ('MUL-06', 'MUL-06', 'Mula', 6, null, null),
  ('MUL-07', 'MUL-07', 'Mula', 7, null, null),
  ('MUL-08', 'MUL-08', 'Mula', 8, null, null),
  ('MUL-09', 'MUL-09', 'Mula', 9, null, null),
  ('MUL-10', 'MUL-10', 'Mula', 10, null, null),
  ('MUL-11', 'MUL-11', 'Mula', 11, null, null),
  ('MUL-12', 'MUL-12', 'Mula', 12, null, null),
  ('MUL-13', 'MUL-13', 'Mula', 13, null, null),
  ('MUL-14', 'MUL-14', 'Mula', 14, null, null),
  ('MUL-15', 'MUL-15', 'Mula', 15, null, null),
  ('MUL-16', 'MUL-16', 'Mula', 16, null, null),
  ('MUL-17', 'MUL-17', 'Mula', 17, null, null),
  ('MUL-18', 'MUL-18', 'Mula', 18, null, null),
  ('MUL-19', 'MUL-19', 'Mula', 19, null, null),
  ('MUL-20', 'MUL-20', 'Mula', 20, null, null),
  ('MUL-21', 'MUL-21', 'Mula', 21, null, null),
  ('MUL-22', 'MUL-22', 'Mula', 22, null, null),
  ('MUL-23', 'MUL-23', 'Mula', 23, null, null),
  ('MUL-24', 'MUL-24', 'Mula', 24, null, null),
  ('MUL-25', 'MUL-25', 'Mula', 25, null, null),
  ('MUL-26', 'MUL-26', 'Mula', 26, null, null),
  ('MUL-27', 'MUL-27', 'Mula', 27, null, null),
  ('MUL-28', 'MUL-28', 'Mula', 28, null, null),
  ('MUL-29', 'MUL-29', 'Mula', 29, null, null),
  ('MUL-30', 'MUL-30', 'Mula', 30, null, null),
  ('MUL-31', 'MUL-31', 'Mula', 31, null, null),
  ('MUL-32', 'MUL-32', 'Mula', 32, null, null),
  ('MUL-33', 'MUL-33', 'Mula', 33, null, null),
  ('MUL-34', 'MUL-34', 'Mula', 34, null, null),
  ('TAT-01-BUD-1', 'TAT-01', 'Tata', 1, 'Buddha', 1),
  ('TAT-01-BUD-2', 'TAT-01', 'Tata', 1, 'Buddha', 2),
  ('TAT-01-BUD-3', 'TAT-01', 'Tata', 1, 'Buddha', 3),
  ('TAT-01-HIN-1', 'TAT-01', 'Tata', 1, 'Hindu', 1),
  ('TAT-01-HIN-2', 'TAT-01', 'Tata', 1, 'Hindu', 2),
  ('TAT-01-HIN-3', 'TAT-01', 'Tata', 1, 'Hindu', 3),
  ('TAT-01-HIN-4', 'TAT-01', 'Tata', 1, 'Hindu', 4),
  ('TAT-01-HIN-5', 'TAT-01', 'Tata', 1, 'Hindu', 5),
  ('TAT-01-HIN-6', 'TAT-01', 'Tata', 1, 'Hindu', 6),
  ('TAT-01-HIN-7', 'TAT-01', 'Tata', 1, 'Hindu', 7),
  ('TAT-01-ISL-1', 'TAT-01', 'Tata', 1, 'Islam', 1),
  ('TAT-01-ISL-2', 'TAT-01', 'Tata', 1, 'Islam', 2),
  ('TAT-01-ISL-3', 'TAT-01', 'Tata', 1, 'Islam', 3),
  ('TAT-01-ISL-4', 'TAT-01', 'Tata', 1, 'Islam', 4),
  ('TAT-01-KAT-1', 'TAT-01', 'Tata', 1, 'Katolik', 1),
  ('TAT-01-KAT-2', 'TAT-01', 'Tata', 1, 'Katolik', 2),
  ('TAT-01-KAT-3', 'TAT-01', 'Tata', 1, 'Katolik', 3),
  ('TAT-01-KAT-4', 'TAT-01', 'Tata', 1, 'Katolik', 4),
  ('TAT-01-KAT-5', 'TAT-01', 'Tata', 1, 'Katolik', 5),
  ('TAT-01-KHO-1', 'TAT-01', 'Tata', 1, 'Khonghucu', 1),
  ('TAT-01-PRO-1', 'TAT-01', 'Tata', 1, 'Protestan', 1),
  ('TAT-01-PRO-2', 'TAT-01', 'Tata', 1, 'Protestan', 2),
  ('TAT-01-PRO-3', 'TAT-01', 'Tata', 1, 'Protestan', 3),
  ('TAT-01-PRO-4', 'TAT-01', 'Tata', 1, 'Protestan', 4),
  ('TAT-01-PRO-5', 'TAT-01', 'Tata', 1, 'Protestan', 5),
  ('TAT-02', 'TAT-02', 'Tata', 2, null, null),
  ('TAT-03', 'TAT-03', 'Tata', 3, null, null),
  ('TAT-04', 'TAT-04', 'Tata', 4, null, null),
  ('TAT-05', 'TAT-05', 'Tata', 5, null, null),
  ('TAT-06', 'TAT-06', 'Tata', 6, null, null),
  ('TAT-07', 'TAT-07', 'Tata', 7, null, null),
  ('TAT-08', 'TAT-08', 'Tata', 8, null, null),
  ('TAT-09', 'TAT-09', 'Tata', 9, null, null),
  ('TAT-10', 'TAT-10', 'Tata', 10, null, null),
  ('TAT-11', 'TAT-11', 'Tata', 11, null, null),
  ('TAT-12', 'TAT-12', 'Tata', 12, null, null),
  ('TAT-13', 'TAT-13', 'Tata', 13, null, null),
  ('TAT-14', 'TAT-14', 'Tata', 14, null, null),
  ('TAT-15', 'TAT-15', 'Tata', 15, null, null),
  ('TAT-16', 'TAT-16', 'Tata', 16, null, null),
  ('TAT-17', 'TAT-17', 'Tata', 17, null, null),
  ('TAT-18', 'TAT-18', 'Tata', 18, null, null),
  ('TAT-19', 'TAT-19', 'Tata', 19, null, null),
  ('TAT-20', 'TAT-20', 'Tata', 20, null, null),
  ('TAT-21', 'TAT-21', 'Tata', 21, null, null),
  ('TAT-22', 'TAT-22', 'Tata', 22, null, null),
  ('TAT-23', 'TAT-23', 'Tata', 23, null, null),
  ('TAT-24', 'TAT-24', 'Tata', 24, null, null),
  ('TAT-25', 'TAT-25', 'Tata', 25, null, null),
  ('TAT-26', 'TAT-26', 'Tata', 26, null, null),
  ('TAT-27', 'TAT-27', 'Tata', 27, null, null),
  ('TAT-28', 'TAT-28', 'Tata', 28, null, null),
  ('TAT-29', 'TAT-29', 'Tata', 29, null, null),
  ('TAT-30', 'TAT-30', 'Tata', 30, null, null),
  ('TAT-31', 'TAT-31', 'Tata', 31, null, null),
  ('TAT-32', 'TAT-32', 'Tata', 32, null, null),
  ('TAT-33', 'TAT-33', 'Tata', 33, null, null)
on conflict (id) do nothing;

-- ===== SKU Siaga (Pramuka Siaga, Fase 2): prasyarat tingkat =====
-- Tingkat yang harus selesai lebih dulu: Laksana menunggu Bantara; Bantu menunggu Mula; Tata menunggu Bantu (SK Kwarnas 119/2011). Bantara dan Mula tanpa prasyarat.
-- Dicerminkan src/lib/skuLogic.js (PRASYARAT_TINGKAT) dan dibandingkan langsung oleh uji/sku-siaga.mjs.
create or replace function sigarda.prasyarat_tingkat(p_tingkat text) returns text language sql immutable as
$$ select case p_tingkat when 'Laksana' then 'Bantara' when 'Bantu' then 'Mula' when 'Tata' then 'Bantu' end $$;
-- ===== akhir prasyarat tingkat =====

create or replace function public.sg_sku_ajukan(p_sku_id text, p_jadwal date, p_penguji_id uuid, p_catatan text default '')
returns void language plpgsql security definer set search_path = public as
$$
declare
  v_uid uuid := auth.uid(); v_p public.profiles; v_u public.sku_unit; v_status text;
begin
  perform sigarda.wajib_aktif();
  select * into v_p from public.profiles where id = v_uid;
  if not found or v_p.role <> 'peserta' then raise exception 'Hanya peserta yang dapat mengajukan pengujian.'; end if;
  select * into v_u from public.sku_unit where id = p_sku_id and (agama is null or agama = v_p.agama);
  if not found then raise exception 'Poin SKU tidak ditemukan.'; end if;

  select status into v_status from public.sku_progress where peserta_id = v_uid and sku_id = p_sku_id;
  if v_status = 'lulus' then raise exception 'Poin ini sudah lulus.'; end if;
  if v_status in ('diajukan','proses') then raise exception 'Poin ini sedang menunggu atau dalam pengujian.'; end if;
  if sigarda.prasyarat_tingkat(v_u.tingkat) is not null and not sigarda.tingkat_selesai(v_uid, sigarda.prasyarat_tingkat(v_u.tingkat)) then
    raise exception 'Selesaikan seluruh butir % lebih dulu.', sigarda.prasyarat_tingkat(v_u.tingkat);
  end if;
  if p_jadwal is null then raise exception 'Tanggal pengujian wajib diisi.'; end if;
  if char_length(coalesce(p_catatan, '')) > 500 then raise exception 'Catatan maksimal 500 karakter.'; end if;
  -- Sakelar pra-uji hidup: pengajuan lebih dulu melewati pra-uji Pinsa/Bina Damping (p_penguji_id diabaikan; uji resmi selalu ke antrian Pembina rombel).
  if sigarda.pra_uji_aktif() then
    perform sigarda.pra_uji_mulai(v_uid, p_sku_id, p_jadwal, p_catatan);
    return;
  end if;
  -- Ketat saat memilih penguji: hanya penguji yang sah (penugasan rombel, butir Laksana dan butir agama hanya Pembina, agama seagama).
  -- p_penguji_id kosong = antrian bersama rombel: penguji yang sah mana pun mengambilnya lewat "Mulai uji".
  if p_penguji_id is not null and not sigarda.bisa_menguji(p_penguji_id) then
    raise exception 'Pilih penguji terlebih dulu.';
  end if;
  if p_penguji_id is null then
    if not exists (select 1 from sigarda.penguji_sah(v_uid, p_sku_id)) then
      raise exception 'Belum ada penguji yang dapat menguji butir ini untuk rombel Anda. Hubungi Admin Gudep.';
    end if;
  elsif not sigarda.penguji_boleh(v_uid, p_penguji_id, p_sku_id) then
    if v_u.agama is not null then
      raise exception 'Butir agama hanya dapat diuji oleh Pembina yang seagama. Pilih penguji dari daftar.';
    elsif v_u.tingkat = 'Laksana' and not exists (select 1 from public.profiles where id = p_penguji_id and jabatan = 'Pembina') and not sigarda.ditugaskan(v_uid, p_penguji_id) then
      raise exception 'Butir Laksana hanya dapat diuji oleh Pembina atau penguji yang ditugaskan untuk Anda. Pilih penguji dari daftar.';
    else
      raise exception 'Penguji ini tidak bertugas pada rombel Anda. Pilih penguji dari daftar.';
    end if;
  end if;

  insert into public.sku_progress (peserta_id, sku_id, status, jadwal, penguji_id, catatan_peserta, diubah)
  values (v_uid, p_sku_id, 'diajukan', p_jadwal, p_penguji_id, btrim(coalesce(p_catatan, '')), now())
  on conflict (peserta_id, sku_id) do update
    set status = 'diajukan', jadwal = excluded.jadwal, penguji_id = excluded.penguji_id,
        catatan_peserta = excluded.catatan_peserta, diubah = now();
  insert into public.sku_riwayat (peserta_id, sku_id, teks, oleh)
  values (v_uid, p_sku_id, 'Mengajukan pengujian untuk ' || to_char(p_jadwal, 'YYYY-MM-DD') || case when p_penguji_id is null then ' (antrian rombel)' else '' end, v_uid);
end $$;

create or replace function public.sg_sku_catat_internal(
  p_oleh uuid, p_peserta_id uuid, p_sku_id text, p_hasil text,
  p_tanggal_uji date default null, p_nilai text default null, p_catatan text default ''
) returns void language plpgsql security definer set search_path = public as
$$
declare v_p public.profiles; v_kode text; v_cat text := btrim(coalesce(p_catatan, '')); v_lama public.sku_progress; v_ganti text := ''; v_luar text; v_pra text;
begin
  if not sigarda.bisa_menguji(p_oleh) then
    raise exception '%', case when sigarda.pra_uji_aktif() then 'Hanya Pembina yang dapat mencatat hasil uji resmi.' else 'Hanya Pembina atau Dewan Ambalan yang dapat mencatat hasil.' end;
  end if;
  if p_oleh = p_peserta_id then raise exception 'Anda tidak dapat menilai diri sendiri.'; end if;
  select * into v_p from public.profiles where id = p_peserta_id and role = 'peserta';
  if not found then raise exception 'Peserta tidak ditemukan.'; end if;
  if not exists (select 1 from public.sku_unit where id = p_sku_id and (agama is null or agama = v_p.agama)) then
    raise exception 'Poin SKU tidak ditemukan.';
  end if;
  -- Butir agama (sub-butir Butir 1) hanya dinilai Pembina yang seagama, dan butir Laksana hanya oleh Pembina atau penguji yang ditugaskan untuk Penegak
  -- itu, untuk semua hasil (mulai uji, lulus, perlu diulang, dikembalikan). Aturan ini sama dengan pemilihan penguji (sigarda.penguji_peran_ok).
  if not sigarda.penguji_peran_ok(p_peserta_id, p_oleh, p_sku_id) then
    if exists (select 1 from public.sku_unit where id = p_sku_id and agama is not null) then
      raise exception 'Butir agama hanya dapat dinilai oleh Pembina yang seagama dengan Penegak.';
    end if;
    raise exception 'Butir Laksana hanya dapat dinilai oleh Pembina atau penguji yang ditugaskan untuk Penegak ini.';
  end if;
  -- Lunak saat mencatat: penguji lain boleh menggantikan penguji tujuan, tetapi tercatat di riwayat.
  select * into v_lama from public.sku_progress where peserta_id = p_peserta_id and sku_id = p_sku_id;
  if found and v_lama.status in ('diajukan', 'proses') and v_lama.penguji_id is not null and v_lama.penguji_id <> p_oleh and p_hasil in ('proses', 'lulus', 'ulang') then
    v_ganti := ' (menggantikan ' || coalesce((select nama from public.profiles where id = v_lama.penguji_id), 'penguji lain') || ')';
  end if;
  -- Butir agama yang dinilai guru agama luar (Pembina tidak seagama, sah karena ada surat pengantar): riwayat menyebut guru dan nomor surat.
  if p_hasil in ('proses', 'lulus', 'ulang') and exists (select 1 from public.sku_unit where id = p_sku_id and agama is not null)
     and exists (select 1 from public.profiles b where b.role = 'penguji' and b.jabatan = 'Pembina' and b.agama is not null)
     and (select agama from public.profiles where id = p_oleh) is distinct from v_p.agama then
    select ' (dinilai guru agama ' || coalesce(d.payload -> 'guru' ->> 'nama', '-') || ', surat nomor ' || d.nomor || ')' into v_luar
    from public.dokumen_terbit d
    where d.jenis = 'surat_pengantar_agama' and d.peserta_id = p_peserta_id and d.dicabut_pada is null and d.payload -> 'butir' @> jsonb_build_array(p_sku_id)
    order by d.id desc limit 1;
    v_ganti := v_ganti || coalesce(v_luar, '');
  end if;
  if p_hasil not in ('proses','lulus','ulang','reset') then raise exception 'Hasil pengujian tidak dikenal.'; end if;
  -- Butir dengan instrumen ditetapkan hanya boleh dinilai lewat sg_sku_catat_rubrik_internal (yang menyalakan penanda ini)
  if p_hasil in ('lulus','ulang') and sigarda.instrumen_aktif(p_sku_id)
     and coalesce(current_setting('sigarda.via_rubrik', true), '') <> 'ya' then
    raise exception 'Butir ini dinilai dengan instrumen penilaian. Catat hasilnya lewat lembar penilaian.';
  end if;
  if p_hasil <> 'reset' and p_tanggal_uji is null then raise exception 'Tanggal uji wajib diisi.'; end if;
  select sigarda.prasyarat_tingkat(tingkat) into v_pra from public.sku_unit where id = p_sku_id;
  if p_hasil <> 'reset' and v_pra is not null and not sigarda.tingkat_selesai(p_peserta_id, v_pra) then
    raise exception 'Peserta belum menyelesaikan seluruh butir %.', v_pra;
  end if;
  if char_length(v_cat) > 1000 then raise exception 'Catatan maksimal 1000 karakter.'; end if;

  -- Pembina memulai atau menuntaskan butir yang masih menunggu pra-uji: pra-uji itu tidak diperlukan lagi.
  if p_hasil in ('proses', 'lulus', 'ulang') then
    update public.sku_pra_uji set status = 'dibatalkan', catatan = 'Dilanjutkan langsung oleh penguji resmi', diputuskan_pada = now()
      where peserta_id = p_peserta_id and sku_id = p_sku_id and status = 'menunggu';
  end if;

  if p_hasil = 'proses' then
    insert into public.sku_progress (peserta_id, sku_id, status, penguji_id, tanggal_uji)
    values (p_peserta_id, p_sku_id, 'proses', p_oleh, p_tanggal_uji)
    on conflict (peserta_id, sku_id) do update
      set status = 'proses', penguji_id = p_oleh, tanggal_uji = p_tanggal_uji, verifikasi = null, diverifikasi_pada = null, verifikasi_token = null, diubah = now();
    insert into public.sku_riwayat (peserta_id, sku_id, teks, oleh) values (p_peserta_id, p_sku_id, 'Pengujian dimulai' || v_ganti, p_oleh);

  elsif p_hasil = 'lulus' then
    if p_nilai is null then raise exception 'Pilih predikat penilaian.'; end if;
    if p_nilai not in ('Sangat baik','Baik','Cukup') then raise exception 'Predikat tidak dikenal.'; end if;
    v_kode := sigarda.kode_verifikasi(array[p_peserta_id::text, p_sku_id, p_oleh::text, p_tanggal_uji::text]);
    insert into public.sku_progress (peserta_id, sku_id, status, penguji_id, tanggal_uji, nilai, catatan, verifikasi, diverifikasi_pada, verifikasi_token)
    values (p_peserta_id, p_sku_id, 'lulus', p_oleh, p_tanggal_uji, p_nilai, v_cat, v_kode, now(), sigarda.token_acak())
    on conflict (peserta_id, sku_id) do update
      set status = 'lulus', penguji_id = p_oleh, tanggal_uji = p_tanggal_uji, nilai = p_nilai, catatan = v_cat,
          verifikasi = v_kode, diverifikasi_pada = now(), verifikasi_token = sigarda.token_acak(), diubah = now();
    insert into public.sku_riwayat (peserta_id, sku_id, teks, oleh)
    values (p_peserta_id, p_sku_id, 'Dinyatakan lulus (' || p_nilai || '), kode ' || v_kode || v_ganti, p_oleh);

  elsif p_hasil = 'ulang' then
    if v_cat = '' then raise exception 'Isi catatan agar peserta tahu bagian yang perlu diperbaiki.'; end if;
    insert into public.sku_progress (peserta_id, sku_id, status, penguji_id, tanggal_uji, nilai, catatan)
    values (p_peserta_id, p_sku_id, 'ulang', p_oleh, p_tanggal_uji, null, v_cat)
    on conflict (peserta_id, sku_id) do update
      set status = 'ulang', penguji_id = p_oleh, tanggal_uji = p_tanggal_uji, nilai = null, catatan = v_cat,
          verifikasi = null, diverifikasi_pada = null, verifikasi_token = null, diubah = now();
    insert into public.sku_riwayat (peserta_id, sku_id, teks, oleh) values (p_peserta_id, p_sku_id, 'Perlu diulang' || v_ganti, p_oleh);

  else -- reset
    if v_cat = '' then raise exception 'Isi alasan pembatalan status.'; end if;
    insert into public.sku_progress (peserta_id, sku_id, status)
    values (p_peserta_id, p_sku_id, 'belum')
    on conflict (peserta_id, sku_id) do update
      set status = 'belum', penguji_id = null, tanggal_uji = null, jadwal = null, nilai = null, catatan = '',
          catatan_peserta = '', verifikasi = null, diverifikasi_pada = null, verifikasi_token = null, diubah = now();
    insert into public.sku_riwayat (peserta_id, sku_id, teks, oleh)
    values (p_peserta_id, p_sku_id, 'Status dikembalikan ke belum diuji. Alasan: ' || v_cat, p_oleh);
  end if;
end $$;

create or replace function sigarda.tolak_peserta_tak_aktif() returns trigger language plpgsql security definer set search_path = public as
$$
declare v_status text; v_nama text; v_agama text; v_tanpa_akun boolean;
begin
  if TG_OP = 'UPDATE' and pg_trigger_depth() > 1 then return new; end if;
  select status, nama, agama, tanpa_akun into v_status, v_nama, v_agama, v_tanpa_akun from public.profiles where id = new.peserta_id;
  if v_status is not null and v_status <> 'aktif' then
    if new.peserta_id = auth.uid() then
      raise exception 'Akun Anda berstatus % dan hanya dapat dilihat. Hubungi Pembina atau Admin Gudep bila ingin aktif kembali.', v_status;
    end if;
    raise exception '% berstatus % dan tidak dapat diubah. Aktifkan kembali lebih dulu di menu Anggota.', v_nama, v_status;
  end if;
  -- Agama Penegak baru diisi sendiri sesudah akun dibuat (Tahap 3, H1). Tanpa agama, butir agama tidak tampak baginya sehingga progres SKU-nya tidak lengkap: penulisan progres SKU ditolak sampai agama diisi.
  if v_status = 'aktif' and v_agama is null and TG_TABLE_NAME in ('sku_progress', 'sku_riwayat', 'sku_pra_uji', 'sesi_ujian_peserta') then
    if v_tanpa_akun then
      raise exception '% belum dicatat agamanya. Isi agamanya di menu Anggota Siaga (ubah data anak) sebelum mencatat SKU.', v_nama;
    end if;
    if new.peserta_id = auth.uid() then
      raise exception 'Isi agama Anda lebih dulu di menu Akun saya (Data diri) sebelum mengajukan SKU.';
    end if;
    raise exception '% belum mengisi agama. Penegak melengkapinya di menu Akun saya (Data diri), atau Admin Gudep mengisinya di menu Anggota.', v_nama;
  end if;
  return new;
end $$;

create or replace function sigarda.eskalasi_proses() returns void language plpgsql security definer set search_path = public as
$$
declare v_hari date := sigarda.hari_ini(); r record; v_mulai date; v_elapsed int; v_tingkat int; v_x uuid;
begin
  -- Anak Siaga tanpa akun (tanpa_akun) tidak diingatkan dan tidak masuk Tindak Lanjut: tangga ini dirancang untuk Penegak yang dapat dihubungi sendiri.
  for r in select id, nama from public.profiles where role = 'peserta' and status = 'aktif' and not tanpa_akun loop
    declare v_jenis text; v_fn text[] := array['sku','absensi','iuran'];
    begin
      foreach v_jenis in array v_fn loop
        v_mulai := case v_jenis
          when 'sku' then sigarda.eskalasi_mulai_sku(r.id)
          when 'absensi' then sigarda.eskalasi_mulai_absensi(r.id)
          else sigarda.eskalasi_mulai_iuran(r.id)
        end;
        continue when v_mulai is null;
        v_elapsed := v_hari - v_mulai;
        v_tingkat := sigarda.eskalasi_tingkat(v_elapsed);
        perform sigarda.notif_buat(r.id, 'eskalasi', sigarda.eskalasi_judul(v_jenis, v_tingkat), sigarda.eskalasi_isi(v_jenis, v_tingkat, v_mulai),
          jsonb_build_object('tab', sigarda.eskalasi_tab(v_jenis)), 'eskalasi:' || v_jenis || ':' || r.id || ':' || v_hari);
        if v_tingkat = 3 then
          for v_x in select id from public.profiles where status = 'aktif' and (role in ('penguji','admin') or (role = 'peserta' and jabatan_dewan is not null)) loop
            perform sigarda.notif_buat(v_x, 'eskalasi', 'Perlu tindak lanjut: ' || r.nama, sigarda.eskalasi_isi(v_jenis, v_tingkat, v_mulai),
              '{"tab":"tindaklanjut"}', 'eskalasi-p:' || v_jenis || ':' || r.id || ':' || v_hari);
          end loop;
        end if;
      end loop;
    end;
  end loop;
end $$;

create or replace function public.sg_eskalasi_daftar() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_hari date := sigarda.hari_ini(); v_hasil jsonb := '[]'::jsonb; r record; v_mulai date; v_elapsed int; v_jenis text;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pengurus() then raise exception 'Hanya Pembina, Dewan Ambalan, dan Admin Gudep yang dapat melihat daftar ini.'; end if;
  for r in select id, nama, kelas, sangga, whatsapp from public.profiles where role = 'peserta' and status = 'aktif' and not tanpa_akun loop
    foreach v_jenis in array array['sku','absensi','iuran'] loop
      v_mulai := case v_jenis
        when 'sku' then sigarda.eskalasi_mulai_sku(r.id)
        when 'absensi' then sigarda.eskalasi_mulai_absensi(r.id)
        else sigarda.eskalasi_mulai_iuran(r.id)
      end;
      continue when v_mulai is null;
      v_elapsed := v_hari - v_mulai;
      continue when sigarda.eskalasi_tingkat(v_elapsed) < 3;
      v_hasil := v_hasil || jsonb_build_object(
        'pesertaId', r.id, 'nama', r.nama, 'kelas', r.kelas, 'sangga', r.sangga, 'whatsapp', r.whatsapp,
        'jenis', v_jenis, 'mulai', v_mulai, 'hari', v_elapsed
      );
    end loop;
  end loop;
  return v_hasil;
end $$;


-- Fungsi sigarda.* baru: hak dijalankan ulang di sini (grant "all functions in schema" tidak retroaktif untuk fungsi baru).
revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
