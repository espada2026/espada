// Menyusun supabase/migrasi/2026-09-berita-publik.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-09-berita-publik.mjs
import { ambil, gantiFungsi, tulisMigrasi } from './bantu.mjs';

const aksi = gantiFungsi(ambil('-- ===== Kelola Beranda: arsip berita publik (Fase 4): aksi =====', '-- ===== akhir arsip berita publik =====', true));

const kepala = `-- ============================================================================
-- MIGRASI: Fase 4 landing page -- arsip berita publik untuk halaman berita statis dan sitemap. AMAN untuk database berisi data.
--
-- Jalankan SETELAH migrasi 2026-09-beranda-konten.sql (bila belum, berhenti dengan pesan yang menuntun). Isi:
--   * Fungsi baru sg_berita_publik() (dapat dipanggil TANPA login, hanya membaca): semua berita terbit yang sudah waktunya, terbaru dulu, paling banyak 200,
--     berisi id, kategori, judul, ringkasan, isi, sampulUrl, terbitPada, diubahPada SAJA (tanpa penulis, peninjau, atau catatan tinjauan).
--     Dipakai build situs (GitHub Actions) untuk membuat satu halaman statis per berita dan sitemap.
-- TIDAK menghapus data dan TIDAK mengubah tabel/fungsi lain. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regclass('public.beranda_berita') is null or to_regprocedure('public.sg_berita_tinjau(bigint, text, text)') is null then
    raise exception 'Jalankan lebih dulu migrasi 2026-09-beranda-konten.sql (lihat README), baru migrasi ini.';
  end if;
end $$;

${aksi}

revoke all on function public.sg_berita_publik() from public, anon, authenticated;
grant execute on function public.sg_berita_publik() to anon, authenticated;

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-09-berita-publik', kepala);
