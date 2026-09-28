-- ============================================================================
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

-- ===== Kelola Beranda: berita lebih lama (tombol "Muat berita lebih lama"): aksi =====
-- Halaman muka menampilkan 6 berita terbaru (sg_beranda_publik). Fungsi ini memberi 6 berita TERBIT berikutnya sesudah p_lewati berita terbaru (yang sudah
-- tampil), TANPA login (hanya membaca), bentuk kolom sama dengan berita pada sg_beranda_publik (tanpa id, penulis, peninjau, atau catatan tinjauan).
-- 'adaLagi' = masih ada berita yang lebih lama lagi (dibaca 7 baris, yang ke-7 tidak dikirim). p_lewati dibatasi 0..1000 supaya tak dapat dipakai memindai tanpa batas.
create or replace function public.sg_berita_lagi(p_lewati int) returns jsonb
language sql stable security definer set search_path = public as
$$
  select jsonb_build_object(
    'berita', coalesce(jsonb_agg(jsonb_build_object('kategori', x.kategori, 'judul', x.judul, 'ringkasan', x.ringkasan, 'isi', x.isi, 'sampulUrl', x.sampul_url,
      'terbitPada', x.terbit_pada) order by x.urut) filter (where x.urut <= 6), '[]'::jsonb),
    'adaLagi', coalesce(bool_or(x.urut > 6), false))
  from (
    select b.kategori, b.judul, b.ringkasan, b.isi, b.sampul_url, b.terbit_pada, row_number() over (order by b.terbit_pada desc, b.id desc) as urut
    from (select id, kategori, judul, ringkasan, isi, sampul_url, terbit_pada from public.beranda_berita
          where status = 'terbit' and terbit_pada <= now() order by terbit_pada desc, id desc
          offset least(greatest(coalesce(p_lewati, 0), 0), 1000) limit 7) b
  ) x
$$;
-- ===== akhir berita lebih lama =====

revoke all on function public.sg_berita_lagi(int) from public, anon, authenticated;
grant execute on function public.sg_berita_lagi(int) to anon, authenticated;

commit;
notify pgrst, 'reload schema';
