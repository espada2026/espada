// Menyusun supabase/migrasi/2026-09-muat-lebih-lama.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-09-muat-lebih-lama.mjs
import { ambil, gantiFungsi, tulisMigrasi } from './bantu.mjs';

// sg_beranda_publik ditulis ulang (tanda tangan sama): prestasi dan galeri kini dibatasi 6 terbaru (sebelumnya semua).
const publik = gantiFungsi(ambil('create function public.sg_beranda_publik()', 'end $$;', true));
const lagi = gantiFungsi(ambil('-- ===== Kelola Beranda: prestasi, galeri, dan media sosial lebih lama (tombol "Muat ... lebih lama"): aksi =====', '-- ===== akhir sisa lebih lama =====', true));

const kepala = `-- ============================================================================
-- MIGRASI: landing page -- Prestasi, Galeri, dan Media Sosial berperilaku seperti Berita (6 terbaru + tombol "Muat ... lebih lama").
-- AMAN untuk database berisi data.
--
-- Jalankan SETELAH migrasi 2026-09-berita-lagi.sql (bila belum, berhenti dengan pesan yang menuntun). Isi:
--   * sg_beranda_publik() ditulis ulang (tanda tangan sama): prestasi dan galeri kini paling banyak 6 yang terbaru (sebelumnya semua yang terbit);
--     prestasi menurut tahun (terbaru dulu), galeri menurut waktu dibuat (terbaru dulu). Berita, media sosial, agenda, dan isi lain TIDAK berubah.
--   * Fungsi baru sg_prestasi_lagi(p_lewati int), sg_galeri_lagi(p_lewati int), dan sg_sosial_lagi(p_lewati int) (dapat dipanggil TANPA login, hanya membaca):
--     6 berikutnya sesudah p_lewati yang sudah tampil, ditambah 'adaLagi'. Kolom sama dengan yang sudah tampil di beranda (whitelist, tanpa penulis atau catatan).
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

${publik}

${lagi}

revoke all on function public.sg_beranda_publik(), public.sg_prestasi_lagi(int), public.sg_galeri_lagi(int), public.sg_sosial_lagi(int) from public, anon, authenticated;
grant execute on function public.sg_beranda_publik(), public.sg_prestasi_lagi(int), public.sg_galeri_lagi(int), public.sg_sosial_lagi(int) to anon, authenticated;

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-09-muat-lebih-lama', kepala);
