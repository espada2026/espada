-- ============================================================================
-- MIGRASI: Fase 2 landing page -- Kelola Beranda: konten (Berita, Prestasi, Galeri, Media Sosial, Pertanyaan Umum). AMAN untuk database berisi data.
--
-- Jalankan SETELAH migrasi 2026-09-beranda.sql (bila belum, berhenti dengan pesan yang menuntun). Isi:
--   * 5 tabel baru: beranda_berita, beranda_prestasi, beranda_galeri (alur tinjauan: Dewan mengajukan, Pembina/Admin menerbitkan atau meninjau),
--     beranda_sosial (tanpa alur, langsung tampil), beranda_faq (hanya Pembina dan Admin Gudep). RLS baca: pengurus; tulis hanya lewat fungsi.
--   * Fungsi baru: sg_berita_simpan/_hapus/_tinjau, sg_prestasi_simpan/_hapus/_tinjau, sg_galeri_simpan/_hapus/_tinjau, sg_sosial_simpan/_hapus,
--     sg_faq_simpan/_hapus/_geser, dan fungsi bantu sigarda.beranda_konten_boleh_ubah, sigarda.nama_saya.
--   * sg_beranda_publik() ditulis ulang (tanda tangan sama): kini juga memuat berita, prestasi, galeri, sosial, dan faq yang TERBIT (whitelist ketat,
--     tanpa data anggota, tanpa catatan tinjauan, tanpa siapa yang menulis/meninjau).
--   * sg_cadangan_admin() ditulis ulang (tanda tangan sama): kelima tabel baru ditambahkan ke cadangan data Admin Gudep.
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regprocedure('public.sg_beranda_kontak_simpan(jsonb)') is null then
    raise exception 'Jalankan lebih dulu migrasi 2026-09-beranda.sql (lihat README), baru migrasi ini.';
  end if;
end $$;

-- ===== Kelola Beranda (Fase 2 landing page): tabel =====
-- Isi halaman muka yang dikelola pengurus lewat menu Kelola Beranda. Berita, Prestasi, dan Galeri memakai alur tinjauan yang sama: Dewan
-- Ambalan hanya menulis draf atau mengajukan ('menunggu'); Pembina dan Admin Gudep dapat menerbitkan langsung atau meninjau pengajuan Dewan
-- (menyetujui = 'terbit', menolak = 'ditolak' dengan catatan wajib). Media sosial dan pertanyaan umum tanpa alur tinjauan (lihat catatan
-- masing-masing tabel). Semua ditulis HANYA lewat fungsi sg_* (lihat 586-aksi-beranda-konten.sql); dibaca lewat sg_beranda_publik (hanya yang
-- berstatus 'terbit') dan menu Kelola Beranda (pengurus, semua status).
create table if not exists public.beranda_berita (
  id bigint generated always as identity primary key,
  kategori text not null default 'kegiatan' check (kategori in ('kegiatan', 'pengumuman', 'lainnya')),
  judul text not null check (char_length(btrim(judul)) between 1 and 150),
  ringkasan text not null default '' check (char_length(ringkasan) <= 200),
  isi text not null check (char_length(btrim(isi)) between 1 and 4000),
  sampul_url text not null default '' check (sampul_url = '' or sampul_url ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#][^ ]*)?$'),
  status text not null default 'draf' check (status in ('draf', 'menunggu', 'terbit', 'ditolak')),
  terbit_pada timestamptz,  -- kapan tampil publik; boleh masa depan (terjadwal). Null selama belum berstatus terbit.
  catatan_tinjauan text not null default '' check (char_length(catatan_tinjauan) <= 500),
  dibuat_oleh uuid references public.profiles(id) on delete set null,
  dibuat_oleh_nama text not null default '',
  dibuat_pada timestamptz not null default now(),
  ditinjau_oleh uuid references public.profiles(id) on delete set null,
  ditinjau_oleh_nama text not null default '',
  ditinjau_pada timestamptz,
  diubah_pada timestamptz not null default now(),
  constraint beranda_berita_tolak_wajib_catatan check (status <> 'ditolak' or char_length(btrim(catatan_tinjauan)) >= 5)
);
create index if not exists beranda_berita_status_idx on public.beranda_berita (status, terbit_pada desc);

create table if not exists public.beranda_prestasi (
  id bigint generated always as identity primary key,
  judul text not null check (char_length(btrim(judul)) between 1 and 150),
  tingkat text not null check (tingkat in ('gudep', 'ranting', 'cabang', 'provinsi', 'nasional')),
  peringkat text not null check (char_length(btrim(peringkat)) between 1 and 60),
  tahun int not null check (tahun between 2000 and 2100),
  diraih_oleh text not null check (char_length(btrim(diraih_oleh)) between 1 and 150),  -- nama regu/tim/gudep; BUKAN nama perorangan tanpa izin
  foto_url text not null default '' check (foto_url = '' or foto_url ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#][^ ]*)?$'),
  status text not null default 'draf' check (status in ('draf', 'menunggu', 'terbit', 'ditolak')),
  catatan_tinjauan text not null default '' check (char_length(catatan_tinjauan) <= 500),
  dibuat_oleh uuid references public.profiles(id) on delete set null,
  dibuat_oleh_nama text not null default '',
  dibuat_pada timestamptz not null default now(),
  ditinjau_oleh uuid references public.profiles(id) on delete set null,
  ditinjau_oleh_nama text not null default '',
  ditinjau_pada timestamptz,
  diubah_pada timestamptz not null default now(),
  constraint beranda_prestasi_tolak_wajib_catatan check (status <> 'ditolak' or char_length(btrim(catatan_tinjauan)) >= 5)
);
create index if not exists beranda_prestasi_status_idx on public.beranda_prestasi (status, tahun desc);

-- Album (tautan Google Drive atau Google Photos; foto sendiri tidak disimpan di aplikasi). Sampul opsional: bila kosong, beranda hanya
-- menampilkan kartu bertajuk tanpa gambar (lihat catatan kejujuran di memori proyek: Google Photos umumnya tidak memberi alamat gambar
-- yang bisa dipasang langsung).
create table if not exists public.beranda_galeri (
  id bigint generated always as identity primary key,
  judul text not null check (char_length(btrim(judul)) between 1 and 100),
  tautan text not null check (tautan ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#][^ ]*)?$'),
  sampul_url text not null default '' check (sampul_url = '' or sampul_url ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#][^ ]*)?$'),
  kelompok text not null default 'lainnya' check (kelompok in ('latihan', 'perkemahan', 'pelantikan', 'lainnya')),
  status text not null default 'draf' check (status in ('draf', 'menunggu', 'terbit', 'ditolak')),
  catatan_tinjauan text not null default '' check (char_length(catatan_tinjauan) <= 500),
  dibuat_oleh uuid references public.profiles(id) on delete set null,
  dibuat_oleh_nama text not null default '',
  dibuat_pada timestamptz not null default now(),
  ditinjau_oleh uuid references public.profiles(id) on delete set null,
  ditinjau_oleh_nama text not null default '',
  ditinjau_pada timestamptz,
  diubah_pada timestamptz not null default now(),
  constraint beranda_galeri_tolak_wajib_catatan check (status <> 'ditolak' or char_length(btrim(catatan_tinjauan)) >= 5)
);
create index if not exists beranda_galeri_status_idx on public.beranda_galeri (status, dibuat_pada desc);

-- Kiriman media sosial: kartu tautan dengan pratinjau (BUKAN sematan resmi, lihat keputusan pemilik di memori proyek). SEMUA pengurus dapat
-- menempel dan langsung tampil (tanpa alur tinjauan); `tampil` untuk menyembunyikan tanpa menghapus.
create table if not exists public.beranda_sosial (
  id bigint generated always as identity primary key,
  platform text not null check (platform in ('instagram', 'youtube', 'facebook', 'tiktok')),
  tautan text not null check (tautan ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#][^ ]*)?$'),
  keterangan text not null default '' check (char_length(keterangan) <= 200),
  gambar_url text not null default '' check (gambar_url = '' or gambar_url ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#][^ ]*)?$'),
  tampil boolean not null default true,
  dibuat_oleh uuid references public.profiles(id) on delete set null,
  dibuat_oleh_nama text not null default '',
  dibuat_pada timestamptz not null default now(),
  diubah_pada timestamptz not null default now()
);
create index if not exists beranda_sosial_tampil_idx on public.beranda_sosial (tampil, dibuat_pada desc);

-- Pertanyaan umum di beranda: HANYA Pembina dan Admin Gudep (Dewan Ambalan tidak, beda dari Berita/Prestasi/Galeri). Beranda memakai daftar
-- bawaan (src/landing/landingData.js) selama tabel ini kosong.
create table if not exists public.beranda_faq (
  id bigint generated always as identity primary key,
  pertanyaan text not null check (char_length(btrim(pertanyaan)) between 1 and 200),
  jawaban text not null check (char_length(btrim(jawaban)) between 1 and 1000),
  urutan int not null default 0,
  diubah_oleh uuid references public.profiles(id) on delete set null,
  diubah_pada timestamptz not null default now()
);
create index if not exists beranda_faq_urutan_idx on public.beranda_faq (urutan);
-- ===== akhir tabel beranda konten =====

alter table public.beranda_berita enable row level security;
alter table public.beranda_prestasi enable row level security;
alter table public.beranda_galeri enable row level security;
alter table public.beranda_sosial enable row level security;
alter table public.beranda_faq enable row level security;
-- Tabel baru menerima hak penuh bawaan Supabase: dicabut agar sama dengan database baru (baca saja lewat kebijakan; tulis hanya lewat fungsi).
revoke all on public.beranda_berita, public.beranda_prestasi, public.beranda_galeri, public.beranda_sosial, public.beranda_faq from anon, authenticated;
grant select on public.beranda_berita, public.beranda_prestasi, public.beranda_galeri, public.beranda_sosial, public.beranda_faq to authenticated;
-- ===== Kelola Beranda (Fase 2 landing page): kebijakan =====
-- Isi lengkap (semua status) hanya dibaca pengurus (menu Kelola Beranda); publik membaca lewat sg_beranda_publik (hanya berstatus terbit).
drop policy if exists baca_beranda_berita on public.beranda_berita;
create policy baca_beranda_berita on public.beranda_berita for select to authenticated using ((select sigarda.pengurus()));
drop policy if exists baca_beranda_prestasi on public.beranda_prestasi;
create policy baca_beranda_prestasi on public.beranda_prestasi for select to authenticated using ((select sigarda.pengurus()));
drop policy if exists baca_beranda_galeri on public.beranda_galeri;
create policy baca_beranda_galeri on public.beranda_galeri for select to authenticated using ((select sigarda.pengurus()));
drop policy if exists baca_beranda_sosial on public.beranda_sosial;
create policy baca_beranda_sosial on public.beranda_sosial for select to authenticated using ((select sigarda.pengurus()));
drop policy if exists baca_beranda_faq on public.beranda_faq;
create policy baca_beranda_faq on public.beranda_faq for select to authenticated using ((select sigarda.pengurus()));
-- ===== akhir kebijakan beranda konten =====

-- ===== Kelola Beranda (Fase 2 landing page): aksi =====
-- Berita, Prestasi, dan Galeri berbagi alur tinjauan yang sama (lihat catatan di 28-tabel-beranda-konten.sql). Fungsi bantu ini hanya
-- menentukan siapa boleh MENGUBAH atau MENGHAPUS satu baris: Pembina dan Admin Gudep kapan saja; penulisnya sendiri selama belum terbit
-- (draf, menunggu, atau ditolak -- termasuk membatalkan pengajuan sendiri).
create or replace function sigarda.beranda_konten_boleh_ubah(p_dibuat_oleh uuid, p_status text) returns boolean
language sql stable security definer set search_path = public as
$$ select sigarda.pembina_atau_admin() or (p_dibuat_oleh = auth.uid() and p_status in ('draf', 'menunggu', 'ditolak')) $$;

-- Nama pengguna saat ini, dirapikan (disalin ke kolom *_nama karena Penegak tak selalu dapat membaca profil pengurus lain di tampilan Dewan lama).
create or replace function sigarda.nama_saya() returns text language sql stable security definer set search_path = public as
$$ select sigarda.rapikan((select nama from public.profiles where id = auth.uid())) $$;

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

  if p_id is not null then
    select * into v_lama from public.beranda_berita where id = p_id;
    if v_lama.id is null then raise exception 'Berita tidak ditemukan.'; end if;
    if not sigarda.beranda_konten_boleh_ubah(v_lama.dibuat_oleh, v_lama.status) then
      raise exception 'Anda hanya dapat mengubah berita sendiri yang belum terbit; berita yang sudah terbit hanya diubah Pembina atau Admin Gudep.';
    end if;
    update public.beranda_berita set kategori = p_kategori, judul = v_judul, ringkasan = v_ringkasan, isi = v_isi, sampul_url = v_sampul,
        status = v_status, terbit_pada = case when v_status = 'terbit' then coalesce(p_terbit_pada, now()) else null end,
        catatan_tinjauan = case when v_status = 'ditolak' then catatan_tinjauan else '' end, diubah_pada = now()
      where id = p_id returning id into v_id;
  else
    insert into public.beranda_berita (kategori, judul, ringkasan, isi, sampul_url, status, terbit_pada, dibuat_oleh, dibuat_oleh_nama)
      values (p_kategori, v_judul, v_ringkasan, v_isi, v_sampul, v_status, case when v_status = 'terbit' then coalesce(p_terbit_pada, now()) else null end, auth.uid(), sigarda.nama_saya())
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
  update public.beranda_berita set status = p_keputusan, terbit_pada = case when p_keputusan = 'terbit' then now() else null end,
      catatan_tinjauan = case when p_keputusan = 'ditolak' then v_catatan else '' end,
      ditinjau_oleh = auth.uid(), ditinjau_oleh_nama = sigarda.nama_saya(), ditinjau_pada = now(), diubah_pada = now()
    where id = p_id;
end $$;
-- ===== akhir berita =====

-- ===== Prestasi =====
create or replace function public.sg_prestasi_simpan(p_id bigint, p_judul text, p_tingkat text, p_peringkat text, p_tahun int, p_diraih_oleh text, p_foto_url text, p_status text) returns bigint
language plpgsql security definer set search_path = public as
$$
declare
  v_judul text := sigarda.rapikan(p_judul); v_peringkat text := sigarda.rapikan(p_peringkat); v_diraih text := sigarda.rapikan(p_diraih_oleh);
  v_foto text := sigarda.rapikan(p_foto_url); v_status text := coalesce(p_status, 'draf'); v_lama public.beranda_prestasi; v_id bigint;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pengurus() then raise exception 'Hanya pengurus (Pembina, Admin Gudep, dan Dewan Ambalan) yang dapat menambah prestasi.'; end if;
  if p_tingkat not in ('gudep', 'ranting', 'cabang', 'provinsi', 'nasional') then raise exception 'Tingkat prestasi tidak dikenal.'; end if;
  if char_length(v_judul) < 1 or char_length(v_judul) > 150 then raise exception 'Nama lomba atau penghargaan wajib diisi, maksimal 150 karakter.'; end if;
  if char_length(v_peringkat) < 1 or char_length(v_peringkat) > 60 then raise exception 'Peringkat wajib diisi, maksimal 60 karakter.'; end if;
  if p_tahun is null or p_tahun < 2000 or p_tahun > extract(year from sigarda.hari_ini())::int then raise exception 'Tahun tidak sah.'; end if;
  if char_length(v_diraih) < 1 or char_length(v_diraih) > 150 then raise exception 'Nama regu, tim, atau gudep yang meraih wajib diisi, maksimal 150 karakter.'; end if;
  if v_foto <> '' and v_foto !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#][^ ]*)?$' then raise exception 'Foto harus diawali https:// dan berupa alamat yang sah.'; end if;
  if v_status not in ('draf', 'menunggu', 'terbit') then raise exception 'Status prestasi tidak sah.'; end if;
  if v_status = 'terbit' and not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat menerbitkan prestasi.'; end if;

  if p_id is not null then
    select * into v_lama from public.beranda_prestasi where id = p_id;
    if v_lama.id is null then raise exception 'Prestasi tidak ditemukan.'; end if;
    if not sigarda.beranda_konten_boleh_ubah(v_lama.dibuat_oleh, v_lama.status) then
      raise exception 'Anda hanya dapat mengubah prestasi sendiri yang belum terbit; yang sudah terbit hanya diubah Pembina atau Admin Gudep.';
    end if;
    update public.beranda_prestasi set judul = v_judul, tingkat = p_tingkat, peringkat = v_peringkat, tahun = p_tahun, diraih_oleh = v_diraih,
        foto_url = v_foto, status = v_status, catatan_tinjauan = case when v_status = 'ditolak' then catatan_tinjauan else '' end, diubah_pada = now()
      where id = p_id returning id into v_id;
  else
    insert into public.beranda_prestasi (judul, tingkat, peringkat, tahun, diraih_oleh, foto_url, status, dibuat_oleh, dibuat_oleh_nama)
      values (v_judul, p_tingkat, v_peringkat, p_tahun, v_diraih, v_foto, v_status, auth.uid(), sigarda.nama_saya())
      returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.sg_prestasi_hapus(p_id bigint) returns void language plpgsql security definer set search_path = public as
$$
declare v_lama public.beranda_prestasi;
begin
  perform sigarda.wajib_aktif();
  select * into v_lama from public.beranda_prestasi where id = p_id;
  if v_lama.id is null then raise exception 'Prestasi tidak ditemukan.'; end if;
  if not sigarda.beranda_konten_boleh_ubah(v_lama.dibuat_oleh, v_lama.status) then
    raise exception 'Anda hanya dapat menghapus prestasi sendiri yang belum terbit; yang sudah terbit hanya dihapus Pembina atau Admin Gudep.';
  end if;
  delete from public.beranda_prestasi where id = p_id;
end $$;

create or replace function public.sg_prestasi_tinjau(p_id bigint, p_keputusan text, p_catatan text) returns void language plpgsql security definer set search_path = public as
$$
declare v_catatan text := sigarda.rapikan(p_catatan); v_ada boolean;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat meninjau prestasi.'; end if;
  if p_keputusan not in ('terbit', 'ditolak') then raise exception 'Keputusan harus terbit atau ditolak.'; end if;
  if p_keputusan = 'ditolak' and char_length(v_catatan) < 5 then raise exception 'Alasan penolakan wajib diisi, minimal 5 karakter.'; end if;
  select true into v_ada from public.beranda_prestasi where id = p_id and status = 'menunggu';
  if v_ada is null then raise exception 'Pengajuan prestasi tidak ditemukan atau sudah ditinjau.'; end if;
  update public.beranda_prestasi set status = p_keputusan, catatan_tinjauan = case when p_keputusan = 'ditolak' then v_catatan else '' end,
      ditinjau_oleh = auth.uid(), ditinjau_oleh_nama = sigarda.nama_saya(), ditinjau_pada = now(), diubah_pada = now()
    where id = p_id;
end $$;
-- ===== akhir prestasi =====

-- ===== Galeri =====
create or replace function public.sg_galeri_simpan(p_id bigint, p_judul text, p_tautan text, p_sampul_url text, p_kelompok text, p_status text) returns bigint
language plpgsql security definer set search_path = public as
$$
declare
  v_judul text := sigarda.rapikan(p_judul); v_tautan text := sigarda.rapikan(p_tautan); v_sampul text := sigarda.rapikan(p_sampul_url);
  v_status text := coalesce(p_status, 'draf'); v_lama public.beranda_galeri; v_id bigint;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pengurus() then raise exception 'Hanya pengurus (Pembina, Admin Gudep, dan Dewan Ambalan) yang dapat menambah album galeri.'; end if;
  if char_length(v_judul) < 1 or char_length(v_judul) > 100 then raise exception 'Nama album wajib diisi, maksimal 100 karakter.'; end if;
  if v_tautan !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#][^ ]*)?$' then raise exception 'Tautan album harus diawali https:// dan berupa alamat yang sah.'; end if;
  if v_sampul <> '' and v_sampul !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#][^ ]*)?$' then raise exception 'Sampul album harus diawali https:// dan berupa alamat yang sah.'; end if;
  if p_kelompok not in ('latihan', 'perkemahan', 'pelantikan', 'lainnya') then raise exception 'Kelompok album tidak dikenal.'; end if;
  if v_status not in ('draf', 'menunggu', 'terbit') then raise exception 'Status album tidak sah.'; end if;
  if v_status = 'terbit' and not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat menampilkan album di beranda.'; end if;

  if p_id is not null then
    select * into v_lama from public.beranda_galeri where id = p_id;
    if v_lama.id is null then raise exception 'Album tidak ditemukan.'; end if;
    if not sigarda.beranda_konten_boleh_ubah(v_lama.dibuat_oleh, v_lama.status) then
      raise exception 'Anda hanya dapat mengubah album sendiri yang belum tampil; yang sudah tampil hanya diubah Pembina atau Admin Gudep.';
    end if;
    update public.beranda_galeri set judul = v_judul, tautan = v_tautan, sampul_url = v_sampul, kelompok = p_kelompok, status = v_status,
        catatan_tinjauan = case when v_status = 'ditolak' then catatan_tinjauan else '' end, diubah_pada = now()
      where id = p_id returning id into v_id;
  else
    insert into public.beranda_galeri (judul, tautan, sampul_url, kelompok, status, dibuat_oleh, dibuat_oleh_nama)
      values (v_judul, v_tautan, v_sampul, p_kelompok, v_status, auth.uid(), sigarda.nama_saya())
      returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.sg_galeri_hapus(p_id bigint) returns void language plpgsql security definer set search_path = public as
$$
declare v_lama public.beranda_galeri;
begin
  perform sigarda.wajib_aktif();
  select * into v_lama from public.beranda_galeri where id = p_id;
  if v_lama.id is null then raise exception 'Album tidak ditemukan.'; end if;
  if not sigarda.beranda_konten_boleh_ubah(v_lama.dibuat_oleh, v_lama.status) then
    raise exception 'Anda hanya dapat menghapus album sendiri yang belum tampil; yang sudah tampil hanya dihapus Pembina atau Admin Gudep.';
  end if;
  delete from public.beranda_galeri where id = p_id;
end $$;

create or replace function public.sg_galeri_tinjau(p_id bigint, p_keputusan text, p_catatan text) returns void language plpgsql security definer set search_path = public as
$$
declare v_catatan text := sigarda.rapikan(p_catatan); v_ada boolean;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat meninjau album galeri.'; end if;
  if p_keputusan not in ('terbit', 'ditolak') then raise exception 'Keputusan harus terbit atau ditolak.'; end if;
  if p_keputusan = 'ditolak' and char_length(v_catatan) < 5 then raise exception 'Alasan penolakan wajib diisi, minimal 5 karakter.'; end if;
  select true into v_ada from public.beranda_galeri where id = p_id and status = 'menunggu';
  if v_ada is null then raise exception 'Pengajuan album tidak ditemukan atau sudah ditinjau.'; end if;
  update public.beranda_galeri set status = p_keputusan, catatan_tinjauan = case when p_keputusan = 'ditolak' then v_catatan else '' end,
      ditinjau_oleh = auth.uid(), ditinjau_oleh_nama = sigarda.nama_saya(), ditinjau_pada = now(), diubah_pada = now()
    where id = p_id;
end $$;
-- ===== akhir galeri =====

-- ===== Media sosial =====
-- Tanpa alur tinjauan: semua pengurus dapat menempel dan langsung tampil. Mengubah/menghapus milik sendiri; Pembina dan Admin Gudep boleh milik siapa pun.
create or replace function public.sg_sosial_simpan(p_id bigint, p_platform text, p_tautan text, p_keterangan text, p_gambar_url text, p_tampil boolean) returns bigint
language plpgsql security definer set search_path = public as
$$
declare
  v_tautan text := sigarda.rapikan(p_tautan); v_ket text := sigarda.rapikan(p_keterangan); v_gbr text := sigarda.rapikan(p_gambar_url);
  v_lama public.beranda_sosial; v_id bigint;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pengurus() then raise exception 'Hanya pengurus (Pembina, Admin Gudep, dan Dewan Ambalan) yang dapat menempel kiriman media sosial.'; end if;
  if p_platform not in ('instagram', 'youtube', 'facebook', 'tiktok') then raise exception 'Platform tidak dikenal.'; end if;
  if v_tautan !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#][^ ]*)?$' then raise exception 'Tautan kiriman harus diawali https:// dan berupa alamat yang sah.'; end if;
  if char_length(v_ket) > 200 then raise exception 'Keterangan maksimal 200 karakter.'; end if;
  if v_gbr <> '' and v_gbr !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#][^ ]*)?$' then raise exception 'Gambar pratinjau harus diawali https:// dan berupa alamat yang sah.'; end if;
  if p_id is not null then
    select * into v_lama from public.beranda_sosial where id = p_id;
    if v_lama.id is null then raise exception 'Kiriman tidak ditemukan.'; end if;
    if not sigarda.pembina_atau_admin() and v_lama.dibuat_oleh is distinct from auth.uid() then raise exception 'Anda hanya dapat mengubah kiriman milik Anda sendiri.'; end if;
    update public.beranda_sosial set platform = p_platform, tautan = v_tautan, keterangan = v_ket, gambar_url = v_gbr, tampil = coalesce(p_tampil, true), diubah_pada = now()
      where id = p_id returning id into v_id;
  else
    insert into public.beranda_sosial (platform, tautan, keterangan, gambar_url, tampil, dibuat_oleh, dibuat_oleh_nama)
      values (p_platform, v_tautan, v_ket, v_gbr, coalesce(p_tampil, true), auth.uid(), sigarda.nama_saya())
      returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.sg_sosial_hapus(p_id bigint) returns void language plpgsql security definer set search_path = public as
$$
declare v_lama public.beranda_sosial;
begin
  perform sigarda.wajib_aktif();
  select * into v_lama from public.beranda_sosial where id = p_id;
  if v_lama.id is null then raise exception 'Kiriman tidak ditemukan.'; end if;
  if not sigarda.pembina_atau_admin() and v_lama.dibuat_oleh is distinct from auth.uid() then raise exception 'Anda hanya dapat menghapus kiriman milik Anda sendiri.'; end if;
  delete from public.beranda_sosial where id = p_id;
end $$;
-- ===== akhir media sosial =====

-- ===== Pertanyaan umum (FAQ) =====
-- HANYA Pembina dan Admin Gudep (beda dari Berita/Prestasi/Galeri/Media sosial: Dewan Ambalan tidak dapat menulis atau mengusulkan).
create or replace function public.sg_faq_simpan(p_id bigint, p_pertanyaan text, p_jawaban text) returns bigint
language plpgsql security definer set search_path = public as
$$
declare v_p text := sigarda.rapikan(p_pertanyaan); v_j text := sigarda.rapikan(p_jawaban); v_id bigint; v_urutan int;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat mengubah pertanyaan umum.'; end if;
  if char_length(v_p) < 1 or char_length(v_p) > 200 then raise exception 'Pertanyaan wajib diisi, maksimal 200 karakter.'; end if;
  if char_length(v_j) < 1 or char_length(v_j) > 1000 then raise exception 'Jawaban wajib diisi, maksimal 1000 karakter.'; end if;
  if p_id is not null then
    update public.beranda_faq set pertanyaan = v_p, jawaban = v_j, diubah_oleh = auth.uid(), diubah_pada = now() where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Pertanyaan tidak ditemukan.'; end if;
  else
    select coalesce(max(urutan), 0) + 1 into v_urutan from public.beranda_faq;
    insert into public.beranda_faq (pertanyaan, jawaban, urutan, diubah_oleh) values (v_p, v_j, v_urutan, auth.uid()) returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.sg_faq_hapus(p_id bigint) returns void language plpgsql security definer set search_path = public as
$$
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat menghapus pertanyaan umum.'; end if;
  delete from public.beranda_faq where id = p_id;
end $$;

-- Menukar urutan dengan tetangga (p_arah < 0 = naik, > 0 = turun); di ujung daftar tidak melakukan apa pun. Pola sama dengan sg_materi_geser.
create or replace function public.sg_faq_geser(p_id bigint, p_arah int) returns void language plpgsql security definer set search_path = public as
$$
declare v_u int; v_tetangga bigint; v_ut int;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat mengubah urutan pertanyaan umum.'; end if;
  select urutan into v_u from public.beranda_faq where id = p_id;
  if v_u is null then return; end if;
  if p_arah < 0 then
    select id, urutan into v_tetangga, v_ut from public.beranda_faq where urutan < v_u order by urutan desc limit 1;
  else
    select id, urutan into v_tetangga, v_ut from public.beranda_faq where urutan > v_u order by urutan asc limit 1;
  end if;
  if v_tetangga is null then return; end if;
  update public.beranda_faq set urutan = case when id = p_id then v_ut else v_u end where id in (p_id, v_tetangga);
end $$;
-- ===== akhir faq =====
-- ===== akhir aksi beranda konten =====

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
      select jsonb_agg(jsonb_build_object('kategori', b.kategori, 'judul', b.judul, 'ringkasan', b.ringkasan, 'sampulUrl', b.sampul_url, 'terbitPada', b.terbit_pada) order by b.terbit_pada desc, b.id desc)
      from (select id, kategori, judul, ringkasan, sampul_url, terbit_pada from public.beranda_berita where status = 'terbit' and terbit_pada <= now() order by terbit_pada desc, id desc limit 6) b
    ), '[]'::jsonb),
    'prestasi', coalesce((
      select jsonb_agg(jsonb_build_object('judul', p.judul, 'tingkat', p.tingkat, 'peringkat', p.peringkat, 'tahun', p.tahun, 'diraihOleh', p.diraih_oleh, 'fotoUrl', p.foto_url) order by p.tahun desc, p.id desc)
      from (select id, judul, tingkat, peringkat, tahun, diraih_oleh, foto_url from public.beranda_prestasi where status = 'terbit') p
    ), '[]'::jsonb),
    'galeri', coalesce((
      select jsonb_agg(jsonb_build_object('judul', g.judul, 'tautan', g.tautan, 'sampulUrl', g.sampul_url, 'kelompok', g.kelompok) order by g.dibuat_pada desc, g.id desc)
      from (select id, judul, tautan, sampul_url, kelompok, dibuat_pada from public.beranda_galeri where status = 'terbit') g
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

create or replace function public.sg_cadangan_admin() returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_hasil jsonb;
begin
  perform sigarda.wajib_admin('Hanya Admin Gudep yang dapat mengunduh cadangan.');
  select jsonb_build_object(
    'dibuat_pada', now(),
    'tabel', jsonb_build_object(
      'profiles', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.profiles t),
      'sku_butir', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sku_butir t),
      'sku_unit', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sku_unit t),
      'pf_item', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.pf_item t),
      'sku_progress', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sku_progress t),
      'sku_riwayat', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sku_riwayat t),
      'absensi_sesi', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.absensi_sesi t),
      'absensi_hadir', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.absensi_hadir t),
      'iuran', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.iuran t),
      'iuran_log', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.iuran_log t),
      'iuran_kas', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.iuran_kas t),
      'asisten_iuran', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.asisten_iuran t),
      'penugasan_rombel', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.penugasan_rombel t),
      'penugasan_log', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.penugasan_log t),
      'penugasan_peserta', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.penugasan_peserta t),
      'kepengurusan_log', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.kepengurusan_log t),
      'pengukuhan_dewan', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.pengukuhan_dewan t),
      'guru_agama', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.guru_agama t),
      'dokumen_terbit', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.dokumen_terbit t),
      'dokumen_urut', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.dokumen_urut t),
      'naik_kelas_batch', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.naik_kelas_batch t),
      'naik_kelas_log', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.naik_kelas_log t),
      'portofolio', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.portofolio t),
      'portofolio_jurnal', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.portofolio_jurnal t),
      'materi', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.materi t),
      'pengaturan', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.pengaturan t),
      'sidang_urut', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sidang_urut t),
      'sidang_dk', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sidang_dk t),
      'raport', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.raport t),
      'instrumen', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.instrumen t),
      'instrumen_kriteria', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.instrumen_kriteria t),
      'instrumen_penguji', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.instrumen_penguji t),
      'instrumen_panduan', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.instrumen_panduan t),
      'sku_penilaian', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sku_penilaian t),
      'sertifikat_tingkat', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sertifikat_tingkat t),
      'sesi_ujian', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sesi_ujian t),
      'sesi_ujian_butir', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sesi_ujian_butir t),
      'sesi_ujian_peserta', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sesi_ujian_peserta t)
    -- PostgreSQL membatasi 100 argumen per fungsi (50 pasang): daftar tabel dibagi dua objek yang digabung dengan ||
    ) || jsonb_build_object(
      'agenda', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.agenda t),
      'kegiatan_usulan', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.kegiatan_usulan t),
      'bina_damping', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.bina_damping t),
      'pinsa_tugas', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.pinsa_tugas t),
      'sku_pra_uji', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sku_pra_uji t),
      'pelantikan', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.pelantikan t),
      'saka_anggota', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.saka_anggota t),
      'tkk_capaian', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.tkk_capaian t),
      'tkk_krida', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.tkk_krida t),
      'tkk_pengajuan', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.tkk_pengajuan t),
      'spg_penetapan', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.spg_penetapan t),
      'tanggal_lahir', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.tanggal_lahir t),
      'tim_penilai', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.tim_penilai t),
      'tim_penilai_anggota', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.tim_penilai_anggota t),
      'garuda_tahap', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.garuda_tahap t),
      'penegak_isian', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.penegak_isian t),
      'dokumen_templat', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.dokumen_templat t),
      'portofolio_snapshot', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.portofolio_snapshot t),
      'sfh_catatan', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sfh_catatan t),
      'beranda_berita', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.beranda_berita t),
      'beranda_prestasi', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.beranda_prestasi t),
      'beranda_galeri', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.beranda_galeri t),
      'beranda_sosial', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.beranda_sosial t),
      'beranda_faq', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.beranda_faq t)
    )
  ) into v_hasil;
  insert into public.pengaturan (kunci, nilai, diubah_oleh, diubah_pada)
    values ('cadangan.terakhir', jsonb_build_object('pada', now(), 'oleh', (select nama from public.profiles where id = auth.uid())), auth.uid(), now())
    on conflict (kunci) do update set nilai = excluded.nilai, diubah_oleh = excluded.diubah_oleh, diubah_pada = excluded.diubah_pada;
  return v_hasil;
end $$;

revoke all on function
  public.sg_berita_simpan(bigint, text, text, text, text, text, text, timestamptz), public.sg_berita_hapus(bigint), public.sg_berita_tinjau(bigint, text, text),
  public.sg_prestasi_simpan(bigint, text, text, text, integer, text, text, text), public.sg_prestasi_hapus(bigint), public.sg_prestasi_tinjau(bigint, text, text),
  public.sg_galeri_simpan(bigint, text, text, text, text, text), public.sg_galeri_hapus(bigint), public.sg_galeri_tinjau(bigint, text, text),
  public.sg_sosial_simpan(bigint, text, text, text, text, boolean), public.sg_sosial_hapus(bigint),
  public.sg_faq_simpan(bigint, text, text), public.sg_faq_hapus(bigint), public.sg_faq_geser(bigint, integer)
  from public, anon, authenticated;
grant execute on function
  public.sg_berita_simpan(bigint, text, text, text, text, text, text, timestamptz), public.sg_berita_hapus(bigint), public.sg_berita_tinjau(bigint, text, text),
  public.sg_prestasi_simpan(bigint, text, text, text, integer, text, text, text), public.sg_prestasi_hapus(bigint), public.sg_prestasi_tinjau(bigint, text, text),
  public.sg_galeri_simpan(bigint, text, text, text, text, text), public.sg_galeri_hapus(bigint), public.sg_galeri_tinjau(bigint, text, text),
  public.sg_sosial_simpan(bigint, text, text, text, text, boolean), public.sg_sosial_hapus(bigint),
  public.sg_faq_simpan(bigint, text, text), public.sg_faq_hapus(bigint), public.sg_faq_geser(bigint, integer)
  to authenticated;

revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
