-- ============================================================================
-- MIGRASI: Pramuka Siaga, Fase 3: latihan (hari apa pun) dan tabungan. AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-10-siaga-akun.sql (lihat README). Isi:
--   * Absensi latihan tidak lagi dibatasi hari Jumat: kendala hari pada absensi_sesi dibuang dan sg_absen_buat_sesi ditulis ulang (tanda tangan sama). Iuran memakai sesi yang sama,
--     jadi ikut bebas hari. Data lama tidak berubah.
--   * Pembina ikut dapat mencatat iuran, menutup kas, dan iuran susulan (gugus depan Siaga tidak punya Dewan Ambalan): sigarda.pencatat_iuran, sg_iuran_kas_simpan, sg_iuran_susulan
--     ditulis ulang (tanda tangan sama).
--   * Tabel baru public.tabungan_cek (Pembina memeriksa buku tabungan anak Siaga: tanggal dan setoran minggu itu; RLS baca pemilik, Pembina, Admin; tulis hanya lewat fungsi) dan
--     fungsi baru sg_tabungan_catat dan sg_tabungan_hapus (Pembina dan Admin). sg_cadangan_admin ditulis ulang agar memuat tabel baru.
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regprocedure('sigarda.kelas_siaga(text)') is null then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (sampai 2026-10-siaga-akun.sql; lihat README), baru migrasi ini.';
  end if;
end $$;

-- Membuang kendala "hanya Jumat" pada absensi_sesi (namanya dicari dari definisinya agar tahan terhadap perbedaan nama).
do $$
declare k record;
begin
  for k in select conname from pg_constraint
           where conrelid = 'public.absensi_sesi'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%dow%'
  loop
    execute format('alter table public.absensi_sesi drop constraint %I', k.conname);
  end loop;
end $$;

create or replace function public.sg_absen_buat_sesi(p_tanggal date) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pengurus() then raise exception 'Hanya Dewan Ambalan, Pembina, atau admin yang dapat mencatat absensi.'; end if;
  if p_tanggal is null or p_tanggal < date '2000-01-01' or p_tanggal > date '2100-12-31' then raise exception 'Tanggal tidak valid.'; end if;
  if p_tanggal > sigarda.hari_ini() then raise exception 'Sesi belum bisa dibuat untuk tanggal yang belum tiba.'; end if;
  insert into public.absensi_sesi (tanggal, dibuat_oleh) values (p_tanggal, auth.uid()) on conflict (tanggal) do nothing;
end $$;

create or replace function sigarda.pencatat_iuran() returns boolean language plpgsql stable security definer set search_path = public as
$$ begin return sigarda.dewan() or sigarda.pembina_saja() or sigarda.asisten_iuran(); end $$;

create or replace function public.sg_iuran_kas_simpan(p_tanggal date, p_total int, p_catatan text default '') returns void
language plpgsql security definer set search_path = public as
$$
declare v_cat text := btrim(coalesce(p_catatan, ''));
begin
  perform sigarda.wajib_aktif();
  if not (sigarda.dewan() or sigarda.pembina_saja()) then raise exception 'Hanya Dewan Ambalan atau Pembina yang dapat menutup kas.'; end if;
  if not exists (select 1 from public.absensi_sesi where tanggal = p_tanggal) then raise exception 'Sesi absensi belum dibuat.'; end if;
  if p_total is null then
    delete from public.iuran_kas where tanggal = p_tanggal;
    return;
  end if;
  if p_total < 0 or p_total > 100000000 then raise exception 'Total kas tidak valid.'; end if;
  if char_length(v_cat) > 300 then raise exception 'Catatan maksimal 300 karakter.'; end if;
  insert into public.iuran_kas (tanggal, total_fisik, catatan, oleh) values (p_tanggal, p_total, v_cat, auth.uid())
  on conflict (tanggal) do update set total_fisik = excluded.total_fisik, catatan = excluded.catatan, oleh = excluded.oleh, waktu = now();
end $$;

create or replace function public.sg_iuran_susulan(p_peserta_id uuid, p_tanggal date, p_jumlah int, p_pertemuan int) returns int
language plpgsql security definer set search_path = public as
$$
declare h record; v_t date; v_n int := 0;
begin
  perform sigarda.wajib_aktif();
  if not (sigarda.dewan() or sigarda.pembina_saja()) then raise exception 'Hanya Dewan Ambalan atau Pembina yang dapat mencatat iuran susulan.'; end if;
  if p_tanggal is null then raise exception 'Tanggal uji wajib diisi.'; end if;
  if p_jumlah is null or p_jumlah < 1 or p_jumlah > 1000000 then raise exception 'Jumlah iuran harus antara Rp 1 dan Rp 1.000.000.'; end if;
  if p_pertemuan is null or p_pertemuan < 1 or p_pertemuan > 60 then raise exception 'Jumlah pertemuan susulan harus antara 1 dan 60.'; end if;
  if not exists (select 1 from public.profiles where id = p_peserta_id and role = 'peserta') then raise exception 'Peserta tidak ditemukan.'; end if;
  select * into h from sigarda.iuran_hitung(p_peserta_id, p_tanggal);
  for v_t in
    select s.tanggal from public.absensi_sesi s
    where s.tanggal between h.o_mulai and least(h.o_akhir, p_tanggal, sigarda.hari_ini())
      and not exists (select 1 from public.iuran i where i.tanggal = s.tanggal and i.peserta_id = p_peserta_id)
    order by s.tanggal limit p_pertemuan
  loop
    insert into public.iuran (tanggal, peserta_id, jumlah, jenis, oleh) values (v_t, p_peserta_id, p_jumlah, 'susulan', auth.uid());
    insert into public.iuran_log (tanggal, peserta_id, jumlah_lama, jumlah_baru, jenis, oleh) values (v_t, p_peserta_id, null, p_jumlah, 'susulan', auth.uid());
    v_n := v_n + 1;
  end loop;
  if v_n = 0 then raise exception 'Tidak ada pertemuan tanpa iuran yang dapat ditebus pada semester ini.'; end if;
  return v_n;
end $$;

-- ===== Tabungan Siaga (Fase 3): tabel =====
-- Tabungan Siaga (Pramuka Siaga, Fase 3; SK Kwarnas 119/2011 butir 4 tiap tingkat: punya buku tabungan dan menabung teratur beberapa minggu; kebiasaan menabung SK 186/1979).
-- Uang tabungan milik anak dan disimpan di bukunya sendiri, BUKAN di aplikasi: satu baris = pada tanggal itu Pembina memeriksa buku tabungan dan melihat setoran minggu itu.
-- Tidak ada baris = tidak diperiksa. Minggu menabung dihitung aplikasi dari baris-baris ini (src/lib/tabunganLogic.js).
create table if not exists public.tabungan_cek (
  peserta_id uuid not null references public.profiles(id) on delete cascade,
  tanggal date not null check (tanggal >= date '2015-01-01'),
  jumlah int not null check (jumlah between 1 and 100000000),
  catatan text not null default '' check (char_length(catatan) <= 200),
  oleh uuid references public.profiles(id) on delete set null,
  waktu timestamptz not null default now(),
  primary key (peserta_id, tanggal)
);
-- ===== akhir tabel tabungan =====

alter table public.tabungan_cek enable row level security;
-- Tabel baru menerima hak penuh bawaan Supabase: dicabut agar sama dengan database baru (baca saja lewat kebijakan; tulis hanya lewat fungsi).
revoke all on public.tabungan_cek from anon, authenticated;
grant select on public.tabungan_cek to authenticated;
drop policy if exists baca_tabungan_cek on public.tabungan_cek;
create policy baca_tabungan_cek on public.tabungan_cek for select to authenticated
  using ((select sigarda.aktif()) and (peserta_id = (select auth.uid()) or (select sigarda.pembina_atau_admin())));

drop trigger if exists tak_aktif_tabungan_cek on public.tabungan_cek;
create trigger tak_aktif_tabungan_cek before insert or update on public.tabungan_cek for each row execute function sigarda.tolak_peserta_tak_aktif();

-- ===== Tabungan Siaga (Fase 3): aksi =====
-- Pembina (atau Admin) mencatat bahwa pada p_tanggal buku tabungan seorang anak Siaga diperiksa dan ada setoran sebesar p_jumlah (rupiah) pada minggu itu.
-- Mencatat ulang tanggal yang sama = koreksi. Hanya anggota Siaga (kelas SD, dengan atau tanpa akun) yang aktif; uang tetap di buku anak, aplikasi hanya mencatat pemeriksaannya.
-- Aturan isian dicerminkan src/lib/tabunganLogic.js (periksaTabungan) dan dibandingkan langsung dengan fungsi ini oleh uji/tabungan-klien.mjs.
create or replace function public.sg_tabungan_catat(p_peserta_id uuid, p_tanggal date, p_jumlah int, p_catatan text default null) returns void
language plpgsql security definer set search_path = public as
$$
declare v_p record; v_cat text := btrim(coalesce(p_catatan, ''));
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina atau Admin Gudep yang dapat mencatat tabungan.'; end if;
  select id, nama, kelas, status, tanpa_akun into v_p from public.profiles where id = p_peserta_id and role = 'peserta';
  if v_p.id is null then raise exception 'Anggota tidak ditemukan.'; end if;
  if not (v_p.tanpa_akun or sigarda.kelas_siaga(v_p.kelas)) then raise exception 'Tabungan hanya dicatat untuk anggota Siaga.'; end if;
  if p_tanggal is null then raise exception 'Tanggal pemeriksaan wajib diisi.'; end if;
  if p_tanggal < date '2015-01-01' or p_tanggal > sigarda.hari_ini() then raise exception 'Tanggal pemeriksaan harus antara 1 Januari 2015 dan hari ini.'; end if;
  if p_jumlah is null or p_jumlah < 1 or p_jumlah > 100000000 then raise exception 'Setoran harus antara Rp 1 dan Rp 100.000.000.'; end if;
  if char_length(v_cat) > 200 then raise exception 'Catatan maksimal 200 karakter.'; end if;
  insert into public.tabungan_cek (peserta_id, tanggal, jumlah, catatan, oleh) values (p_peserta_id, p_tanggal, p_jumlah, v_cat, auth.uid())
  on conflict (peserta_id, tanggal) do update set jumlah = excluded.jumlah, catatan = excluded.catatan, oleh = excluded.oleh, waktu = now();
end $$;

create or replace function public.sg_tabungan_hapus(p_peserta_id uuid, p_tanggal date) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina atau Admin Gudep yang dapat menghapus catatan tabungan.'; end if;
  if exists (select 1 from public.profiles where id = p_peserta_id and status <> 'aktif') then raise exception 'Anggota nonaktif atau alumni tidak dapat diubah.'; end if;
  delete from public.tabungan_cek where peserta_id = p_peserta_id and tanggal = p_tanggal;
end $$;
-- ===== akhir aksi tabungan =====

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
      'tabungan_cek', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.tabungan_cek t),
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

revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;
revoke all on function
  public.sg_absen_buat_sesi(date), public.sg_iuran_kas_simpan(date, int, text), public.sg_iuran_susulan(uuid, date, int, int),
  public.sg_tabungan_catat(uuid, date, int, text), public.sg_tabungan_hapus(uuid, date), public.sg_cadangan_admin()
  from public, anon, authenticated;
grant execute on function
  public.sg_absen_buat_sesi(date), public.sg_iuran_kas_simpan(date, int, text), public.sg_iuran_susulan(uuid, date, int, int),
  public.sg_tabungan_catat(uuid, date, int, text), public.sg_tabungan_hapus(uuid, date), public.sg_cadangan_admin()
  to authenticated;

commit;
notify pgrst, 'reload schema';
