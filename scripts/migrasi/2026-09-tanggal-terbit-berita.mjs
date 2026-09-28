// Menyusun supabase/migrasi/2026-09-tanggal-terbit-berita.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-09-tanggal-terbit-berita.mjs
import { ambil, gantiFungsi, tulisMigrasi } from './bantu.mjs';

const aksi = gantiFungsi(ambil('-- ===== Berita =====', '-- ===== akhir berita =====', true));

const kepala = `-- ============================================================================
-- MIGRASI: Kelola Beranda -- tanggal terbit berita dapat dipilih penulis (berita terlambat ditulis, atau beberapa berita sekaligus dengan tanggal berbeda).
-- AMAN untuk database berisi data.
--
-- Jalankan SETELAH migrasi 2026-09-berita-lagi.sql (bila belum, berhenti dengan pesan yang menuntun). Isi:
--   * sg_berita_simpan (tanda tangan sama) kini menyimpan p_terbit_pada untuk SEMUA status (draf, menunggu, terbit), bukan hanya terbit; berita terbit tanpa
--     tanggal tetap memakai saat ini. Tanggal dibatasi: paling awal 2015, paling jauh 366 hari ke depan (galat bila di luar).
--   * sg_berita_tinjau (tanda tangan sama): persetujuan memakai tanggal pilihan penulis (bila ada), bukan saat menyetujui; penolakan tidak menghapus tanggal.
--   * sg_berita_hapus ikut ditulis ulang tanpa perubahan (satu blok).
-- TIDAK menghapus data dan TIDAK mengubah tabel. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regprocedure('public.sg_berita_lagi(int)') is null then
    raise exception 'Jalankan lebih dulu migrasi 2026-09-berita-lagi.sql (lihat README), baru migrasi ini.';
  end if;
end $$;

${aksi}

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-09-tanggal-terbit-berita', kepala);
