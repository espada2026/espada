-- ============================================================================
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

-- ===== Berita =====
-- p_id null = tulis baru. p_status: 'draf' (hanya penulis melihat lewat menu Kelola Beranda), 'menunggu' (diajukan ke Pembina), atau
-- 'terbit' (HANYA Pembina/Admin Gudep; p_terbit_pada boleh masa depan untuk menjadwalkan). Mengubah baris yang sudah 'terbit' juga hanya
-- Pembina/Admin Gudep. Mengembalikan id baris.
create or replace function public.sg_berita_simpan(p_id bigint, p_kategori text, p_judul text, p_ringkasan text, p_isi text, p_sampul_url text, p_status text, p_terbit_pada timestamptz) returns bigint
language plpgsql security definer set search_path = public as
$$
declare
  v_judul text := sigarda.rapikan(p_judul); v_ringkasan text := sigarda.rapikan(p_ringkasan); v_isi text := sigarda.rapikan_paragraf(p_isi);
  v_sampul text := sigarda.rapikan(p_sampul_url); v_status text := coalesce(p_status, 'draf'); v_lama public.beranda_berita; v_id bigint;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pengurus() then raise exception 'Hanya pengurus (Pembina, Admin Gudep, dan Dewan Ambalan) yang dapat menulis berita.'; end if;
  if p_kategori not in ('kegiatan', 'pengumuman', 'lainnya') then raise exception 'Kategori berita tidak dikenal.'; end if;
  if char_length(v_judul) < 1 or char_length(v_judul) > 150 then raise exception 'Judul berita wajib diisi, maksimal 150 karakter.'; end if;
  if char_length(v_ringkasan) > 200 then raise exception 'Ringkasan berita maksimal 200 karakter.'; end if;
  if char_length(v_isi) < 1 or char_length(v_isi) > 4000 then raise exception 'Isi berita wajib diisi, maksimal 4000 karakter.'; end if;
  if v_sampul <> '' and v_sampul !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#][^ ]*)?$' then raise exception 'Gambar sampul harus diawali https:// dan berupa alamat yang sah.'; end if;
  if v_status not in ('draf', 'menunggu', 'terbit') then raise exception 'Status berita tidak sah.'; end if;
  if v_status = 'terbit' and not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat menerbitkan berita.'; end if;
  if p_terbit_pada is not null and (p_terbit_pada < timestamptz '2015-01-01 00:00:00+07' or p_terbit_pada > now() + interval '366 days') then
    raise exception 'Tanggal terbit tidak sah (paling awal 2015, paling jauh satu tahun ke depan).';
  end if;

  if p_id is not null then
    select * into v_lama from public.beranda_berita where id = p_id;
    if v_lama.id is null then raise exception 'Berita tidak ditemukan.'; end if;
    if not sigarda.beranda_konten_boleh_ubah(v_lama.dibuat_oleh, v_lama.status) then
      raise exception 'Anda hanya dapat mengubah berita sendiri yang belum terbit; berita yang sudah terbit hanya diubah Pembina atau Admin Gudep.';
    end if;
    update public.beranda_berita set kategori = p_kategori, judul = v_judul, ringkasan = v_ringkasan, isi = v_isi, sampul_url = v_sampul,
        status = v_status, terbit_pada = case when v_status = 'terbit' then coalesce(p_terbit_pada, now()) else p_terbit_pada end,
        catatan_tinjauan = case when v_status = 'ditolak' then catatan_tinjauan else '' end, diubah_pada = now()
      where id = p_id returning id into v_id;
  else
    insert into public.beranda_berita (kategori, judul, ringkasan, isi, sampul_url, status, terbit_pada, dibuat_oleh, dibuat_oleh_nama)
      values (p_kategori, v_judul, v_ringkasan, v_isi, v_sampul, v_status, case when v_status = 'terbit' then coalesce(p_terbit_pada, now()) else p_terbit_pada end, auth.uid(), sigarda.nama_saya())
      returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.sg_berita_hapus(p_id bigint) returns void language plpgsql security definer set search_path = public as
$$
declare v_lama public.beranda_berita;
begin
  perform sigarda.wajib_aktif();
  select * into v_lama from public.beranda_berita where id = p_id;
  if v_lama.id is null then raise exception 'Berita tidak ditemukan.'; end if;
  if not sigarda.beranda_konten_boleh_ubah(v_lama.dibuat_oleh, v_lama.status) then
    raise exception 'Anda hanya dapat menghapus berita sendiri yang belum terbit; berita yang sudah terbit hanya dihapus Pembina atau Admin Gudep.';
  end if;
  delete from public.beranda_berita where id = p_id;
end $$;

-- Meninjau pengajuan ('menunggu' saja); p_keputusan 'terbit' menerbitkan seketika, 'ditolak' wajib catatan (minimal 5 karakter).
create or replace function public.sg_berita_tinjau(p_id bigint, p_keputusan text, p_catatan text) returns void language plpgsql security definer set search_path = public as
$$
declare v_catatan text := sigarda.rapikan(p_catatan); v_ada boolean;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat meninjau berita.'; end if;
  if p_keputusan not in ('terbit', 'ditolak') then raise exception 'Keputusan harus terbit atau ditolak.'; end if;
  if p_keputusan = 'ditolak' and char_length(v_catatan) < 5 then raise exception 'Alasan penolakan wajib diisi, minimal 5 karakter.'; end if;
  select true into v_ada from public.beranda_berita where id = p_id and status = 'menunggu';
  if v_ada is null then raise exception 'Pengajuan berita tidak ditemukan atau sudah ditinjau.'; end if;
  update public.beranda_berita set status = p_keputusan, terbit_pada = case when p_keputusan = 'terbit' then coalesce(terbit_pada, now()) else terbit_pada end,
      catatan_tinjauan = case when p_keputusan = 'ditolak' then v_catatan else '' end,
      ditinjau_oleh = auth.uid(), ditinjau_oleh_nama = sigarda.nama_saya(), ditinjau_pada = now(), diubah_pada = now()
    where id = p_id;
end $$;
-- ===== akhir berita =====

commit;
notify pgrst, 'reload schema';
