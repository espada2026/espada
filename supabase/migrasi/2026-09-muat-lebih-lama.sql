-- ============================================================================
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

create or replace function public.sg_beranda_publik() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare
  v_g jsonb := coalesce((select nilai from public.pengaturan where kunci = 'gudep.data'), '{}'::jsonb);
  v_k jsonb := coalesce((select nilai from public.pengaturan where kunci = 'beranda.kontak'), '{}'::jsonb);
begin
  return jsonb_build_object(
    'gudep', jsonb_strip_nulls(jsonb_build_object('nama', v_g -> 'nama', 'singkat', v_g -> 'singkat', 'sekolah', v_g -> 'sekolah', 'kota', v_g -> 'kota',
      'alamat', v_g -> 'alamat', 'nomorGudep', v_g -> 'nomorGudep', 'kwarran', v_g -> 'kwarran', 'kwarcab', v_g -> 'kwarcab')),
    'pembina', jsonb_strip_nulls(jsonb_build_object('jabatan', v_g #> '{pembina,jabatan}', 'nama', v_g #> '{pembina,nama}')),
    'kamabigus', jsonb_strip_nulls(jsonb_build_object('jabatan', v_g #> '{kamabigus,jabatan}', 'nama', v_g #> '{kamabigus,nama}')),
    'kontak', v_k
      || jsonb_build_object('email', coalesce(nullif(v_k ->> 'email', ''), v_g ->> 'email', ''), 'telepon', coalesce(nullif(v_k ->> 'telepon', ''), v_g ->> 'telepon', '')),
    'agenda', coalesce((
      select jsonb_agg(jsonb_build_object('jenis', a.jenis, 'judul', a.judul, 'tanggal', a.tanggal) order by a.tanggal, a.id)
      from (select id, jenis, judul, tanggal from public.agenda where tanggal >= sigarda.hari_ini() order by tanggal, id limit 6) a
    ), '[]'::jsonb),
    'berita', coalesce((
      select jsonb_agg(jsonb_build_object('kategori', b.kategori, 'judul', b.judul, 'ringkasan', b.ringkasan, 'isi', b.isi, 'sampulUrl', b.sampul_url, 'terbitPada', b.terbit_pada) order by b.terbit_pada desc, b.id desc)
      from (select id, kategori, judul, ringkasan, isi, sampul_url, terbit_pada from public.beranda_berita where status = 'terbit' and terbit_pada <= now() order by terbit_pada desc, id desc limit 6) b
    ), '[]'::jsonb),
    'prestasi', coalesce((
      select jsonb_agg(jsonb_build_object('judul', p.judul, 'tingkat', p.tingkat, 'peringkat', p.peringkat, 'tahun', p.tahun, 'diraihOleh', p.diraih_oleh, 'fotoUrl', p.foto_url) order by p.tahun desc, p.id desc)
      from (select id, judul, tingkat, peringkat, tahun, diraih_oleh, foto_url from public.beranda_prestasi where status = 'terbit' order by tahun desc, id desc limit 6) p
    ), '[]'::jsonb),
    'galeri', coalesce((
      select jsonb_agg(jsonb_build_object('judul', g.judul, 'tautan', g.tautan, 'sampulUrl', g.sampul_url, 'kelompok', g.kelompok) order by g.dibuat_pada desc, g.id desc)
      from (select id, judul, tautan, sampul_url, kelompok, dibuat_pada from public.beranda_galeri where status = 'terbit' order by dibuat_pada desc, id desc limit 6) g
    ), '[]'::jsonb),
    'sosial', coalesce((
      select jsonb_agg(jsonb_build_object('platform', s.platform, 'tautan', s.tautan, 'keterangan', s.keterangan, 'gambarUrl', s.gambar_url) order by s.dibuat_pada desc, s.id desc)
      from (select id, platform, tautan, keterangan, gambar_url, dibuat_pada from public.beranda_sosial where tampil order by dibuat_pada desc, id desc limit 6) s
    ), '[]'::jsonb),
    'faq', coalesce((
      select jsonb_agg(jsonb_build_object('pertanyaan', f.pertanyaan, 'jawaban', f.jawaban) order by f.urutan, f.id)
      from public.beranda_faq f
    ), '[]'::jsonb)
  );
end $$;

-- ===== Kelola Beranda: prestasi, galeri, dan media sosial lebih lama (tombol "Muat ... lebih lama"): aksi =====
-- Sama dengan sg_berita_lagi: halaman muka menampilkan 6 yang terbaru (sg_beranda_publik); fungsi-fungsi ini memberi 6 berikutnya sesudah p_lewati yang sudah
-- tampil, TANPA login (hanya membaca), kolom sama dengan yang di sg_beranda_publik (tanpa id, penulis, peninjau, atau catatan tinjauan). 'adaLagi' = masih ada yang
-- lebih lama (dibaca 7 baris, yang ke-7 tidak dikirim). p_lewati dibatasi 0..1000. Urutan SAMA dengan sg_beranda_publik: prestasi menurut tahun (lalu id) terbaru dulu,
-- galeri dan media sosial menurut waktu dibuat terbaru dulu.
create or replace function public.sg_prestasi_lagi(p_lewati int) returns jsonb
language sql stable security definer set search_path = public as
$$
  select jsonb_build_object(
    'prestasi', coalesce(jsonb_agg(jsonb_build_object('judul', x.judul, 'tingkat', x.tingkat, 'peringkat', x.peringkat, 'tahun', x.tahun, 'diraihOleh', x.diraih_oleh,
      'fotoUrl', x.foto_url) order by x.urut) filter (where x.urut <= 6), '[]'::jsonb),
    'adaLagi', coalesce(bool_or(x.urut > 6), false))
  from (
    select p.judul, p.tingkat, p.peringkat, p.tahun, p.diraih_oleh, p.foto_url, row_number() over (order by p.tahun desc, p.id desc) as urut
    from (select id, judul, tingkat, peringkat, tahun, diraih_oleh, foto_url from public.beranda_prestasi
          where status = 'terbit' order by tahun desc, id desc
          offset least(greatest(coalesce(p_lewati, 0), 0), 1000) limit 7) p
  ) x
$$;
create or replace function public.sg_galeri_lagi(p_lewati int) returns jsonb
language sql stable security definer set search_path = public as
$$
  select jsonb_build_object(
    'galeri', coalesce(jsonb_agg(jsonb_build_object('judul', x.judul, 'tautan', x.tautan, 'sampulUrl', x.sampul_url, 'kelompok', x.kelompok) order by x.urut)
      filter (where x.urut <= 6), '[]'::jsonb),
    'adaLagi', coalesce(bool_or(x.urut > 6), false))
  from (
    select g.judul, g.tautan, g.sampul_url, g.kelompok, row_number() over (order by g.dibuat_pada desc, g.id desc) as urut
    from (select id, judul, tautan, sampul_url, kelompok, dibuat_pada from public.beranda_galeri
          where status = 'terbit' order by dibuat_pada desc, id desc
          offset least(greatest(coalesce(p_lewati, 0), 0), 1000) limit 7) g
  ) x
$$;
create or replace function public.sg_sosial_lagi(p_lewati int) returns jsonb
language sql stable security definer set search_path = public as
$$
  select jsonb_build_object(
    'sosial', coalesce(jsonb_agg(jsonb_build_object('platform', x.platform, 'tautan', x.tautan, 'keterangan', x.keterangan, 'gambarUrl', x.gambar_url) order by x.urut)
      filter (where x.urut <= 6), '[]'::jsonb),
    'adaLagi', coalesce(bool_or(x.urut > 6), false))
  from (
    select s.platform, s.tautan, s.keterangan, s.gambar_url, row_number() over (order by s.dibuat_pada desc, s.id desc) as urut
    from (select id, platform, tautan, keterangan, gambar_url, dibuat_pada from public.beranda_sosial
          where tampil order by dibuat_pada desc, id desc
          offset least(greatest(coalesce(p_lewati, 0), 0), 1000) limit 7) s
  ) x
$$;
-- ===== akhir sisa lebih lama =====

revoke all on function public.sg_beranda_publik(), public.sg_prestasi_lagi(int), public.sg_galeri_lagi(int), public.sg_sosial_lagi(int) from public, anon, authenticated;
grant execute on function public.sg_beranda_publik(), public.sg_prestasi_lagi(int), public.sg_galeri_lagi(int), public.sg_sosial_lagi(int) to anon, authenticated;

commit;
notify pgrst, 'reload schema';
