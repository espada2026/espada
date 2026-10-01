-- ============================================================================
-- HAPUS DATA DEMO SIAGA yang dibuat oleh supabase/demo/data_demo_siaga.sql
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
--
-- Yang dihapus HANYA anak Siaga tanpa akun dengan NIS 991001 sampai 991099 DAN nama berawalan "Demo ". Seluruh data milik anak itu ikut terhapus
-- (progres SKU dan riwayat, pelantikan, TKK Siaga, kehadiran, iuran, tabungan) karena terhubung ke profil lewat cascade.
-- Anak asli dan data gugus depan lain tidak tersentuh.
-- ============================================================================
begin;

delete from public.profiles where role = 'peserta' and tanpa_akun and nis ~ '^9910[0-9]{2}$' and nama like 'Demo %';

commit;

select (select count(*) from public.profiles where nis ~ '^9910[0-9]{2}$' and nama like 'Demo %') as "anak demo tersisa",
       (select count(*) from public.profiles where role = 'peserta') as "peserta (semua)";
