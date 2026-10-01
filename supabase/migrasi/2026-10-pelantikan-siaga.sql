-- ============================================================================
-- MIGRASI: Pramuka Siaga, Fase 4: pelantikan kenaikan tingkat Siaga. AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-10-latihan-tabungan.sql (lihat README). Isi:
--   * Kendala tingkat pada public.pelantikan diperluas: selain 'bantara' dan 'laksana' (Penegak) kini 'mula', 'bantu', dan 'tata' (anggota Siaga).
--   * sg_pelantikan_catat ditulis ulang (tanda tangan sama): tingkat Siaga hanya untuk anggota Siaga dan tingkat Penegak hanya untuk Penegak; anggota harus
--     sudah menyelesaikan seluruh butir SKU tingkat itu; tanggal harus sesudah pelantikan tingkat sebelumnya (Bantu sesudah Mula, Tata sesudah Bantu,
--     Laksana sesudah Bantara). Kegiatan Agenda untuk pelantikan Siaga boleh berjenis apa pun.
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regclass('public.tabungan_cek') is null then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (sampai 2026-10-latihan-tabungan.sql; lihat README), baru migrasi ini.';
  end if;
end $$;

alter table public.pelantikan drop constraint if exists pelantikan_tingkat_check;
alter table public.pelantikan add constraint pelantikan_tingkat_check check (tingkat in ('bantara','laksana','mula','bantu','tata'));

create or replace function public.sg_pelantikan_catat(
  p_tingkat text, p_tanggal date, p_tempat text, p_peserta_ids uuid[], p_agenda_id bigint default null, p_catatan text default ''
) returns integer language plpgsql security definer set search_path = public as
$$
declare
  v_tempat text := sigarda.rapikan(p_tempat); v_cat text := sigarda.rapikan(p_catatan); v_ids uuid[]; v_id uuid; v_p public.profiles; v_tk text; v_pra text; v_pra_tgl date; v_siaga boolean; v_n int := 0;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat mencatat pelantikan.'; end if;
  if p_tingkat is null or p_tingkat not in ('bantara','laksana','mula','bantu','tata') then raise exception 'Tingkat pelantikan harus Bantara, Laksana, Mula, Bantu, atau Tata.'; end if;
  if p_tanggal is null then raise exception 'Tanggal pelantikan wajib diisi.'; end if;
  if p_tanggal < date '2000-01-01' or p_tanggal > sigarda.hari_ini() then raise exception 'Tanggal pelantikan tidak boleh sebelum tahun 2000 atau di masa depan. Catat pelantikan sesudah terlaksana.'; end if;
  if char_length(v_tempat) not between 1 and 120 or v_tempat ~ '[[:cntrl:]<>]' then raise exception 'Tempat pelantikan wajib diisi (maksimal 120 karakter, tanpa tanda < atau >).'; end if;
  if char_length(v_cat) > 200 or v_cat ~ '[[:cntrl:]<>]' then raise exception 'Catatan maksimal 200 karakter, tanpa tanda < atau >.'; end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_peserta_ids, '{}')) x;
  if coalesce(array_length(v_ids, 1), 0) = 0 then raise exception 'Pilih sedikitnya satu anggota.'; end if;
  if array_length(v_ids, 1) > 200 then raise exception 'Maksimal 200 anggota sekali catat.'; end if;
  v_siaga := p_tingkat in ('mula','bantu','tata');   -- Siaga: kegiatan Agenda jenis apa pun boleh ditautkan (belum ada jenis pelantikan Siaga)
  if p_agenda_id is not null and not exists (select 1 from public.agenda where id = p_agenda_id and (v_siaga or jenis = 'pelantikan_' || p_tingkat)) then
    raise exception 'Kegiatan Agenda yang dipilih bukan pelantikan %.', initcap(p_tingkat);
  end if;
  v_tk := initcap(p_tingkat);
  v_pra := lower(sigarda.prasyarat_tingkat(v_tk));   -- tingkat sebelumnya (null untuk Bantara dan Mula)
  foreach v_id in array v_ids loop
    select * into v_p from public.profiles where id = v_id and role = 'peserta';
    if not found then raise exception 'Ada anggota yang bukan Penegak atau anggota Siaga.'; end if;
    if v_p.status <> 'aktif' then raise exception '% tidak aktif; pelantikan hanya untuk anggota aktif.', v_p.nama; end if;
    if (v_p.tanpa_akun or sigarda.kelas_siaga(v_p.kelas)) <> v_siaga then raise exception '% bukan anggota %; pelantikan % hanya untuk %.', v_p.nama, case when v_siaga then 'Siaga' else 'Penegak' end, v_tk, case when v_siaga then 'anggota Siaga' else 'Penegak' end; end if;
    if not sigarda.tingkat_selesai(v_id, v_tk) then raise exception '% belum menyelesaikan seluruh butir SKU %.', v_p.nama, v_tk; end if;
    if v_pra is not null then
      select tanggal into v_pra_tgl from public.pelantikan where peserta_id = v_id and tingkat = v_pra;
      if v_pra_tgl is not null and p_tanggal <= v_pra_tgl then raise exception 'Pelantikan % % harus sesudah pelantikan % (%).', v_tk, v_p.nama, initcap(v_pra), to_char(v_pra_tgl, 'YYYY-MM-DD'); end if;
    end if;
    insert into public.pelantikan (peserta_id, tingkat, tanggal, tempat, agenda_id, catatan, dicatat_oleh, dicatat_pada)
    values (v_id, p_tingkat, p_tanggal, v_tempat, p_agenda_id, v_cat, auth.uid(), now())
    on conflict (peserta_id, tingkat) do update
      set tanggal = excluded.tanggal, tempat = excluded.tempat, agenda_id = excluded.agenda_id, catatan = excluded.catatan, dicatat_oleh = excluded.dicatat_oleh, dicatat_pada = excluded.dicatat_pada;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;
revoke all on function public.sg_pelantikan_catat(text, date, text, uuid[], bigint, text) from public, anon, authenticated;
grant execute on function public.sg_pelantikan_catat(text, date, text, uuid[], bigint, text) to authenticated;

commit;
notify pgrst, 'reload schema';
