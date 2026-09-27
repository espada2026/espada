// Menyusun supabase/migrasi/2026-09-beranda.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-09-beranda.mjs
import { ambil, gantiFungsi, tulisMigrasi } from './bantu.mjs';

const aksi = gantiFungsi(ambil('-- ===== Beranda publik (Fase 1 landing page): aksi =====', '-- ===== akhir aksi beranda =====', true));

const kepala = `-- ============================================================================
-- MIGRASI: Fase 1 landing page -- isi beranda publik. AMAN untuk database berisi data.
--
-- Jalankan SETELAH migrasi sebelumnya (sampai 2026-09-pinsa-tugas.sql; lihat README). Isi:
--   * sigarda.rapikan_baris dan sigarda.rapikan_paragraf (fungsi bantu: merapikan teks satu baris dan berparagraf).
--   * sg_beranda_kontak_simpan(jsonb): pengurus (Pembina, Admin Gudep, Dewan Ambalan) mengisi kontak, tautan media sosial, jadwal latihan, sambutan, dan
--     cerita gudep untuk halaman muka; disimpan pada pengaturan 'beranda.kontak'.
--   * sg_beranda_publik(): isi halaman muka yang boleh dilihat TANPA login (identitas gudep, nama Pembina dan Kepala Sekolah tanpa NTA/NIP, kontak,
--     dan paling banyak 6 agenda mendatang berisi jenis, judul, tanggal saja). Hanya membaca.
-- TIDAK ada tabel baru dan TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regclass('public.pengaturan') is null or to_regclass('public.agenda') is null or to_regprocedure('sigarda.pengurus()') is null then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (lihat README), baru migrasi ini.';
  end if;
end $$;

${aksi}

revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;

revoke all on function public.sg_beranda_kontak_simpan(jsonb), public.sg_beranda_publik() from public, anon, authenticated;
grant execute on function public.sg_beranda_kontak_simpan(jsonb) to authenticated;
-- Dibaca tanpa login (halaman muka); hanya membaca.
grant execute on function public.sg_beranda_publik() to anon, authenticated;

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-09-beranda', kepala);
