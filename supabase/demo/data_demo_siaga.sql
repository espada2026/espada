-- ============================================================================
-- DATA DEMO SIAGA (Pramuka Siaga, Fase 7): 24 anak Siaga fiktif TANPA akun masuk (nama berawalan "Demo ", NIS 991001 sampai 991024), dalam dua
-- perindukan: "Demo Melati" (3 barung x 6 anak) dan "Demo Anggrek" (1 barung x 6 anak, sengaja kurang dari 3 barung agar peringatan ukuran kelompok tampil).
-- Isinya: kelas 2 sampai 6, agama bervariasi, SKU Mula/Bantu/Tata yang sudah lulus pada tingkat berbeda, pelantikan, dan TKK Siaga.
-- Peta kondisi tiap anak tampil di hasil PALING AKHIR skrip ini.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run. Jalankan SESUDAH semua migrasi (sampai 2026-10-tkk-siaga.sql).
-- Aman dijalankan berulang: data demo lama dihapus dulu lalu dibuat ulang. Hanya menyentuh anak demo (NIS 991001-991024, nama "Demo ...").
-- Menghapusnya: hapus_data_demo_siaga.sql.
--
-- Yang perlu dipahami:
-- 1. Anak demo tampil di daftar Anggota Siaga dan dasbor Pembina selama masih ada. Hapus sesudah selesai menguji.
-- 2. Anak demo TANPA akun, jadi tidak ada PIN dan tidak ada yang dapat masuk sebagai mereka; Pembina menilai lewat menu Anggota Siaga.
-- 3. Pemicu pada tabel yang ditulis dimatikan di dalam satu transaksi lalu dinyalakan kembali: tidak ada notifikasi atau push ke akun asli.
-- 4. Yang TIDAK dibuat: akun Pembina/Admin, pengaturan gudep, agenda, sesi absensi, iuran. Absensi dan iuran dicoba lewat menunya.
-- ============================================================================
begin;

drop table if exists demo_siaga;

-- Bersihkan data demo lama (profil terhapus = seluruh data anak ikut terhapus lewat cascade).
delete from public.profiles where role = 'peserta' and tanpa_akun and nis ~ '^9910[0-9]{2}$' and nama like 'Demo %';

-- Pemicu penjaga/notifikasi dimatikan hanya pada tabel yang ditulis (dinyalakan lagi di akhir, dalam transaksi yang sama).
alter table public.sku_progress disable trigger user;
alter table public.pelantikan disable trigger user;
alter table public.tkk_siaga disable trigger user;

create temp table demo_param on commit drop as select current_date as hari;

-- no, nama, kelas, jk, agama, perindukan, barung, tingkat selesai (0 = belum, 1 = Mula, 2 = Bantu, 3 = Tata), butir berjalan di tingkat berikutnya
create temp table demo_siaga (no int primary key, nama text, kelas text, jk text, agama text, perindukan text, barung text, selesai int, sebagian int, id uuid);
insert into demo_siaga (no, nama, kelas, jk, agama, perindukan, barung, selesai, sebagian) values
  ( 1, 'Demo Adit',   '3',  'L', 'Islam',     'Demo Melati',  'Demo Kupu-kupu', 0, 6),
  ( 2, 'Demo Bunga',  '3',  'P', 'Islam',     'Demo Melati',  'Demo Kupu-kupu', 0, 14),
  ( 3, 'Demo Cahya',  '2',  'P', 'Katolik',   'Demo Melati',  'Demo Kupu-kupu', 0, 0),
  ( 4, 'Demo Dimas',  '3',  'L', 'Islam',     'Demo Melati',  'Demo Kupu-kupu', 0, 20),
  ( 5, 'Demo Eka',    '2',  'P', 'Protestan', 'Demo Melati',  'Demo Kupu-kupu', 0, 3),
  ( 6, 'Demo Farhan', '3',  'L', 'Islam',     'Demo Melati',  'Demo Kupu-kupu', 0, 0),
  ( 7, 'Demo Gita',   '4',  'P', 'Islam',     'Demo Melati',  'Demo Capung',    1, 5),
  ( 8, 'Demo Hafiz',  '4',  'L', 'Islam',     'Demo Melati',  'Demo Capung',    1, 12),
  ( 9, 'Demo Intan',  '4',  'P', 'Hindu',     'Demo Melati',  'Demo Capung',    1, 0),
  (10, 'Demo Joko',   '4',  'L', 'Islam',     'Demo Melati',  'Demo Capung',    1, 20),
  (11, 'Demo Kirana', '4',  'P', 'Buddha',    'Demo Melati',  'Demo Capung',    1, 2),
  (12, 'Demo Lutfi',  '4',  'L', 'Islam',     'Demo Melati',  'Demo Capung',    1, 0),
  (13, 'Demo Maya',   '5',  'P', 'Islam',     'Demo Melati',  'Demo Belalang',  2, 4),
  (14, 'Demo Naufal', '5',  'L', 'Islam',     'Demo Melati',  'Demo Belalang',  2, 15),
  (15, 'Demo Oka',    '5A', 'L', 'Hindu',     'Demo Melati',  'Demo Belalang',  2, 0),
  (16, 'Demo Putri',  '5A', 'P', 'Islam',     'Demo Melati',  'Demo Belalang',  2, 8),
  (17, 'Demo Qori',   '5A', 'P', 'Islam',     'Demo Melati',  'Demo Belalang',  2, 0),
  (18, 'Demo Rafi',   '5A', 'L', 'Katolik',   'Demo Melati',  'Demo Belalang',  2, 1),
  (19, 'Demo Salsa',  '6',  'P', 'Islam',     'Demo Anggrek', 'Demo Cendrawasih', 3, 0),
  (20, 'Demo Tegar',  '6',  'L', 'Islam',     'Demo Anggrek', 'Demo Cendrawasih', 3, 0),
  (21, 'Demo Umar',   '6',  'L', 'Islam',     'Demo Anggrek', 'Demo Cendrawasih', 2, 33),
  (22, 'Demo Vina',   '6',  'P', 'Protestan', 'Demo Anggrek', 'Demo Cendrawasih', 3, 0),
  (23, 'Demo Wahyu',  '6',  'L', 'Islam',     'Demo Anggrek', 'Demo Cendrawasih', 2, 20),
  (24, 'Demo Yuni',   '6',  'P', 'Islam',     'Demo Anggrek', 'Demo Cendrawasih', 1, 0);

-- Profil anak tanpa akun (sama bentuknya dengan yang dibuat sg_siaga_tambah).
update demo_siaga set id = gen_random_uuid();
insert into public.profiles (id, username, role, nama, nis, kelas, agama, jenis_kelamin, perindukan, barung, tanpa_akun, wajib_ganti_pin)
select id, 'siaga' || substr(md5(id::text), 1, 12), 'peserta', nama, (991000 + no)::text, kelas, agama, jk, perindukan, barung, true, false
from demo_siaga;

-- SKU lulus. Tingkat yang sudah selesai lulus seluruhnya; tingkat berikutnya lulus sebagian (butir pertama menurut nomor, sebanyak "sebagian").
-- Butir agama hanya untuk agama anak itu. Tanggal mundur teratur dari hari ini supaya urutan pelantikan wajar.
insert into public.sku_progress (peserta_id, sku_id, status, penguji_id, tanggal_uji, nilai, catatan, verifikasi, diverifikasi_pada, diubah, verifikasi_token)
select d.id, u.id, 'lulus', null, x.tgl, (array['Sangat baik', 'Baik', 'Cukup'])[1 + (u.butir_no + coalesce(u.sub, 0)) % 3], 'Data demo',
       sigarda.kode_verifikasi(array[d.id::text, u.id, 'demo', x.tgl::text]), x.tgl::timestamptz + interval '3 hours', x.tgl::timestamptz + interval '3 hours', sigarda.token_acak()
from demo_siaga d
join public.sku_unit u on u.tingkat in ('Mula', 'Bantu', 'Tata') and (u.agama is null or u.agama = d.agama)
cross join demo_param p
cross join lateral (select p.hari - (case u.tingkat when 'Mula' then 240 when 'Bantu' then 140 else 50 end) + u.butir_no) as x(tgl)
where (case u.tingkat when 'Mula' then 1 when 'Bantu' then 2 else 3 end) <= d.selesai
   or ((case u.tingkat when 'Mula' then 1 when 'Bantu' then 2 else 3 end) = d.selesai + 1 and u.butir_no <= d.sebagian);

-- Pelantikan: tiap tingkat yang selesai dilantik sebelum tingkat berikutnya dimulai.
insert into public.pelantikan (peserta_id, tingkat, tanggal, tempat, catatan)
select d.id, t.tingkat, p.hari - t.mundur, 'Lapangan sekolah (demo)', 'Data demo'
from demo_siaga d cross join demo_param p
join (values ('mula', 1, 200), ('bantu', 2, 100), ('tata', 3, 10)) t(tingkat, urut, mundur) on t.urut <= d.selesai;

-- TKK Siaga (satu tingkat) untuk anak yang sudah selesai Siaga Bantu: dua SKK umum pertama pada katalog Siaga.
insert into public.tkk_siaga (peserta_id, tkk_id, tanggal, penguji, catatan)
select d.id, k.id, p.hari - 30, 'Pembina (demo)', 'Data demo'
from demo_siaga d cross join demo_param p
cross join lateral (select id from public.tkk_katalog where golongan = 'siaga' and sumber = 'skk-132-1979' and agama is null order by bidang, urut limit 2) k
where d.selesai >= 2;

alter table public.sku_progress enable trigger user;
alter table public.pelantikan enable trigger user;
alter table public.tkk_siaga enable trigger user;

commit;

-- Peta kondisi tiap anak demo.
select d.no, d.nama, d.kelas, d.agama, d.perindukan, d.barung,
       case d.selesai when 0 then 'Calon Siaga' when 1 then 'Siaga Mula' when 2 then 'Siaga Bantu' else 'Siaga Tata' end as tingkat,
       (select count(*) from public.sku_progress s where s.peserta_id = d.id and s.status = 'lulus') as "butir lulus",
       (select count(*) from public.tkk_siaga t where t.peserta_id = d.id) as "TKK"
from demo_siaga d order by d.no;
