-- ============================================================================
-- DATA DEMO PENEGAK (versi 2, sesuai fitur terbaru): 57 Penegak fiktif dengan variasi data yang mencakup hampir semua skenario
-- pengujian aplikasi: tingkat SKU, butir agama, pra-uji berjenjang, sangga/Pinsa/Bina Damping, Dewan Ambalan, pelantikan, Saka, TKK
-- (pengajuan dan Krida), SPG, calon Garuda, data diri dan tanggal lahir, status nonaktif/alumni, kelas format lama, absensi, iuran,
-- raport, notifikasi, dan sebagainya. Peta lengkap kondisi tiap akun tampil di hasil PALING AKHIR skrip ini (dan di README.md).
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run. Jalankan SESUDAH semua migrasi.
-- Aman dijalankan berulang: akun demo yang sudah ada dipakai lagi dan SELURUH data demonya dikembalikan ke keadaan awal.
-- Hanya menyentuh akun demo (NIS 990001 sampai 990057, nama berawalan "Demo "). Anggota asli, pengaturan, agenda, tim penilai, kalender
-- Garuda, penugasan rombel, sesi ujian, dan data gugus depan lain TIDAK diubah atau ditambah. Menghapusnya: hapus_data_demo.sql.
--
-- MASUK sebagai akun demo:   nama pengguna = NIS (mis. 990002)   PIN = 352817  (langsung bisa dipakai, tanpa layar wajib ganti PIN)
-- PENGECUALIAN: 7 akun Penegak berjabatan Dewan Ambalan (990029, 990032, 990033, 990039 sampai 990042) mendapat PIN ACAK yang
-- ditampilkan di hasil paling akhir setiap skrip dijalankan (repositori ini publik, dan Dewan berjabatan dapat membaca data anggota lain).
--
-- YANG PERLU DIPAHAMI SEBELUM MENJALANKAN
-- 1. Akun demo tampil pada daftar anggota, rekap, antrian, dan halaman pengurus selama masih ada. Hapus sesudah selesai menguji.
--    Jangan dibiarkan pada sistem yang sudah dipakai anggota sungguhan.
-- 2. Rombel demo = X-10, XI-10, XII-10 (ubah di tabel demo_param di bawah bila rombel itu dipakai anggota asli). Bina Damping, Pinsa,
--    dan sangga demo (nama berawalan "Demo ") hanya berlaku di rombel itu; bila ada Penegak asli di rombel yang sama, pra-uji
--    mereka ikut melewati Bina Damping demo. JANGAN menghidupkan sakelar Pra-uji untuk anggota asli selama data demo ada di sana.
-- 3. Pemicu notifikasi dan pemicu penjaga (sigarda.notif_*, tolak_peserta_tak_aktif, dan sejenisnya) DIMATIKAN hanya pada tabel yang
--    ditulis skrip ini, di dalam satu transaksi, lalu dinyalakan kembali sebelum selesai (bila gagal di tengah, semuanya dibatalkan).
--    Akibatnya tidak ada notifikasi atau push yang terkirim ke Pembina/Dewan/Admin asli saat skrip berjalan, dan semua notifikasi yang
--    dibuat skrip ini hanya untuk akun demo. Penguji pada data demo adalah Pembina asli yang ada (bergantian); tanpa Pembina, kosong.
-- 4. Pengingat harian (pukul 07.00 WIB) tetap berjalan atas data demo: pengajuan uji yang menunggu lebih dari 3 hari, pengujian esok
--    hari, dan Penegak yang "tidak bergerak" (tangga eskalasi) akan memberi tahu Pembina/pengurus ASLI. Untuk memperkecilnya, hampir
--    semua akun demo diberi aktivitas terkini dan jadwal jauh ke depan; tiga akun sengaja "tidak bergerak" (990009, 990012, 990020) dan
--    dua akun sengaja tidak hadir/tidak iuran (990020, 990022) untuk menguji tangga eskalasi dan menu Tindak Lanjut. Bila TIDAK ingin
--    ada pemberitahuan ke pengurus asli, ubah eskalasi_contoh menjadi false di tabel demo_param di bawah.
-- 5. Absensi dan iuran demo HANYA memakai sesi latihan Jumat yang SUDAH ADA (paling banyak 8 terakhir); skrip ini tidak membuat sesi
--    baru, jadi tanpa sesi latihan tidak ada data kehadiran/iuran demo.
-- 6. Yang TIDAK dibuat (dibuat sendiri lewat menu bila perlu diuji): akun Pembina/Admin demo (akan mengubah siapa yang sah menguji
--    Penegak asli), agenda dan usulan kegiatan, Tim Penilai dan kalender Garuda, penugasan penguji per rombel, sesi ujian bersama,
--    surat pengantar agama, sidang dan Surat Tanda Lulus baru, salinan beku portofolio, tautan berbagi berkas Garuda, catatan
--    Safe From Harm, instrumen penilaian.
--
-- Bila pembuatan akun (bagian 3) gagal di proyek Anda: buat 57 akun itu lewat Anggota > Import Excel (NIS 990001-990057, PIN awal bebas),
-- lalu jalankan berkas ini lagi. Akun yang sudah ada dipakai; datanya tetap diisi.
-- ============================================================================
begin;

-- Pemeriksaan: pgcrypto dibutuhkan untuk membuat hash PIN.
do $$
begin
  if to_regprocedure('crypt(text,text)') is null then
    raise exception 'Fungsi crypt() tidak ditemukan. Jalankan dulu: create extension if not exists pgcrypto with schema extensions;';
  end if;
end $$;

-- Tabel sementara yang ikut tampil di hasil akhir dibuang dulu (tanpa "on commit drop" agar tetap ada sesudah commit).
drop table if exists demo_penegak, demo_pin;

-- ---------------------------------------------------------------------------
-- 1. Parameter
-- ---------------------------------------------------------------------------
create temp table demo_param on commit drop as
  select 'X-10'::text as r_x, 'XI-10'::text as r_xi, 'XII-10'::text as r_xii,     -- rombel demo (harus rombel baku)
         '352817'::text as pin_biasa,                                              -- PIN akun demo biasa
         true as eskalasi_contoh,                                                  -- true = ada akun "tidak bergerak" (memicu pengingat eskalasi)
         sigarda.hari_ini() as hari,
         sigarda.tahun_ajaran_kini() as ta,
         (split_part(sigarda.tahun_ajaran_kini(), '/', 1)::int - 1) || '/' || split_part(sigarda.tahun_ajaran_kini(), '/', 1) as ta_lalu;

-- ---------------------------------------------------------------------------
-- 2. Daftar akun dan kondisinya.
--    rb: x | xi | xii = rombel demo; lama-x | lama-xi = kelas format lama ("X"/"XI") yang belum dirapikan.
--    ban/lak: butir Bantara/Laksana 1..n lulus; kecuali: satu unit yang sengaja TIDAK lulus; mundur: seluruh tanggal digeser ke belakang.
-- ---------------------------------------------------------------------------
create temp table demo_penegak (
  nis text primary key, nama text not null, rb text not null, sangga text, agama text, jk text,
  status text not null default 'aktif', lulus_ta text,
  jab text, pinsa boolean not null default false,
  ban int not null default 0, lak int not null default 0, kecuali text, mundur int not null default 0,
  lahir date, wa boolean, nta boolean not null default false, diri text, masuk boolean not null default true,
  lantik text not null default '', ket text not null default ''
);

insert into demo_penegak (nis, nama, rb, sangga, agama, jk, ban, lak, ket) values
  -- Rombel X-10: calon Bantara (5 sangga + Penegak tanpa sangga)
  ('990001', 'Demo Aditya Pratama',  'x', 'Demo Elang',        'Islam',     'L', 23, 0,  'Bantara 23/23 lulus, belum dilantik; Pinsa sangga Elang'),
  ('990009', 'Demo Rani Oktaviani',  'x', 'Demo Elang',        'Islam',     'P', 5,  0,  'Calon Bantara; SKU "tidak bergerak" tingkat 1 (eskalasi)'),
  ('990010', 'Demo Bagas Prakoso',   'x', 'Demo Elang',        'Islam',     'L', 0,  0,  'Baru mulai tanpa progres; belum pernah masuk; data diri dan tanggal lahir kosong'),
  ('990011', 'Demo Salsabila Nur',   'x', 'Demo Elang',        'Islam',     'P', 17, 0,  'Pra-uji tahap Pinsa menunggu (butir 18)'),
  ('990012', 'Demo Yusuf Hidayat',   'x', 'Demo Elang',        'Islam',     'L', 9,  0,  'SKU "tidak bergerak" tingkat 2 (eskalasi)'),
  ('990013', 'Demo Mega Wulandari',  'x', 'Demo Elang',        'Katolik',   'P', 12, 0,  'Butir agama Katolik kurang satu sub-butir, diajukan langsung ke antrian Pembina (tak ada penilai pra-uji seagama)'),
  ('990057', 'Demo Tegar Wibowo',    'x', 'Demo Elang',        'Islam',     null, 6, 0,  'Jenis kelamin dan tanggal lahir kosong; belum pernah masuk; data diri sebagian'),
  ('990004', 'Demo Dimas Saputra',   'x', 'Demo Merak',        'Protestan', 'L', 14, 0,  'Butir 15 menunggu uji (antrian), 16 sedang diuji, 17 perlu diulang; penugasan khusus ke satu Pembina'),
  ('990014', 'Demo Nadia Safitri',   'x', 'Demo Merak',        'Islam',     'P', 21, 0,  'Pra-uji: lulus Pinsa, tahap Bina Damping menunggu (butir 22)'),
  ('990015', 'Demo Rizal Ramadhan',  'x', 'Demo Merak',        'Islam',     'L', 8,  0,  'Pra-uji: tahap Pinsa dilewati Pembina, Bina Damping menunggu (butir 9)'),
  ('990016', 'Demo Anisa Rahma',     'x', 'Demo Merak',        'Islam',     'P', 3,  0,  'Pra-uji: lulus Pinsa, belum lulus Bina Damping dengan catatan (butir 4)'),
  ('990017', 'Demo Farhan Maulana',  'x', 'Demo Merak',        'Islam',     'L', 19, 0,  'Pra-uji lulus semua tahap, butir 20 menunggu uji resmi Pembina'),
  ('990018', 'Demo Kevin Sanjaya',   'x', 'Demo Rajawali',     'Protestan', 'L', 11, 0,  'Calon Bantara; sangga tanpa Pinsa'),
  ('990019', 'Demo Tiara Anggraini', 'x', 'Demo Rajawali',     'Islam',     'P', 6,  0,  'Sangga tanpa Pinsa: pra-uji langsung ke Bina Damping (butir 7)'),
  ('990020', 'Demo Galih Permadi',   'x', 'Demo Rajawali',     'Islam',     'L', 2,  0,  'SKU "tidak bergerak" tingkat 3, dua kali Alpa berturut-turut (eskalasi, muncul di Tindak Lanjut)'),
  ('990021', 'Demo Wulan Sari',      'x', 'Demo Rajawali',     'Islam',     'P', 13, 0,  'Pra-uji Bina Damping macet lebih dari 3 hari (butir 14)'),
  ('990022', 'Demo Bayu Aji',        'x', 'Demo Rajawali',     'Hindu',     'L', 10, 0,  'Agama Hindu; dua kali berturut-turut tidak ada iuran (eskalasi)'),
  ('990007', 'Demo Gita Permata',    'x', 'Demo Kasuari',      'Khonghucu', 'P', 23, 0,  'Bantara 23/23 (butir agama Khonghucu pengganti); Pinsa sangga Kasuari'),
  ('990008', 'Demo Hendra Wijaya',   'x', 'Demo Kasuari',      'Islam',     'L', 3,  0,  'Baru mulai: 3 butir lulus, butir 4 menunggu uji'),
  ('990023', 'Demo Putri Ayu',       'x', 'Demo Kasuari',      'Islam',     'P', 10, 0,  'Pra-uji: belum lulus tahap Pinsa dengan catatan (butir 11)'),
  ('990024', 'Demo Ilham Kurniawan', 'x', 'Demo Kasuari',      'Islam',     'L', 7,  0,  'Pra-uji tahap Pinsa dibatalkan Penegak (butir 8)'),
  ('990025', 'Demo Dinda Kirana',    'x', 'Demo Cendrawasih',  'Buddha',    'P', 4,  0,  'Sangga kecil (2 anggota); agama Buddha'),
  ('990026', 'Demo Reza Firmansyah', 'x', 'Demo Cendrawasih',  'Islam',     'L', 15, 0,  'Sangga kecil (2 anggota); Pinsa sangga ini dua orang tertugas dari XI-10'),
  ('990027', 'Demo Laras Ayu',       'x', null,                'Islam',     'P', 1,  0,  'Belum punya sangga'),
  ('990028', 'Demo Wahyu Nugraha',   'x', null,                'Islam',     'L', 0,  0,  'Belum punya sangga, tanpa progres; belum pernah masuk; data diri kosong'),
  ('990056', 'Demo Sinta Bella',     'x', null,                null,        null, 0, 0,  'Akun baru hasil import: agama, jenis kelamin, sangga, WhatsApp, data diri kosong; SKU terkunci sampai agama diisi'),
  ('990052', 'Demo Oktavia Rahma',   'x', 'Demo Elang',        'Islam',     'P', 4,  0,  'NONAKTIF (tidak melanjutkan Pramuka); hanya dapat dilihat'),
  -- Rombel XI-10: Bantara sampai Laksana, sebagian Dewan dan Pinsa
  ('990002', 'Demo Bintang Kusuma',  'xi', 'Demo Garuda',      'Islam',     'L', 23, 22, 'Bantara dan Laksana lulus, baru dilantik Laksana; layak Garuda tapi belum mendaftar; Pinsa sangga Garuda'),
  ('990032', 'Demo Doni Saputra',    'xi', 'Demo Garuda',      'Islam',     'L', 23, 15, 'Dewan (Bendahara); Calon Laksana; pra-uji Bina Damping lulus (Laksana butir 16)'),
  ('990033', 'Demo Fitri Handayani', 'xi', 'Demo Garuda',      'Islam',     'P', 18, 0,  'Dewan (Anggota Dewan) yang masih Calon Bantara: belum layak jadi Bina Damping'),
  ('990034', 'Demo Rafi Ahmad',      'xi', 'Demo Garuda',      'Islam',     'L', 12, 0,  'Calon Bantara'),
  ('990003', 'Demo Citra Lestari',   'xi', 'Demo Jalak',       'Katolik',   'P', 23, 11, 'Calon Laksana; Pinsa tertugas sangga Merak (X-10); pra-uji Bina Damping Laksana menunggu (butir 12)'),
  ('990029', 'Demo Sekar Melati',    'xi', 'Demo Jalak',       'Islam',     'P', 23, 6,  'Dewan (Sekretaris); Calon Laksana; Bina Damping XII-10 (satu-satunya, peringatan kurang dari 2); Pinsa sangga Jalak'),
  ('990035', 'Demo Aulia Rahmawati', 'xi', 'Demo Jalak',       'Islam',     'P', 20, 0,  'Butir 21 sedang diuji'),
  ('990036', 'Demo Dafa Alfarizi',   'xi', 'Demo Jalak',       'Islam',     'L', 5,  0,  'Pra-uji tahap Pinsa menunggu (butir 6)'),
  ('990030', 'Demo Arif Budiman',    'xi', 'Demo Kenari',      'Islam',     'L', 23, 0,  'Calon Laksana; Pinsa tertugas sangga Cendrawasih (X-10)'),
  ('990031', 'Demo Intan Permata',   'xi', 'Demo Kenari',      'Protestan', 'P', 23, 2,  'Calon Laksana; Pinsa tertugas sangga Cendrawasih (X-10); asisten bendahara iuran'),
  ('990037', 'Demo Jesika Widya',    'xi', 'Demo Kenari',      'Buddha',    'P', 23, 0,  'Bantara 23/23 (agama Buddha), belum dilantik'),
  ('990038', 'Demo Komang Suarta',   'xi', 'Demo Kenari',      'Hindu',     'L', 21, 0,  'Agama Hindu; sangga tanpa Pinsa'),
  ('990051', 'Demo Naufal Rasyid',   'xi', 'Demo Garuda',      'Islam',     'L', 12, 0,  'NONAKTIF dengan progres SKU'),
  -- Rombel XII-10: Laksana, Dewan berjabatan, calon Garuda
  ('990005', 'Demo Eka Wulandari',   'xii', 'Demo Alap',       'Hindu',     'P', 23, 0,  'Bantara 22/23: butir agama Hindu kurang satu sub-butir (uji blokir "Layak")'),
  ('990006', 'Demo Fajar Nugroho',   'xii', 'Demo Alap',       'Buddha',    'L', 23, 22, 'CALON GARUDA lengkap: Bantara+Laksana, dilantik, TKK memenuhi ambang, SPG hampir lengkap, portofolio sebagian'),
  ('990039', 'Demo Kartika Sari',    'xii', 'Demo Alap',       'Islam',     'P', 23, 22, 'Dewan (Pradani); CALON GARUDA putri: portofolio 26 dokumen siap, TKK kurang satu dari ambang, SPG sebagian; Bina Damping X-10'),
  ('990040', 'Demo Mahesa Wardana',  'xii', 'Demo Bangau',     'Islam',     'L', 23, 22, 'Dewan (Pradana); Laksana belum mendaftar; lahir terlalu tua untuk gerbang usia; Bina Damping XI-10'),
  ('990041', 'Demo Ratna Dewi',      'xii', 'Demo Bangau',     'Islam',     'P', 23, 22, 'Dewan (Pemangku Adat, ketua sidang); Laksana; NTA kosong; Bina Damping X-10; dua Saka'),
  ('990042', 'Demo Satria Bima',     'xii', 'Demo Bangau',     'Islam',     'L', 23, 22, 'Dewan (Koordinator Bidang Kesenian); Laksana selesai, belum dilantik Laksana; Bina Damping XI-10'),
  ('990043', 'Demo Ayu Lestari',     'xii', 'Demo Gagak',      'Islam',     'P', 23, 9,  'Calon Laksana; Laksana butir 10 menunggu uji (antrian)'),
  ('990044', 'Demo Krisna Adi',      'xii', 'Demo Gagak',      'Protestan', 'L', 16, 0,  'Calon Bantara di kelas XII'),
  ('990045', 'Demo Vina Amalia',     'xii', 'Demo Gagak',      'Islam',     'P', 23, 22, 'Laksana selesai tanpa pelantikan dan tanpa TKK; lahir terlalu muda untuk gerbang usia'),
  ('990046', 'Demo Hanif Alfarizi',  'xii', 'Demo Pipit',      'Islam',     'L', 21, 0,  'Calon Bantara, hampir selesai'),
  ('990047', 'Demo Zahra Nabila',    'xii', 'Demo Pipit',      'Islam',     'P', 10, 0,  'Calon Bantara'),
  ('990048', 'Demo Yoga Pratama',    'xii', 'Demo Pipit',      'Katolik',   'L', 23, 4,  'Calon Laksana; Laksana butir 5 perlu diulang; penugasan khusus ke satu Pembina'),
  ('990053', 'Demo Prasetyo Utomo',  'xii', 'Demo Alap',       'Islam',     'L', 23, 22, 'ALUMNI 2025/2026: Bantara+Laksana, TKK penuh, raport final'),
  ('990054', 'Demo Qonita Zahra',    'xii', 'Demo Bangau',     'Islam',     'P', 23, 22, 'ALUMNI 2025/2026 sudah calon Garuda: SPG lengkap, portofolio 26 dokumen siap'),
  ('990055', 'Demo Rendra Mahardika','xii', 'Demo Gagak',      'Protestan', 'L', 23, 10, 'ALUMNI 2025/2026 yang tidak menyelesaikan Laksana'),
  -- Kelas format lama (belum dirapikan lewat "Perbarui rombel")
  ('990049', 'Demo Lukman Hakim',    'lama-xi', 'Demo Jalak',  'Islam',     'L', 6,  0,  'Kelas format lama "XI" (muncul di Pemeriksaan Data)'),
  ('990050', 'Demo Melati Puspita',  'lama-x',  'Demo Rajawali', 'Islam',   'P', 2,  0,  'Kelas format lama "X" (muncul di Pemeriksaan Data)');

-- Nilai bawaan yang bervariasi menurut NIS (kemudian ditimpa di bawah untuk akun yang perlu skenario tertentu)
update demo_penegak set
  wa   = (nis::int % 4 <> 0),
  nta  = (lak >= 22 or (ban = 23 and nis::int % 3 = 0)),
  diri = (array['kosong', 'sebagian', 'pokok', 'pokok', 'penuh'])[1 + nis::int % 5],
  lahir = case when rb in ('x', 'lama-x') then date '2010-01-10' + (nis::int * 7 % 330)
               when rb in ('xi', 'lama-xi') then date '2009-01-20' + (nis::int * 7 % 300)
               else date '2008-01-05' + (nis::int * 7 % 330) end;

update demo_penegak set status = 'nonaktif', mundur = 60 where nis in ('990051', '990052');
update demo_penegak set status = 'alumni', lulus_ta = '2025/2026', mundur = 330 where nis in ('990053', '990055');
update demo_penegak set status = 'alumni', lulus_ta = '2025/2026', mundur = 360 where nis = '990054';
update demo_penegak set mundur = 200 where nis = '990006';
update demo_penegak set mundur = 130 where nis = '990039';
update demo_penegak set mundur = 40  where nis = '990040';
update demo_penegak set mundur = 20  where nis = '990041';
update demo_penegak set mundur = 10  where nis = '990042';
update demo_penegak set kecuali = 'BAN-01-HIN-7' where nis = '990005';
update demo_penegak set kecuali = 'BAN-01-KAT-2' where nis = '990013';
-- Tiga akun "tidak bergerak" (eskalasi SKU): tanggal digeser supaya aktivitas terakhirnya 7, 12, dan 18 hari lalu
update demo_penegak set mundur = 4  where nis = '990009';
update demo_penegak set mundur = 9  where nis = '990012';
update demo_penegak set mundur = 15 where nis = '990020';

-- Dewan Ambalan dan Pinsa
update demo_penegak set jab = v.jab from (values
  ('990029', 'Sekretaris'), ('990032', 'Bendahara'), ('990033', 'Anggota Dewan'), ('990039', 'Pradani'), ('990040', 'Pradana'),
  ('990041', 'Pemangku Adat'), ('990042', 'Koordinator Bidang Kesenian')) as v (nis, jab) where demo_penegak.nis = v.nis;
update demo_penegak set pinsa = true where nis in ('990001', '990007', '990002', '990029');

-- Pelantikan: 'b' = hanya Bantara, 'bl' = Bantara dan Laksana (akun Bantara selesai yang tidak tercantum belum dilantik)
update demo_penegak set lantik = 'b'  where nis in ('990003', '990029', '990030', '990031', '990032', '990043', '990048', '990042', '990055');
update demo_penegak set lantik = 'bl' where nis in ('990002', '990006', '990039', '990040', '990041', '990053', '990054');

-- Kelengkapan data diri, tanggal lahir, NTA, dan WhatsApp untuk skenario tertentu
update demo_penegak set diri = 'penuh' where nis in ('990002', '990006', '990039', '990040', '990053', '990054');
update demo_penegak set diri = 'kosong' where nis in ('990010', '990028', '990056');
update demo_penegak set diri = 'sebagian' where nis in ('990057', '990013');
update demo_penegak set wa = true where diri in ('pokok', 'penuh') and jk is not null;
update demo_penegak set wa = false where nis in ('990056', '990010', '990028');
update demo_penegak set lahir = v.lahir from (values
  ('990006', date '2008-03-12'), ('990039', date '2008-11-02'), ('990002', date '2009-02-20'), ('990054', date '2007-12-15'),
  ('990040', date '2006-09-01'),    -- terlalu tua untuk gerbang usia calon Garuda
  ('990045', date '2009-10-05')     -- terlalu muda
) as v (nis, lahir) where demo_penegak.nis = v.nis;
update demo_penegak set lahir = null where nis in ('990010', '990028', '990056', '990057', '990022', '990033');
update demo_penegak set nta = false where nis in ('990041', '990039');
update demo_penegak set masuk = false where nis in ('990010', '990028', '990056', '990057');

-- PIN: akun biasa memakai PIN demo; akun berjabatan Dewan mendapat PIN ACAK 6 angka (ditampilkan di hasil akhir)
create temp table demo_pin as
  select d.nis, case when d.jab is not null then lpad((100000 + floor(random() * 900000))::int::text, 6, '0') else p.pin_biasa end as pin, (d.jab is not null) as acak
  from demo_penegak d cross join demo_param p;

-- ---------------------------------------------------------------------------
-- 3. Akun (Supabase Auth). Yang sudah ada (akun atau profil) dipakai lagi; PIN diatur ulang.
-- ---------------------------------------------------------------------------
create temp table demo_konfig on commit drop as
  select coalesce(
           (select split_part(u.email, '@', 2) from auth.users u join public.profiles p on p.id = u.id where p.role = 'admin' order by u.created_at limit 1),
           'sigarda.invalid') as domain;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       d.nis || '@' || k.domain, crypt(x.pin, gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
       '', '', '', ''
from demo_penegak d cross join demo_konfig k join demo_pin x on x.nis = d.nis
where not exists (select 1 from auth.users u where u.email = d.nis || '@' || k.domain)
  and not exists (select 1 from public.profiles p where p.username = d.nis and p.role = 'peserta');

-- Kunci pemetaan akun: profil yang sudah ada (mis. dibuat lewat Import Excel), atau akun Auth berdasarkan email
create temp table demo_id on commit drop as
  select coalesce(p.id, u.id) as id, d.*, x.pin, k.domain, pr.hari, pr.ta, pr.ta_lalu,
         case d.rb when 'x' then pr.r_x when 'xi' then pr.r_xi when 'xii' then pr.r_xii when 'lama-x' then 'X' else 'XI' end as kelas,
         -- tanggal akhir butir Bantara dan Laksana yang lulus (alur waktu: Bantara dulu, lalu Laksana)
         pr.hari - d.mundur - case when d.lak > 0 then d.lak * 4 + 6 else 3 end as b_akhir,
         pr.hari - d.mundur - 2 as l_akhir
  from demo_penegak d
  cross join demo_konfig k cross join demo_param pr
  join demo_pin x on x.nis = d.nis
  left join public.profiles p on p.username = d.nis and p.role = 'peserta'
  left join auth.users u on u.email = d.nis || '@' || k.domain;

do $$
begin
  if exists (select 1 from demo_id where id is null) then
    raise exception 'Sebagian akun demo tidak dapat dibuat di auth.users. Buat lewat Anggota > Import Excel (NIS 990001-990057) lalu jalankan berkas ini lagi.';
  end if;
end $$;

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       'email', u.id::text, null, now(), now()
from demo_id d join auth.users u on u.id = d.id
where not exists (select 1 from auth.identities i where i.user_id = u.id);

-- PIN diatur ulang setiap eksekusi; "terakhir masuk" mengikuti skenario (belum pernah masuk = kosong)
update auth.users u set encrypted_password = crypt(d.pin, gen_salt('bf')),
       last_sign_in_at = case when d.masuk then now() - ((d.nis::int % 9) || ' days')::interval else null end
  from demo_id d where u.id = d.id;

-- ---------------------------------------------------------------------------
-- 4. Mematikan pemicu pada tabel yang ditulis skrip ini (dinyalakan lagi di bagian 15, dalam transaksi yang sama)
-- ---------------------------------------------------------------------------
create temp table demo_tabel (nama text primary key) on commit drop;
insert into demo_tabel values
  ('profiles'), ('sku_progress'), ('sku_riwayat'), ('sku_pra_uji'), ('absensi_hadir'), ('iuran'), ('iuran_log'), ('asisten_iuran'),
  ('portofolio'), ('portofolio_jurnal'), ('raport'), ('pelantikan'), ('saka_anggota'), ('tkk_capaian'), ('tkk_krida'), ('tkk_pengajuan'),
  ('spg_penetapan'), ('tanggal_lahir'), ('penegak_isian'), ('bina_damping'), ('pinsa_tugas'), ('notifikasi'), ('penugasan_peserta'),
  ('sertifikat_tingkat');

do $$
declare t text;
begin
  for t in select nama from demo_tabel loop
    execute format('alter table public.%I disable trigger user', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Mengosongkan seluruh data milik akun demo (sama dengan yang terjadi bila akunnya dihapus: semua tabel yang bergantung pada profil
--    dengan "on delete cascade"), lalu membuat ulang. Baris orang lain tidak tersentuh.
-- ---------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select c.conrelid::regclass::text as tabel, a.attname::text as kolom
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass and c.confdeltype = 'c' and array_length(c.conkey, 1) = 1
  loop
    execute format('delete from %s where %I in (select id from demo_id)', f.tabel, f.kolom);
  end loop;
  delete from public.login_gagal where username in (select nis from demo_id);
end $$;

-- ---------------------------------------------------------------------------
-- 6. Profil. Pradana, Pradani, dan Pemangku Adat hanya boleh satu pemegang: bila sudah dipegang akun asli, akun demo memakai
--    "<jabatan> (Demo)" sebagai gantinya (fungsinya sebagai jabatan tunggal tidak berlaku bagi akun demo itu).
-- ---------------------------------------------------------------------------
create temp table demo_jabatan on commit drop as
  select d.nis,
         case when d.jab in ('Pradana', 'Pradani', 'Pemangku Adat')
                   and exists (select 1 from public.profiles p where p.jabatan_dewan = d.jab and p.id not in (select id from demo_id))
              then d.jab || ' (Demo)' else d.jab end as jab
  from demo_id d;

insert into public.profiles (id, username, role, nama, nis, kelas, sangga, agama, calon_garuda, nta, jabatan_dewan, jenis_kelamin, whatsapp,
                             status, status_pada, lulus_ta, pinsa, wajib_ganti_pin, dibuat)
select d.id, d.nis, 'peserta', d.nama, d.nis, d.kelas, d.sangga, d.agama,
       case d.nis when '990006' then d.hari - 40 when '990039' then d.hari - 25 when '990054' then d.hari - 420 else null end,
       case when d.nta then 'DEMO-' || d.nis else null end,
       j.jab, d.jk,
       case when d.wa then '08120' || right(d.nis, 5) else null end,
       d.status,
       case d.status when 'nonaktif' then d.hari - 40 when 'alumni' then d.hari - 70 else null end,
       d.lulus_ta, d.pinsa, false,
       d.hari - case when d.status <> 'aktif' then 400 + d.nis::int % 30 when d.ban + d.lak = 0 then d.nis::int % 3 else 120 + d.nis::int % 50 end
from demo_id d join demo_jabatan j on j.nis = d.nis
on conflict (id) do update set
  username = excluded.username, nama = excluded.nama, nis = excluded.nis, kelas = excluded.kelas, sangga = excluded.sangga, agama = excluded.agama,
  calon_garuda = excluded.calon_garuda, nta = excluded.nta, jabatan_dewan = excluded.jabatan_dewan, jenis_kelamin = excluded.jenis_kelamin,
  whatsapp = excluded.whatsapp, status = excluded.status, status_pada = excluded.status_pada, lulus_ta = excluded.lulus_ta,
  pinsa = excluded.pinsa, wajib_ganti_pin = false, dibuat = excluded.dibuat;

-- Penguji: Pembina asli yang ada (bergantian). Tanpa Pembina, penguji dikosongkan.
create temp table demo_pembina on commit drop as
  select (row_number() over (order by dibuat, id) - 1)::int as no, id, nama
  from public.profiles where role = 'penguji' and jabatan = 'Pembina' and status = 'aktif';
create temp table demo_pn on commit drop as select greatest((select count(*) from demo_pembina), 1)::int as n;

-- ---------------------------------------------------------------------------
-- 7. Progres SKU (butir lulus). Bantara mendahului Laksana; nilai bergantian; butir agama hanya untuk agama Penegak itu.
-- ---------------------------------------------------------------------------
insert into public.sku_progress (peserta_id, sku_id, status, penguji_id, tanggal_uji, nilai, catatan, verifikasi, diverifikasi_pada, diubah, verifikasi_token)
select d.id, u.id, 'lulus', x.penguji, x.tgl, x.nilai, 'Data demo',
       sigarda.kode_verifikasi(array[d.id::text, u.id, x.penguji::text, x.tgl::text]),
       x.tgl::timestamptz + interval '3 hours', x.tgl::timestamptz + interval '3 hours', sigarda.token_acak()
from demo_id d
join public.sku_unit u on (u.agama is null or u.agama = d.agama)
cross join lateral (
  select (select pb.id from demo_pembina pb where pb.no = abs(hashtext(d.nis || u.id)) % (select n from demo_pn)) as penguji,
         case u.tingkat when 'Bantara' then d.b_akhir - (d.ban - u.butir_no) * 5 else d.l_akhir - (d.lak - u.butir_no) * 4 end as tgl,
         (array['Sangat baik', 'Baik', 'Cukup'])[1 + (u.butir_no + coalesce(u.sub, 0)) % 3] as nilai
) x
where ((u.tingkat = 'Bantara' and u.butir_no <= d.ban) or (u.tingkat = 'Laksana' and u.butir_no <= d.lak))
  and u.id is distinct from d.kecuali;

-- Butir yang sedang berjalan. 'diajukan' berpenguji kosong = antrian rombel; jadwal jauh ke depan agar tidak memicu pengingat "besok".
create temp table demo_berjalan (nis text, sku text, status text, penguji text, hari int, catatan text, catatan_peserta text) on commit drop;
insert into demo_berjalan values
  ('990004', 'BAN-15',       'diajukan', null, 12, null, 'Siap diuji (data demo).'),
  ('990004', 'BAN-16',       'proses',   'p',   0, null, null),
  ('990004', 'BAN-17',       'ulang',    'p',  -3, 'Penjelasan belum lengkap. Pelajari materinya, lalu ajukan kembali.', null),
  ('990008', 'BAN-04',       'diajukan', null, 10, null, 'Siap diuji (data demo).'),
  ('990013', 'BAN-01-KAT-2', 'diajukan', null,  9, null, 'Belum ada penilai pra-uji seagama; langsung ke antrian Pembina.'),
  ('990035', 'BAN-21',       'proses',   'p',   0, null, null),
  ('990043', 'LAK-10',       'diajukan', null, 11, null, 'Siap diuji (data demo).'),
  ('990048', 'LAK-05',       'ulang',    'p',  -5, 'Praktik belum lengkap. Latih lagi lalu ajukan kembali.', null);

insert into public.sku_progress (peserta_id, sku_id, status, jadwal, penguji_id, tanggal_uji, catatan, catatan_peserta, diubah)
select d.id, b.sku, b.status,
       case when b.status = 'diajukan' then d.hari + b.hari end,
       case when b.penguji = 'p' then (select pb.id from demo_pembina pb where pb.no = 0) end,
       case when b.status in ('proses', 'ulang') then d.hari + b.hari end,
       b.catatan, b.catatan_peserta, now()
from demo_berjalan b join demo_id d on d.nis = b.nis;

-- ---------------------------------------------------------------------------
-- 8. Pra-uji berjenjang (Bantara: Pinsa lalu Bina Damping lalu Pembina; Laksana: Bina Damping lalu Pembina). Hanya rekomendasi.
--    Sakelar Pra-uji tidak diubah skrip ini; hidupkan lewat menu Pra-uji bila ingin mencoba alurnya.
-- ---------------------------------------------------------------------------
create temp table demo_pra (nis text, sku text, tahap text, status text, penilai text, catatan text, lalu int) on commit drop;
insert into demo_pra values
  ('990011', 'BAN-18', 'pinsa',        'menunggu',   null,     '', 1),
  ('990014', 'BAN-22', 'pinsa',        'lulus',      '990003', '', 3),
  ('990014', 'BAN-22', 'bina_damping', 'menunggu',   null,     '', 2),
  ('990017', 'BAN-20', 'pinsa',        'lulus',      '990003', '', 5),
  ('990017', 'BAN-20', 'bina_damping', 'lulus',      '990039', '', 4),
  ('990023', 'BAN-11', 'pinsa',        'belum',      '990007', 'Belum bisa menjelaskan isi butir ini dengan runtut. Pelajari materinya lalu ajukan lagi.', 2),
  ('990024', 'BAN-08', 'pinsa',        'dibatalkan', null,     '', 4),
  ('990019', 'BAN-07', 'bina_damping', 'menunggu',   null,     '', 1),
  ('990021', 'BAN-14', 'bina_damping', 'menunggu',   null,     '', 6),
  ('990015', 'BAN-09', 'pinsa',        'dilewati',   'PEMBINA', 'Pinsa sangga sedang berhalangan; tahap diteruskan.', 3),
  ('990015', 'BAN-09', 'bina_damping', 'menunggu',   null,     '', 2),
  ('990016', 'BAN-04', 'pinsa',        'lulus',      '990003', '', 7),
  ('990016', 'BAN-04', 'bina_damping', 'belum',      '990041', 'Urutan langkahnya masih tertukar. Ulangi dan ajukan kembali.', 5),
  ('990003', 'LAK-12', 'bina_damping', 'menunggu',   null,     '', 1),
  ('990032', 'LAK-16', 'bina_damping', 'lulus',      '990040', '', 3),
  ('990036', 'BAN-06', 'pinsa',        'menunggu',   null,     '', 1);

insert into public.sku_pra_uji (peserta_id, sku_id, tahap, status, jadwal, catatan_peserta, penilai_id, penilai_nama, catatan, dibuat, diputuskan_pada)
select d.id, r.sku, r.tahap, r.status, d.hari + 10, '',
       case when r.penilai = 'PEMBINA' then (select pb.id from demo_pembina pb where pb.no = 0) else pn.id end,
       case when r.penilai = 'PEMBINA' then (select pb.nama from demo_pembina pb where pb.no = 0) else pn.nama end,
       r.catatan,
       now() - (r.lalu || ' days')::interval,
       case when r.status = 'menunggu' then null else now() - (r.lalu || ' days')::interval + interval '5 hours' end
from demo_pra r join demo_id d on d.nis = r.nis
left join demo_id pn on pn.nis = r.penilai;

-- Yang lulus semua tahap jadi pengajuan uji resmi di antrian Pembina
insert into public.sku_progress (peserta_id, sku_id, status, jadwal, penguji_id, catatan_peserta, diubah)
select d.id, r.sku, 'diajukan', d.hari + 10, null, '', now() - interval '1 day'
from demo_pra r join demo_id d on d.nis = r.nis
where r.tahap = 'bina_damping' and r.status = 'lulus';

-- ---------------------------------------------------------------------------
-- 9. Riwayat SKU (mengikuti bentuk teks yang dibuat fungsi server)
-- ---------------------------------------------------------------------------
insert into public.sku_riwayat (peserta_id, sku_id, waktu, teks, oleh)
select g.peserta_id, g.sku_id, (g.tanggal_uji - 3)::timestamptz + interval '2 hours',
       'Mengajukan pengujian untuk ' || to_char(g.tanggal_uji, 'YYYY-MM-DD'), g.peserta_id
from public.sku_progress g where g.peserta_id in (select id from demo_id) and g.status = 'lulus'
union all
select g.peserta_id, g.sku_id, g.diverifikasi_pada, 'Dinyatakan lulus (' || g.nilai || '), kode ' || g.verifikasi, g.penguji_id
from public.sku_progress g where g.peserta_id in (select id from demo_id) and g.status = 'lulus'
union all
select g.peserta_id, g.sku_id, now() - interval '1 day',
       'Mengajukan pengujian untuk ' || to_char(g.jadwal, 'YYYY-MM-DD') || case when g.catatan_peserta like 'Belum ada penilai pra-uji%' then ' (antrian rombel, tanpa pra-uji)' else '' end,
       g.peserta_id
from public.sku_progress g where g.peserta_id in (select id from demo_id) and g.status = 'diajukan'
  and not exists (select 1 from public.sku_pra_uji q where q.peserta_id = g.peserta_id and q.sku_id = g.sku_id)
union all
select g.peserta_id, g.sku_id, now() - interval '2 hours', 'Pengujian dimulai', g.penguji_id
from public.sku_progress g where g.peserta_id in (select id from demo_id) and g.status = 'proses'
union all
select g.peserta_id, g.sku_id, g.tanggal_uji::timestamptz + interval '3 hours', 'Perlu diulang', g.penguji_id
from public.sku_progress g where g.peserta_id in (select id from demo_id) and g.status = 'ulang'
union all
-- pra-uji: pengajuan pertama, diteruskan ke tahap berikut, hasil tiap tahap, dan penerusan ke uji resmi
select q.peserta_id, q.sku_id, q.dibuat,
       case when q.no = 1 then 'Mengajukan pengujian untuk ' || to_char(q.jadwal, 'YYYY-MM-DD') || '; menunggu pra-uji ' || sigarda.pra_uji_nama_tahap(q.tahap)
            else 'Diteruskan ke pra-uji ' || sigarda.pra_uji_nama_tahap(q.tahap) end,
       case when q.no = 1 then q.peserta_id else q.penilai_sebelum end
from (select p.*, row_number() over (partition by p.peserta_id, p.sku_id order by p.dibuat, p.id) as no,
             lag(p.penilai_id) over (partition by p.peserta_id, p.sku_id order by p.dibuat, p.id) as penilai_sebelum
      from public.sku_pra_uji p where p.peserta_id in (select id from demo_id)) q
union all
select p.peserta_id, p.sku_id, p.diputuskan_pada,
       case p.status when 'lulus' then 'Lulus pra-uji ' || sigarda.pra_uji_nama_tahap(p.tahap) || ' (' || p.penilai_nama || ')'
                     when 'belum' then 'Belum lulus pra-uji ' || sigarda.pra_uji_nama_tahap(p.tahap) || ' (' || p.penilai_nama || ')'
                     when 'dilewati' then 'Tahap pra-uji ' || sigarda.pra_uji_nama_tahap(p.tahap) || ' dilewati oleh ' || coalesce(p.penilai_nama, 'Pembina') || '. Alasan: ' || p.catatan
                     else 'Pengajuan pra-uji dibatalkan oleh Penegak' end,
       coalesce(p.penilai_id, p.peserta_id)
from public.sku_pra_uji p where p.peserta_id in (select id from demo_id) and p.status in ('lulus', 'belum', 'dilewati', 'dibatalkan')
union all
select p.peserta_id, p.sku_id, p.diputuskan_pada + interval '1 minute', 'Diteruskan ke pengujian resmi Pembina untuk ' || to_char(p.jadwal, 'YYYY-MM-DD'), p.penilai_id
from public.sku_pra_uji p where p.peserta_id in (select id from demo_id) and p.tahap = 'bina_damping' and p.status = 'lulus';

-- Aktivitas terkini: Penegak aktif yang punya progres diberi perubahan terakhir 1-5 hari lalu supaya tidak dianggap "tidak bergerak".
-- Pengecualian: tiga akun eskalasi (990009, 990012, 990020) dibiarkan lama bila eskalasi_contoh = true.
update public.sku_progress g set diubah = now() - (((abs(hashtext(d.nis)) % 5) + 1) || ' days')::interval
from demo_id d cross join demo_param p
where g.peserta_id = d.id and d.status = 'aktif' and g.status <> 'diajukan'    -- pengajuan yang menunggu tetap "baru" (agar tidak cepat memicu pengingat 3 hari)
  and (not p.eskalasi_contoh or d.nis not in ('990009', '990012', '990020'))
  and g.sku_id = (select g2.sku_id from public.sku_progress g2 where g2.peserta_id = d.id and g2.status <> 'diajukan' order by g2.diubah desc, g2.sku_id limit 1);

-- ---------------------------------------------------------------------------
-- 10. Sangga, Pinsa tertugas, Bina Damping (tahun ajaran berjalan)
-- ---------------------------------------------------------------------------
-- Bina Damping: X-10 dan XI-10 masing-masing dua Dewan yang sudah Laksana (prioritas), XII-10 hanya satu (Calon Laksana; peringatan "kurang dari 2")
insert into public.bina_damping (tahun_ajaran, rombel, penegak_id, ditetapkan_pada)
select d.ta, case b.rb when 'x' then p.r_x when 'xi' then p.r_xi else p.r_xii end, d.id, now() - interval '20 days'
from (values ('990039', 'x'), ('990041', 'x'), ('990040', 'xi'), ('990042', 'xi'), ('990029', 'xii')) as b (nis, rb)
join demo_id d on d.nis = b.nis cross join demo_param p;

insert into public.pinsa_tugas (tahun_ajaran, rombel, sangga, penegak_id, ditetapkan_pada)
select d.ta, p.r_x, t.sangga, d.id, now() - interval '15 days'
from (values ('990003', 'Demo Merak'), ('990030', 'Demo Cendrawasih'), ('990031', 'Demo Cendrawasih')) as t (nis, sangga)
join demo_id d on d.nis = t.nis cross join demo_param p;

-- Penilai pra-uji menurut sangga dan rombel (dipakai untuk notifikasi "pengajuan pra-uji baru" ke akun demo)
create temp table demo_penilai on commit drop as
  select v.tahap, case v.rb when 'x' then p.r_x when 'xi' then p.r_xi else p.r_xii end as kelas, v.sangga, v.nis
  from (values
    ('pinsa', 'x', 'Demo Elang', '990001'), ('pinsa', 'x', 'Demo Merak', '990003'), ('pinsa', 'x', 'Demo Kasuari', '990007'),
    ('pinsa', 'x', 'Demo Cendrawasih', '990030'), ('pinsa', 'x', 'Demo Cendrawasih', '990031'),
    ('pinsa', 'xi', 'Demo Garuda', '990002'), ('pinsa', 'xi', 'Demo Jalak', '990029'),
    ('bina_damping', 'x', null, '990039'), ('bina_damping', 'x', null, '990041'),
    ('bina_damping', 'xi', null, '990040'), ('bina_damping', 'xi', null, '990042'), ('bina_damping', 'xii', null, '990029')
  ) as v (tahap, rb, sangga, nis) cross join demo_param p;

-- ---------------------------------------------------------------------------
-- 11. Pelantikan, Saka, TKK (capaian, pengajuan, Krida), SPG
-- ---------------------------------------------------------------------------
insert into public.pelantikan (peserta_id, tingkat, tanggal, tempat, catatan)
select d.id, 'bantara', least(d.b_akhir + 10, d.hari - 1), (array['Lapangan SMAN 1 Bukateja', 'Bumi Perkemahan Bukateja', 'Halaman SMAN 1 Bukateja'])[1 + d.nis::int % 3], 'Data demo'
from demo_id d where d.lantik in ('b', 'bl')
union all
select d.id, 'laksana', least(d.l_akhir + 10, d.hari - 1), (array['Lapangan SMAN 1 Bukateja', 'Bumi Perkemahan Bukateja', 'Halaman SMAN 1 Bukateja'])[1 + d.nis::int % 3], 'Data demo'
from demo_id d where d.lantik = 'bl';

insert into public.saka_anggota (peserta_id, saka, tanggal_masuk, status, tanggal_selesai, surat_url)
select d.id, s.saka, d.hari - s.masuk, s.status, case when s.status = 'selesai' then d.hari - s.selesai end, s.surat
from (values
  ('990006', 'Saka Bhayangkara',   300, 'aktif',   null, 'https://drive.google.com/file/d/demo-saka-006'),
  ('990039', 'Saka Bakti Husada',  400, 'selesai',  60,  ''),
  ('990002', 'Saka Wanabakti',     120, 'aktif',   null, ''),
  ('990040', 'Saka Bhayangkara',   500, 'aktif',   null, 'https://drive.google.com/file/d/demo-saka-040'),
  ('990041', 'Saka Dirgantara',    200, 'aktif',   null, ''),
  ('990041', 'Saka Bahari',        300, 'selesai', 150,  ''),
  ('990053', 'Saka Wira Kartika',  800, 'selesai', 400,  'https://drive.google.com/file/d/demo-saka-053'),
  ('990054', 'Saka Taruna Bumi',   900, 'selesai', 380,  'https://drive.google.com/file/d/demo-saka-054'),
  ('990003', 'Saka Bakti Husada',   60, 'aktif',   null, ''),
  ('990030', 'Saka Kencana',        90, 'aktif',   null, '')
) as s (nis, saka, masuk, status, selesai, surat) join demo_id d on d.nis = s.nis;

-- TKK: (jumlah TKK, jumlah Utama, jumlah Madya). Ranking: 10 TKK wajib Utama (pengaturan tkk.ambang) lebih dulu, lalu TKK lain menurut bidang.
create temp table demo_tkk_rencana (nis text, total int, utama int, madya int) on commit drop;
insert into demo_tkk_rencana values
  ('990006', 47, 10, 4), ('990039', 44, 10, 3), ('990053', 46, 10, 3), ('990054', 45, 10, 5),
  ('990002', 30, 6, 5), ('990040', 35, 8, 6), ('990041', 25, 5, 2), ('990032', 20, 3, 4), ('990042', 18, 2, 2),
  ('990029', 12, 1, 3), ('990003', 8, 0, 2), ('990043', 6, 0, 1), ('990001', 3, 0, 0), ('990030', 5, 0, 1), ('990055', 10, 1, 1);

create temp table demo_wajib on commit drop as
  select w.kode, w.no::int as no
  from jsonb_array_elements_text(coalesce((select nilai -> 'utamaWajib' from public.pengaturan where kunci = 'tkk.ambang'),
    '["berkemah","gerak-jalan","pppk","pengatur-rumah","pengamat","juru-masak","penabung","menjahit","juru-kebun","pengamanan-kampung"]'::jsonb))
       with ordinality as w (kode, no);

create temp table demo_tkk_rank on commit drop as
  select d.id, d.nis, d.hari - d.mundur as h, d.b_akhir, r.total, r.utama, r.madya, k.id as tkk_id,
         row_number() over (partition by d.id order by (w.no is null), w.no, k.bidang, k.urut, k.id)::int as rk
  from demo_tkk_rencana r join demo_id d on d.nis = r.nis
  join public.tkk_katalog k on k.golongan = 'penegak' and (k.agama is null or k.agama = d.agama)
  left join demo_wajib w on w.kode = k.id;

insert into public.tkk_capaian (peserta_id, tkk_id, tingkat, tanggal, penguji1, penguji2, melatih, bukti_url, catatan)
select t.id, t.tkk_id, l.tingkat,
       case l.tingkat when 'purwa'  then least(t.b_akhir + 3 + 2 * t.rk, t.h - 60)
                      when 'madya'  then least(t.b_akhir + 23 + 2 * t.rk, t.h - 30)
                      else               least(t.b_akhir + 43 + 2 * t.rk, t.h - 5) end,
       'Demo Pembina Satu', 'Demo Pembantu Pembina', 'Melatih adik sangga sampai tingkat di bawahnya (data demo)',
       case when t.rk % 7 = 0 then 'https://drive.google.com/file/d/demo-tkk-' || t.nis || '-' || t.rk else '' end, ''
from demo_tkk_rank t
cross join lateral (values ('purwa', 1), ('madya', 2), ('utama', 3)) as l (tingkat, no)
where t.rk <= t.total
  and l.no <= case when t.rk <= t.utama then 3 when t.rk <= t.utama + t.madya then 2 else 1 end;

-- Pengajuan TKK dari Penegak: menunggu, ditolak, disetujui (berkait capaian resmi), dibatalkan. Tidak ada notifikasi ke Pembina asli.
insert into public.tkk_pengajuan (peserta_id, tkk_id, tingkat, tanggal, penguji1, penguji2, penguji1_id, melatih, catatan, status, diajukan_pada,
                                  ditinjau_oleh, ditinjau_nama, ditinjau_pada, catatan_tinjauan, capaian_id)
select d.id, p.tkk, p.tingkat, d.hari - p.lalu, coalesce((select pb.nama from demo_pembina pb where pb.no = 0), 'Demo Pembina Satu'), 'Demo Pembantu Pembina',
       (select pb.id from demo_pembina pb where pb.no = 0), 'Melatih adik sangga (data demo)', '', p.status, now() - (p.lalu || ' days')::interval,
       case when p.status in ('disetujui', 'ditolak') then (select pb.id from demo_pembina pb where pb.no = 0) end,
       case when p.status in ('disetujui', 'ditolak') then coalesce((select pb.nama from demo_pembina pb where pb.no = 0), 'Pembina (demo)') end,
       case when p.status in ('disetujui', 'ditolak') then now() - ((p.lalu - 1) || ' days')::interval end,
       p.catatan,
       case when p.status = 'disetujui' then (select c.id from public.tkk_capaian c where c.peserta_id = d.id and c.tkk_id = p.tkk and c.tingkat = p.tingkat) end
from (values
  ('990001', 'juru-kebun', 'purwa', 'menunggu',   2, ''),
  ('990003', 'menjahit',   'madya', 'menunggu',   1, ''),
  ('990043', 'menjahit',   'purwa', 'ditolak',    6, 'Bukti belum jelas; lengkapi tautan surat keterangan lalu ajukan lagi.'),
  ('990032', 'berkemah',   'utama', 'disetujui',  9, ''),
  ('990040', 'pengamanan-kampung', 'utama', 'dibatalkan', 12, '')
) as p (nis, tkk, tingkat, status, lalu, catatan) join demo_id d on d.nis = p.nis;

insert into public.tkk_krida (peserta_id, nama, saka, tanggal, bukti_url)
select d.id, k.nama, k.saka, d.hari - k.lalu, k.bukti
from (values
  ('990006', 'Krida Lalu Lintas',       'Saka Bhayangkara', 120, 'https://drive.google.com/file/d/demo-krida-006'),
  ('990002', 'Krida Wanabakti Dasar',   'Saka Wanabakti',    30, ''),
  ('990054', 'Krida Taruna Bumi',       'Saka Taruna Bumi', 500, 'https://drive.google.com/file/d/demo-krida-054'),
  ('990040', 'Krida Lalu Lintas',       'Saka Bhayangkara', 200, '')
) as k (nis, nama, saka, lalu, bukti) join demo_id d on d.nis = k.nis;

-- SPG (13 butir SK 038/2017): butir berbasis dokumen dan penimpaan hasil hitung. Butir 2, 4, 6, 11 dihitung otomatis di aplikasi.
insert into public.spg_penetapan (peserta_id, butir, nilai, tanggal, catatan, timpa, dicatat_oleh)
select d.id, s.butir, s.nilai, d.hari - s.lalu, s.catatan, s.timpa, (select pb.id from demo_pembina pb where pb.no = 0)
from (values
  ('990006', 1, 100, 25, '', false), ('990006', 3, 100, 25, '', false), ('990006', 5, 100, 25, '', false), ('990006', 7, 100, 25, '', false),
  ('990006', 8, 100, 24, '', false), ('990006', 9, 100, 24, '', false), ('990006', 10, 100, 24, '', false), ('990006', 12, 100, 23, '', false),
  ('990006', 13, 100, 23, '', false),
  ('990006', 6, 100, 22, 'Keanggotaan Saka tercatat di sekolah lain; disahkan Pembina.', true),
  ('990039', 1, 100, 20, '', false), ('990039', 3, 100, 20, '', false), ('990039', 5, 0, 19, 'Portofolio belum lengkap.', false),
  ('990002', 1, 100, 10, '', false),
  ('990040', 1, 0, 8, 'Belum lulus, jadwalkan ulang.', false)
) as s (nis, butir, nilai, lalu, catatan, timpa) join demo_id d on d.nis = s.nis;
insert into public.spg_penetapan (peserta_id, butir, nilai, tanggal, catatan, timpa, dicatat_oleh)
select d.id, b.butir, 100, d.hari - 380, '', false, (select pb.id from demo_pembina pb where pb.no = 0)
from demo_id d cross join generate_series(1, 13) as b (butir) where d.nis = '990054';

insert into public.sertifikat_tingkat (token, peserta_id, tingkat, diterbitkan_pada)
select md5(d.nis || '|' || s.tingkat || '|demo'), d.id, s.tingkat, now() - interval '10 days'
from (values ('990002', 'Bantara'), ('990006', 'Bantara'), ('990006', 'Laksana'), ('990039', 'Bantara'), ('990039', 'Laksana'),
             ('990040', 'Bantara'), ('990053', 'Bantara'), ('990053', 'Laksana'), ('990054', 'Bantara'), ('990054', 'Laksana')) as s (nis, tingkat)
join demo_id d on d.nis = s.nis;

-- ---------------------------------------------------------------------------
-- 12. Tanggal lahir, data diri (penegak_isian), portofolio Garuda, raport, penugasan khusus
-- ---------------------------------------------------------------------------
insert into public.tanggal_lahir (peserta_id, tanggal)
select d.id, d.lahir from demo_id d where d.lahir is not null;

-- Daftar kunci isian: lvl 0 = sebagian, 1 = sebagian + isian pokok, 2 = penuh. Nilai dinamis dibuat menurut NIS; sisanya tetap.
create temp table demo_kunci (kunci text primary key, lvl int, nilai text) on commit drop;
insert into demo_kunci values
  ('panggilan', 0, ''), ('tempat_lahir', 0, ''),
  ('alamat', 1, ''), ('gol_darah', 1, ''), ('no_hp', 1, ''), ('tinggi', 1, ''), ('berat', 1, ''),
  ('ayah_nama', 1, ''), ('ayah_hp', 1, '081200001111'), ('ayah_kerja', 1, 'Wiraswasta'), ('ayah_alamat', 1, 'Bukateja, Purbalingga'),
  ('ibu_nama', 1, ''), ('ibu_hp', 1, '081200002222'), ('ibu_kerja', 1, 'Ibu rumah tangga'), ('ibu_alamat', 1, 'Bukateja, Purbalingga'),
  ('penyakit', 2, 'Tidak ada'), ('anak_ke', 2, ''), ('dari_saudara', 2, '3'),
  ('sdr1_nama', 2, 'Kakak (demo)'), ('sdr1_sebagai', 2, 'Kakak'), ('sdr2_nama', 2, 'Adik (demo)'), ('sdr2_sebagai', 2, 'Adik'),
  ('pend_tk_nama', 2, 'TK Pertiwi Bukateja'), ('pend_tk_lulus', 2, '2015'),
  ('pend_sd_nama', 2, 'SD Negeri 1 Bukateja'), ('pend_sd_lulus', 2, '2021'),
  ('pend_smp_nama', 2, 'SMP Negeri 1 Bukateja'), ('pend_smp_lulus', 2, '2024'),
  ('akd_smp', 2, 'Juara 2 lomba cerdas cermat tingkat kecamatan'), ('akd_sma', 2, 'Peringkat 5 besar di kelas'),
  ('non_smp', 2, 'Juara 1 lomba baris-berbaris tingkat Kwarran'), ('non_sma', 2, 'Peserta Jambore Ranting'),
  ('keg1_nama', 2, 'Perkemahan Penegak tingkat Kwarran'), ('keg1_tingkat', 2, 'kwarran'),
  ('keg2_nama', 2, 'Lomba Tingkat Penggalang'), ('keg2_tingkat', 2, 'kwarcab'),
  ('keg3_nama', 2, 'Raimuna Daerah'), ('keg3_tingkat', 2, 'kwarda'),
  ('bid1_nama', 2, 'Seni Budaya'), ('bid1_jenis', 2, 'Menari'), ('bid2_nama', 2, 'Olahraga'), ('bid2_jenis', 2, 'Bola voli'),
  ('it1_nama', 2, 'Telepon pintar'), ('it1_level', 2, 'bisa'), ('it2_nama', 2, 'Laptop'), ('it2_level', 2, 'cukup'), ('it3_nama', 2, 'Kamera'), ('it3_level', 2, 'kurang');

insert into public.penegak_isian (peserta_id, kunci, nilai, diubah_pada)
select d.id, k.kunci,
       case k.kunci
         when 'panggilan'    then split_part(d.nama, ' ', 2)
         when 'tempat_lahir' then (array['Purbalingga', 'Banjarnegara', 'Bukateja', 'Purwokerto', 'Kutasari'])[1 + d.nis::int % 5]
         when 'alamat'       then 'Dusun ' || (array['Kedungjati', 'Karangnangka', 'Wirasana', 'Kembaran'])[1 + d.nis::int % 4] || ' RT 0' || (1 + d.nis::int % 5) || '/RW 0' || (1 + d.nis::int % 3) || ', Bukateja, Purbalingga'
         when 'gol_darah'    then (array['A', 'B', 'AB', 'O'])[1 + d.nis::int % 4]
         when 'no_hp'        then '08130' || right(d.nis, 5)
         when 'tinggi'       then (150 + d.nis::int % 25)::text
         when 'berat'        then (40 + d.nis::int % 25)::text
         when 'ayah_nama'    then (array['Sutrisno', 'Slamet', 'Heri', 'Darmanto', 'Wahyudi'])[1 + d.nis::int % 5] || ' (demo)'
         when 'ibu_nama'     then (array['Sri Wahyuni', 'Sumarni', 'Yuliana', 'Rukmini', 'Suparti'])[1 + d.nis::int % 5] || ' (demo)'
         when 'anak_ke'      then (1 + d.nis::int % 3)::text
         else k.nilai end,
       now() - interval '10 days'
from demo_id d join demo_kunci k on k.lvl <= case d.diri when 'penuh' then 2 when 'pokok' then 1 when 'sebagian' then 0 else -1 end;

-- Portofolio Garuda (PF-01 sampai PF-26): jumlah dokumen siap dan sedang disiapkan
insert into public.portofolio (peserta_id, item_id, status, catatan, tautan, diperbarui)
select d.id, i.id, case when i.no <= p.siap then 'siap' else 'proses' end, 'Data demo',
       case when i.no <= p.siap then 'https://drive.google.com/drive/folders/demo-' || lower(i.id) else '' end, now() - interval '5 days'
from (values ('990006', 12, 6), ('990039', 26, 0), ('990054', 26, 0)) as p (nis, siap, proses)
join demo_id d on d.nis = p.nis
join (select id, substr(id, 4)::int as no from public.pf_item) i on i.no <= p.siap + p.proses;

update public.portofolio set catatan_penguji = 'Tautan belum dapat dibuka, mohon diperbarui.', catatan_penguji_oleh = (select pb.id from demo_pembina pb where pb.no = 0)
where item_id = 'PF-05' and peserta_id = (select id from demo_id where nis = '990006');

insert into public.portofolio_jurnal (peserta_id, item_id, waktu, teks, oleh)
select p.peserta_id, p.item_id, p.diperbarui,
       case p.status when 'siap' then 'Status: Belum siap menjadi Siap (Ada). Catatan diperbarui. Tautan berkas diperbarui'
                     else 'Status: Belum siap menjadi Sedang disiapkan. Catatan diperbarui' end,
       p.peserta_id
from public.portofolio p where p.peserta_id in (select id from demo_id);

-- Raport semester tahun ajaran lalu (sebagian final, sebagian draf)
insert into public.raport (peserta_id, tahun_ajaran, semester, tingkat, sikap, karakter, skk, kehadiran_persen, hadir, pertemuan,
                           capaian_lulus, capaian_target, skor, predikat_hitung, predikat_akhir, deskripsi, status, diubah_oleh)
select d.id, d.ta_lalu, r.semester, r.tingkat, r.sikap, r.karakter, 4, r.hadir * 100 / r.pertemuan, r.hadir, r.pertemuan,
       case r.tingkat when 'Bantara' then 23 else 22 end, case r.tingkat when 'Bantara' then 23 else 22 end,
       r.skor, r.predikat, null, case when r.status = 'final' then 'Penegak menunjukkan sikap disiplin dan mampu bekerja sama dalam sangga (data demo).' else '' end,
       r.status, (select pb.id from demo_pembina pb where pb.no = 0)
from (values
  ('990006', 'ganjil', 'Bantara', 5, array['Disiplin', 'Kerja sama'], 18, 20, 92, 'A', 'final'),
  ('990006', 'genap',  'Laksana', 5, array['Disiplin', 'Kepemimpinan'], 19, 20, 94, 'A', 'final'),
  ('990053', 'genap',  'Laksana', 4, array['Kerja sama'], 17, 20, 82, 'B', 'final'),
  ('990054', 'genap',  'Laksana', 5, array['Disiplin', 'Mandiri'], 20, 20, 96, 'A', 'final'),
  ('990002', 'genap',  'Bantara', null, array[]::text[], 16, 20, 80, 'B', 'draf'),
  ('990003', 'ganjil', 'Bantara', 4, array['Tanggung jawab'], 17, 20, 85, 'B', 'final')
) as r (nis, semester, tingkat, sikap, karakter, hadir, pertemuan, skor, predikat, status) join demo_id d on d.nis = r.nis;

-- Penugasan khusus per Penegak (menggantikan penugasan rombelnya): hanya bila ada Pembina asli
insert into public.penugasan_peserta (tahun_ajaran, peserta_id, penguji_id)
select d.ta, d.id, pb.id
from demo_id d join demo_pembina pb on pb.no = case d.nis when '990004' then 0 else least(1, (select n from demo_pn) - 1) end
where d.nis in ('990004', '990048');

-- ---------------------------------------------------------------------------
-- 13. Absensi dan iuran (hanya sesi latihan yang sudah ada) dan asisten bendahara
-- ---------------------------------------------------------------------------
create temp table demo_sesi on commit drop as
  select tanggal, (row_number() over (order by tanggal desc))::int as urut from (select tanggal from public.absensi_sesi order by tanggal desc limit 8) s;

create temp table demo_hadir on commit drop as
  select s.tanggal, s.urut, d.id, d.nis,
         case when d.nis = '990020' and s.urut <= 2 and p.eskalasi_contoh then 'A'
              else case when h.k < 72 then 'H' when h.k < 82 then 'I' when h.k < 88 then 'S' when s.urut <= 2 then 'I' else 'A' end end as status
  from demo_sesi s cross join demo_id d cross join demo_param p
  cross join lateral (select abs(hashtext(d.nis || s.tanggal::text)) % 100 as k) h
  where d.status = 'aktif';

insert into public.absensi_hadir (tanggal, peserta_id, status, waktu)
select tanggal, id, status, tanggal::timestamptz + interval '16 hours' from demo_hadir;

insert into public.iuran (tanggal, peserta_id, jumlah, jenis, waktu)
select h.tanggal, h.id, (array[1000, 2000, 1000, 5000])[1 + abs(hashtext(h.nis)) % 4],
       case when h.urut > 2 and abs(hashtext(h.nis || 's')) % 13 = 0 then 'susulan' else 'rutin' end,
       h.tanggal::timestamptz + interval '16 hours'
from demo_hadir h cross join demo_param p
where h.status <> 'A'
  and not (h.nis = '990022' and h.urut <= 2 and p.eskalasi_contoh)
  and (h.urut <= 2 or abs(hashtext(h.nis || h.tanggal::text || 'i')) % 100 < 85);

insert into public.iuran_log (tanggal, peserta_id, jumlah_lama, jumlah_baru, jenis, waktu)
select tanggal, peserta_id, null, jumlah, jenis, waktu from public.iuran where peserta_id in (select id from demo_id);

insert into public.asisten_iuran (peserta_id) select id from demo_id where nis = '990031';

-- ---------------------------------------------------------------------------
-- 14. Notifikasi (hanya untuk akun demo; isi singkat dan tanpa hasil lulus/ulang, seperti yang dibuat pemicu sungguhan)
-- ---------------------------------------------------------------------------
insert into public.notifikasi (penerima_id, jenis, judul, isi, tautan, dibuat, dibaca_pada)
-- pengujian dimulai / hasil tersedia
select g.peserta_id, 'mulai', 'Pengujian dimulai', 'Penguji mulai menguji ' || sigarda.notif_label_butir(g.sku_id) || '.', '{"tab":"sku"}'::jsonb, now() - interval '2 hours', null
from public.sku_progress g where g.peserta_id in (select id from demo_id) and g.status = 'proses'
union all
select g.peserta_id, 'hasil', 'Hasil penilaian tersedia', 'Hasil ' || sigarda.notif_label_butir(g.sku_id) || ' sudah dicatat. Buka aplikasi untuk melihatnya.', '{"tab":"sku"}'::jsonb,
       g.tanggal_uji::timestamptz + interval '4 hours', case when abs(hashtext(g.peserta_id::text)) % 2 = 0 then g.tanggal_uji::timestamptz + interval '6 hours' end
from public.sku_progress g where g.peserta_id in (select id from demo_id) and g.status = 'ulang'
union all
-- hasil terakhir tiap Penegak aktif (sebagian sudah dibaca)
select l.peserta_id, 'hasil', 'Hasil penilaian tersedia', 'Hasil ' || sigarda.notif_label_butir(l.sku_id) || ' sudah dicatat. Buka aplikasi untuk melihatnya.', '{"tab":"sku"}'::jsonb,
       l.tanggal_uji::timestamptz + interval '4 hours', case when abs(hashtext(l.peserta_id::text)) % 3 <> 0 then l.tanggal_uji::timestamptz + interval '6 hours' end
from (select distinct on (g.peserta_id) g.peserta_id, g.sku_id, g.tanggal_uji from public.sku_progress g join demo_id d on d.id = g.peserta_id
      where g.status = 'lulus' and d.status = 'aktif' order by g.peserta_id, g.tanggal_uji desc, g.sku_id) l
union all
-- pra-uji: penilai diberi tahu pengajuan baru; Penegak diberi tahu keputusan (jalur ke tahap berikut/Pembina, atau belum lulus)
select pn.id, 'pra_uji', 'Pengajuan pra-uji baru', pe.nama || ' mengajukan ' || sigarda.notif_label_butir(q.sku_id) || ' untuk pra-uji ' || sigarda.pra_uji_nama_tahap(q.tahap),
       '{"tab":"pra-uji"}'::jsonb, q.dibuat, null
from public.sku_pra_uji q join public.profiles pe on pe.id = q.peserta_id
join demo_penilai pl on pl.tahap = q.tahap and pl.kelas = pe.kelas and (pl.sangga is null or lower(pl.sangga) = lower(pe.sangga))
join demo_id pn on pn.nis = pl.nis
where q.peserta_id in (select id from demo_id) and q.status = 'menunggu'
union all
select q.peserta_id, 'pra_uji', case when q.status = 'lulus' then 'Pra-uji lulus' else 'Pra-uji belum lulus' end,
       sigarda.notif_label_butir(q.sku_id) || case when q.status = 'lulus' then ' lulus pra-uji dan ' || case when q.tahap = 'bina_damping' then 'diteruskan ke pengujian resmi ke Pembina.' else 'diteruskan ke pra-uji selanjutnya.' end
                                                else ' belum lulus pra-uji. Buka aplikasi untuk melihat catatan perbaikan.' end,
       '{"tab":"sku"}'::jsonb, q.diputuskan_pada, case when abs(hashtext(q.id::text)) % 2 = 0 then q.diputuskan_pada + interval '3 hours' end
from public.sku_pra_uji q where q.peserta_id in (select id from demo_id) and q.status in ('lulus', 'belum')
union all
-- TKK ditinjau
select p.peserta_id, 'tkk', 'Pengajuan TKK ditinjau', 'Pengajuan TKK ' || k.nama || ' ' || initcap(p.tingkat) || ' sudah ditinjau Pembina. Buka aplikasi untuk melihat hasilnya.',
       '{"tab":"tkk"}'::jsonb, p.ditinjau_pada, null
from public.tkk_pengajuan p join public.tkk_katalog k on k.id = p.tkk_id
where p.peserta_id in (select id from demo_id) and p.status in ('disetujui', 'ditolak')
union all
-- pengingat eskalasi contoh (isi memakai fungsi server)
select d.id, 'eskalasi', sigarda.eskalasi_judul('sku', e.tingkat), sigarda.eskalasi_isi('sku', e.tingkat, d.hari - e.hari_mulai), '{"tab":"beranda"}'::jsonb, now() - interval '3 hours', null
from (values ('990009', 1, 0), ('990012', 2, 5), ('990020', 3, 11)) as e (nis, tingkat, hari_mulai) join demo_id d on d.nis = e.nis
union all
-- pengingat umum
select d.id, 'agenda', 'Pelantikan Bantara 7 hari lagi', 'Persiapkan perlengkapan dan konfirmasi kehadiran.', '{"tab":"beranda"}'::jsonb, now() - interval '1 day', null
from demo_id d where d.nis in ('990001', '990003', '990030')
union all
select d.id, 'pengingat', 'Pengujian besok', sigarda.notif_label_butir('BAN-15') || ' dijadwalkan besok.', '{"tab":"sku"}'::jsonb, now() - interval '20 hours', now() - interval '18 hours'
from demo_id d where d.nis = '990004';

-- ---------------------------------------------------------------------------
-- 15. Menyalakan kembali pemicu
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select nama from demo_tabel loop
    execute format('alter table public.%I enable trigger user', t);
  end loop;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Hasil: peta akun demo. Kolom PIN: akun berjabatan Dewan memakai PIN ACAK yang HANYA tampil di sini (salin ke luar repositori).
-- ---------------------------------------------------------------------------
select d.nis as "NIS (nama pengguna)", d.nama, coalesce(p.kelas, '-') as "Kelas", coalesce(p.sangga, '-') as "Sangga", coalesce(p.agama, '-') as "Agama",
       p.status as "Status",
       concat_ws(', ', p.jabatan_dewan, case when p.pinsa then 'Pinsa' end,
                 case when exists (select 1 from public.bina_damping b where b.penegak_id = p.id) then 'Bina Damping' end,
                 case when exists (select 1 from public.pinsa_tugas t where t.penegak_id = p.id) then 'Pinsa tertugas' end) as "Peran",
       (select count(*) from public.sku_progress g join public.sku_unit u on u.id = g.sku_id where g.peserta_id = p.id and g.status = 'lulus' and u.tingkat = 'Bantara' and u.sub is null) ||
         ' + ' || (select count(*) from public.sku_progress g join public.sku_unit u on u.id = g.sku_id where g.peserta_id = p.id and g.status = 'lulus' and u.tingkat = 'Bantara' and u.sub is not null) as "Bantara lulus (butir + sub agama)",
       (select count(*) from public.sku_progress g join public.sku_unit u on u.id = g.sku_id where g.peserta_id = p.id and g.status = 'lulus' and u.tingkat = 'Laksana') as "Laksana lulus (unit)",
       case when p.calon_garuda is not null then 'ya' else '-' end as "Calon Garuda",
       x.pin as "PIN", d.ket as "Kondisi"
from demo_penegak d
join public.profiles p on p.nis = d.nis and p.role = 'peserta'
join demo_pin x on x.nis = d.nis
order by d.nis;
