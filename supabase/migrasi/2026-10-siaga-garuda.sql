-- ============================================================================
-- MIGRASI: Pramuka Siaga, Fase 6: Siaga Garuda (6 butir). AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-10-tkk-siaga.sql (lihat README). Isi:
--   * Tabel baru public.siaga_garuda (satu baris per anak dan butir: nilai 100/0, tanggal pengujian, catatan; RLS baca pemilik, Pembina, Admin; tulis hanya lewat fungsi;
--     pemicu tolak_peserta_tak_aktif) dan fungsi baru sg_siaga_garuda_catat dan sg_siaga_garuda_hapus (Pembina dan Admin; anggota Siaga aktif yang sudah menyelesaikan SKU Tata;
--     6 butir Jukran 038/2017). sg_cadangan_admin ditulis ulang agar memuat tabel baru.
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regprocedure('sigarda.kelas_siaga(text)') is null or to_regclass('public.tabungan_cek') is null or to_regclass('public.tkk_siaga') is null then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (sampai 2026-10-tkk-siaga.sql; lihat README), baru migrasi ini.';
  end if;
end $$;

-- ===== Siaga Garuda (Pramuka Siaga, Fase 6): tabel =====
-- Penetapan Syarat Siaga Garuda (6 butir, Jukran Kwarnas 038/2017) oleh Pembina: satu baris per anak Siaga per butir. Hasil hitung otomatis butir 1 (SKU Tata dan 2 bulan sesudah
-- dilantik) dan butir 2 (TKK) hanya saran di klien; baris ini mencatat PENETAPAN Pembina (100 = terpenuhi, 0 = belum), tanggal pengujian, dan catatan. Isi rubrik TIDAK disimpan.
create table if not exists public.siaga_garuda (
  peserta_id uuid not null references public.profiles(id) on delete cascade,
  butir smallint not null check (butir between 1 and 6),
  nilai smallint not null check (nilai in (0, 100)),
  tanggal date not null check (tanggal >= date '2015-01-01'),
  catatan text not null default '' check (char_length(catatan) <= 200),
  dicatat_oleh uuid references public.profiles(id) on delete set null,
  dicatat_pada timestamptz not null default now(),
  primary key (peserta_id, butir)
);
-- ===== akhir tabel siaga garuda =====

alter table public.siaga_garuda enable row level security;
-- Tabel baru menerima hak penuh bawaan Supabase: dicabut agar sama dengan database baru (baca saja lewat kebijakan; tulis hanya lewat fungsi).
revoke all on public.siaga_garuda from anon, authenticated;
grant select on public.siaga_garuda to authenticated;
drop policy if exists baca_siaga_garuda on public.siaga_garuda;
create policy baca_siaga_garuda on public.siaga_garuda for select to authenticated
  using ((select sigarda.aktif()) and (peserta_id = (select auth.uid()) or (select sigarda.pembina_atau_admin())));

drop trigger if exists tak_aktif_siaga_garuda on public.siaga_garuda;
create trigger tak_aktif_siaga_garuda before insert or update on public.siaga_garuda for each row execute function sigarda.tolak_peserta_tak_aktif();

-- ===== Siaga Garuda (Pramuka Siaga, Fase 6): aksi =====
-- Hanya Pembina dan Admin Gudep yang menetapkan. Anak harus anggota Siaga aktif dan sudah menyelesaikan seluruh SKU Tata (syarat Siaga Garuda: SKU Tata lebih dulu). Menetapkan
-- ulang butir yang sama = koreksi. Aturan isian dicerminkan src/lib/siagaGarudaLogic.js (periksaSiagaGaruda) dan dibandingkan langsung dengan fungsi ini oleh uji/siaga-garuda.mjs.
create or replace function public.sg_siaga_garuda_catat(
  p_peserta_id uuid, p_butir integer, p_nilai integer, p_tanggal date, p_catatan text default ''
) returns void language plpgsql security definer set search_path = public as
$$
declare v_p public.profiles; v_cat text := sigarda.rapikan(p_catatan);
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat menetapkan Syarat Siaga Garuda.'; end if;
  select * into v_p from public.profiles where id = p_peserta_id and role = 'peserta';
  if not found then raise exception 'Pilih anggota Siaga.'; end if;
  if not (v_p.tanpa_akun or sigarda.kelas_siaga(v_p.kelas)) then raise exception 'Syarat Siaga Garuda hanya untuk anggota Siaga.'; end if;
  if v_p.status <> 'aktif' then raise exception '% tidak aktif; Syarat Siaga Garuda hanya untuk anggota aktif.', v_p.nama; end if;
  if not sigarda.tingkat_selesai(p_peserta_id, 'Tata') then raise exception '% belum menyelesaikan SKU Tata.', v_p.nama; end if;
  if p_butir is null or p_butir not between 1 and 6 then raise exception 'Butir Siaga Garuda harus 1 sampai 6.'; end if;
  if p_nilai is null or p_nilai not in (0, 100) then raise exception 'Nilai harus 100 (memenuhi) atau 0 (belum).'; end if;
  if p_tanggal is null then raise exception 'Tanggal pengujian wajib diisi.'; end if;
  if p_tanggal < date '2015-01-01' or p_tanggal > sigarda.hari_ini() then raise exception 'Tanggal pengujian harus antara 1 Januari 2015 dan hari ini.'; end if;
  if char_length(v_cat) > 200 or v_cat ~ '[[:cntrl:]<>]' then raise exception 'Catatan maksimal 200 karakter, tanpa tanda < atau >.'; end if;
  insert into public.siaga_garuda (peserta_id, butir, nilai, tanggal, catatan, dicatat_oleh, dicatat_pada)
  values (p_peserta_id, p_butir, p_nilai, p_tanggal, v_cat, auth.uid(), now())
  on conflict (peserta_id, butir) do update
    set nilai = excluded.nilai, tanggal = excluded.tanggal, catatan = excluded.catatan, dicatat_oleh = excluded.dicatat_oleh, dicatat_pada = excluded.dicatat_pada;
end $$;

-- Menghapus penetapan satu butir (kembali ke saran aplikasi atau "belum ditetapkan").
create or replace function public.sg_siaga_garuda_hapus(p_peserta_id uuid, p_butir integer) returns void language plpgsql security definer set search_path = public as
$$
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat menghapus penetapan Siaga Garuda.'; end if;
  if exists (select 1 from public.profiles where id = p_peserta_id and status <> 'aktif') then raise exception 'Anggota nonaktif atau alumni tidak dapat diubah.'; end if;
  delete from public.siaga_garuda where peserta_id = p_peserta_id and butir = p_butir;
  if not found then raise exception 'Penetapan Siaga Garuda tidak ditemukan.'; end if;
end $$;
-- ===== akhir aksi siaga garuda =====

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
      'siaga_garuda', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.siaga_garuda t),
      'tkk_siaga', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.tkk_siaga t),
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
  public.sg_siaga_garuda_catat(uuid, integer, integer, date, text), public.sg_siaga_garuda_hapus(uuid, integer), public.sg_cadangan_admin()
  from public, anon, authenticated;
grant execute on function
  public.sg_siaga_garuda_catat(uuid, integer, integer, date, text), public.sg_siaga_garuda_hapus(uuid, integer), public.sg_cadangan_admin()
  to authenticated;

commit;
notify pgrst, 'reload schema';
