// Menyusun supabase/migrasi/2026-09-berita-lagi.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-09-berita-lagi.mjs
import { ambil, gantiFungsi, tulisMigrasi } from './bantu.mjs';

const aksi = gantiFungsi(ambil('-- ===== Kelola Beranda: berita lebih lama (tombol "Muat berita lebih lama"): aksi =====', '-- ===== akhir berita lebih lama =====', true));

const kepala = `-- ============================================================================
-- MIGRASI: landing page -- tombol "Muat berita lebih lama" di beranda. AMAN untuk database berisi data.
--
-- Jalankan SETELAH migrasi 2026-09-berita-publik.sql (bila belum, berhenti dengan pesan yang menuntun). Isi:
--   * Fungsi baru sg_berita_lagi(p_lewati int) (dapat dipanggil TANPA login, hanya membaca): 6 berita terbit berikutnya sesudah p_lewati berita terbaru,
--     berisi kategori, judul, ringkasan, isi, sampulUrl, terbitPada SAJA, ditambah 'adaLagi' (masih ada yang lebih lama). Beranda tetap memuat 6 berita
--     terbaru lewat sg_beranda_publik; sisanya diminta pengunjung satu gelombang demi satu gelombang.
-- TIDAK menghapus data dan TIDAK mengubah tabel/fungsi lain. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regprocedure('public.sg_berita_publik()') is null then
    raise exception 'Jalankan lebih dulu migrasi 2026-09-berita-publik.sql (lihat README), baru migrasi ini.';
  end if;
end $$;

${aksi}

revoke all on function public.sg_berita_lagi(int) from public, anon, authenticated;
grant execute on function public.sg_berita_lagi(int) to anon, authenticated;

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-09-berita-lagi', kepala);
