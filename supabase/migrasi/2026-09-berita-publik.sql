-- ============================================================================
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

-- ===== Kelola Beranda: arsip berita publik (Fase 4): aksi =====
-- Semua berita TERBIT yang sudah waktunya (terbit_pada <= sekarang), terbaru dulu, paling banyak 200, TANPA login (hanya membaca). Dipakai build situs untuk
-- membuat satu halaman statis per berita (alamat tetap berdasarkan id, terbaca mesin pencari) dan sitemap; sg_beranda_publik hanya memuat 6 terbaru tanpa id.
-- Kolom: id, kategori, judul, ringkasan, isi, sampulUrl, terbitPada, diubahPada SAJA (tanpa penulis, peninjau, catatan tinjauan, atau status).
create or replace function public.sg_berita_publik() returns jsonb
language sql stable security definer set search_path = public as
$$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'kategori', b.kategori, 'judul', b.judul, 'ringkasan', b.ringkasan, 'isi', b.isi, 'sampulUrl', b.sampul_url,
    'terbitPada', b.terbit_pada, 'diubahPada', b.diubah_pada) order by b.terbit_pada desc, b.id desc), '[]'::jsonb)
  from (select id, kategori, judul, ringkasan, isi, sampul_url, terbit_pada, diubah_pada from public.beranda_berita
        where status = 'terbit' and terbit_pada <= now() order by terbit_pada desc, id desc limit 200) b
$$;
-- ===== akhir arsip berita publik =====

revoke all on function public.sg_berita_publik() from public, anon, authenticated;
grant execute on function public.sg_berita_publik() to anon, authenticated;

commit;
notify pgrst, 'reload schema';
