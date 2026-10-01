-- ============================================================================
-- MIGRASI: Pramuka Siaga, Fase 5: TKK anak Siaga (satu tingkat). AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-10-pelantikan-siaga.sql (lihat README). Isi:
--   * Tabel baru public.tkk_siaga (satu baris per anak dan TKK: tanggal lulus, nama penguji, tautan bukti, catatan; RLS baca pemilik, Pembina, Admin; tulis hanya lewat fungsi;
--     pemicu tolak_peserta_tak_aktif) dan fungsi baru sg_tkk_siaga_catat dan sg_tkk_siaga_hapus (Pembina dan Admin; anggota Siaga aktif yang sudah menyelesaikan SKU Bantu;
--     TKK dari 84 SKK SK 132/1979). sg_cadangan_admin ditulis ulang agar memuat tabel baru.
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regprocedure('sigarda.kelas_siaga(text)') is null or to_regclass('public.tabungan_cek') is null or to_regclass('public.tkk_katalog') is null then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (sampai 2026-10-pelantikan-siaga.sql; lihat README), baru migrasi ini.';
  end if;
end $$;

-- ===== TKK Siaga (Pramuka Siaga, Fase 5): tabel =====
-- TKK anak Siaga (SK Kwarnas 134/1976 dan 132/1979): SATU tingkat saja (tanpa Purwa/Madya/Utama), tanpa bukti melatih, diuji Pembina (satu nama penguji) dan dicatat
-- Pembina atau Admin; dikenakan sesudah anak menyelesaikan SKU Siaga Bantu. Satu baris per (anak, TKK); mencatat ulang = koreksi. Baca pemilik dan Pembina/Admin (RLS); tulis hanya fungsi.
create table if not exists public.tkk_siaga (
  id bigint generated always as identity primary key,
  peserta_id uuid not null references public.profiles(id) on delete cascade,
  tkk_id text not null references public.tkk_katalog(id),
  tanggal date not null check (tanggal >= date '2015-01-01'),
  penguji text not null check (char_length(btrim(penguji)) between 1 and 80),
  bukti_url text not null default '' check (bukti_url = '' or (bukti_url ~* '^https?://' and char_length(bukti_url) <= 500)),
  catatan text not null default '' check (char_length(catatan) <= 200),
  dicatat_oleh uuid references public.profiles(id) on delete set null,
  dicatat_pada timestamptz not null default now(),
  constraint tkk_siaga_satu_per_tkk unique (peserta_id, tkk_id)
);
create index if not exists tkk_siaga_tkk_idx on public.tkk_siaga (tkk_id);
-- ===== akhir tabel tkk siaga =====

alter table public.tkk_siaga enable row level security;
-- Tabel baru menerima hak penuh bawaan Supabase: dicabut agar sama dengan database baru (baca saja lewat kebijakan; tulis hanya lewat fungsi).
revoke all on public.tkk_siaga from anon, authenticated;
grant select on public.tkk_siaga to authenticated;
drop policy if exists baca_tkk_siaga on public.tkk_siaga;
create policy baca_tkk_siaga on public.tkk_siaga for select to authenticated
  using ((select sigarda.aktif()) and (peserta_id = (select auth.uid()) or (select sigarda.pembina_atau_admin())));

drop trigger if exists tak_aktif_tkk_siaga on public.tkk_siaga;
create trigger tak_aktif_tkk_siaga before insert or update on public.tkk_siaga for each row execute function sigarda.tolak_peserta_tak_aktif();

-- ===== TKK Siaga (Pramuka Siaga, Fase 5): aksi =====
-- Pembina atau Admin mencatat bahwa seorang anak Siaga aktif lulus satu TKK (satu tingkat saja). Syarat: anggota Siaga (kelas SD atau tanpa akun), SKU Siaga Bantu sudah selesai
-- (SK 134/1976: TKK dapat dikenakan sesudah Siaga Bantu), TKK dari 84 SKK SK 132/1979 (semuanya punya syarat golongan Siaga; SKK tambahan sesudahnya tidak dipakai) dan seagama
-- bila khusus satu agama, tanggal bukan masa depan. Mencatat ulang TKK yang sama = koreksi. Aturan isian dicerminkan src/lib/tkkSiagaLogic.js (periksaTkkSiaga) dan dibandingkan
-- langsung dengan fungsi ini oleh uji/tkk-siaga-klien.mjs.
create or replace function public.sg_tkk_siaga_catat(
  p_peserta_id uuid, p_tkk_id text, p_tanggal date, p_penguji text, p_bukti_url text default '', p_catatan text default ''
) returns bigint language plpgsql security definer set search_path = public as
$$
declare
  v_p public.profiles; v_t public.tkk_katalog; v_peng text := sigarda.rapikan(p_penguji); v_url text := btrim(coalesce(p_bukti_url, '')); v_cat text := sigarda.rapikan(p_catatan); v_id bigint;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat mencatat TKK.'; end if;
  select * into v_p from public.profiles where id = p_peserta_id and role = 'peserta';
  if not found then raise exception 'Pilih anggota Siaga.'; end if;
  if not (v_p.tanpa_akun or sigarda.kelas_siaga(v_p.kelas)) then raise exception 'TKK Siaga hanya dicatat untuk anggota Siaga.'; end if;
  if v_p.status <> 'aktif' then raise exception '% tidak aktif; TKK hanya dicatat untuk anggota aktif.', v_p.nama; end if;
  if not sigarda.tingkat_selesai(p_peserta_id, 'Bantu') then raise exception '% belum menyelesaikan SKU Bantu; TKK dapat dikenakan sesudah Siaga Bantu.', v_p.nama; end if;
  select * into v_t from public.tkk_katalog where id = p_tkk_id;
  if not found then raise exception 'TKK tidak dikenal.'; end if;
  if v_t.sumber <> 'skk-132-1979' then raise exception 'TKK % belum dipakai untuk golongan Siaga.', v_t.nama; end if;
  if v_t.agama is not null and v_t.agama is distinct from v_p.agama then raise exception 'TKK % khusus penganut agama %.', v_t.nama, v_t.agama; end if;
  if p_tanggal is null then raise exception 'Tanggal lulus wajib diisi.'; end if;
  if p_tanggal < date '2015-01-01' or p_tanggal > sigarda.hari_ini() then raise exception 'Tanggal lulus harus antara 1 Januari 2015 dan hari ini.'; end if;
  if char_length(v_peng) not between 1 and 80 or v_peng ~ '[[:cntrl:]<>]' then raise exception 'Isi nama penguji (maksimal 80 karakter, tanpa tanda < atau >).'; end if;
  if v_url <> '' and (v_url !~* '^https?://' or char_length(v_url) > 500 or v_url ~ '[[:cntrl:][:space:]<>]') then raise exception 'Tautan bukti harus berawalan http:// atau https:// (maksimal 500 karakter, tanpa spasi).'; end if;
  if char_length(v_cat) > 200 or v_cat ~ '[[:cntrl:]<>]' then raise exception 'Catatan maksimal 200 karakter, tanpa tanda < atau >.'; end if;
  insert into public.tkk_siaga (peserta_id, tkk_id, tanggal, penguji, bukti_url, catatan, dicatat_oleh, dicatat_pada)
  values (p_peserta_id, p_tkk_id, p_tanggal, v_peng, v_url, v_cat, auth.uid(), now())
  on conflict (peserta_id, tkk_id) do update
    set tanggal = excluded.tanggal, penguji = excluded.penguji, bukti_url = excluded.bukti_url, catatan = excluded.catatan, dicatat_oleh = excluded.dicatat_oleh, dicatat_pada = excluded.dicatat_pada
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.sg_tkk_siaga_hapus(p_id bigint) returns void language plpgsql security definer set search_path = public as
$$
declare v public.tkk_siaga;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat menghapus catatan TKK.'; end if;
  select * into v from public.tkk_siaga where id = p_id;
  if not found then raise exception 'Catatan TKK tidak ditemukan.'; end if;
  if exists (select 1 from public.profiles where id = v.peserta_id and status <> 'aktif') then raise exception 'Anggota nonaktif atau alumni tidak dapat diubah.'; end if;
  delete from public.tkk_siaga where id = p_id;
end $$;
-- ===== akhir aksi tkk siaga =====

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
  public.sg_tkk_siaga_catat(uuid, text, date, text, text, text), public.sg_tkk_siaga_hapus(bigint), public.sg_cadangan_admin()
  from public, anon, authenticated;
grant execute on function
  public.sg_tkk_siaga_catat(uuid, text, date, text, text, text), public.sg_tkk_siaga_hapus(bigint), public.sg_cadangan_admin()
  to authenticated;

commit;
notify pgrst, 'reload schema';
