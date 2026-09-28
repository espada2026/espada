-- ===== Kelola Beranda (Fase 2 landing page): tabel =====
-- Isi halaman muka yang dikelola pengurus lewat menu Kelola Beranda. Berita, Prestasi, dan Galeri memakai alur tinjauan yang sama: Dewan
-- Ambalan hanya menulis draf atau mengajukan ('menunggu'); Pembina dan Admin Gudep dapat menerbitkan langsung atau meninjau pengajuan Dewan
-- (menyetujui = 'terbit', menolak = 'ditolak' dengan catatan wajib). Media sosial dan pertanyaan umum tanpa alur tinjauan (lihat catatan
-- masing-masing tabel). Semua ditulis HANYA lewat fungsi sg_* (lihat 586-aksi-beranda-konten.sql); dibaca lewat sg_beranda_publik (hanya yang
-- berstatus 'terbit') dan menu Kelola Beranda (pengurus, semua status).
create table public.beranda_berita (
  id bigint generated always as identity primary key,
  kategori text not null default 'kegiatan' check (kategori in ('kegiatan', 'pengumuman', 'lainnya')),
  judul text not null check (char_length(btrim(judul)) between 1 and 150),
  ringkasan text not null default '' check (char_length(ringkasan) <= 200),
  isi text not null check (char_length(btrim(isi)) between 1 and 4000),
  sampul_url text not null default '' check (sampul_url = '' or sampul_url ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#][^ ]*)?$'),
  status text not null default 'draf' check (status in ('draf', 'menunggu', 'terbit', 'ditolak')),
  terbit_pada timestamptz,  -- kapan tampil publik; boleh masa lalu (berita terlambat ditulis) atau masa depan (terjadwal). Draf/pengajuan menyimpan tanggal pilihan penulis (boleh null = saat diterbitkan).
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

create table public.beranda_prestasi (
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
create table public.beranda_galeri (
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
create table public.beranda_sosial (
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
create table public.beranda_faq (
  id bigint generated always as identity primary key,
  pertanyaan text not null check (char_length(btrim(pertanyaan)) between 1 and 200),
  jawaban text not null check (char_length(btrim(jawaban)) between 1 and 1000),
  urutan int not null default 0,
  diubah_oleh uuid references public.profiles(id) on delete set null,
  diubah_pada timestamptz not null default now()
);
create index if not exists beranda_faq_urutan_idx on public.beranda_faq (urutan);
-- ===== akhir tabel beranda konten =====
