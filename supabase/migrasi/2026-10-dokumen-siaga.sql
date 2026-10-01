-- ============================================================================
-- MIGRASI: Pramuka Siaga, Fase 9: Surat Tanda Lulus SKU Siaga bertoken QR. AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-10-kegiatan-siaga.sql (lihat README). Isi:
--   * Kendala tingkat pada public.sertifikat_tingkat diperluas: selain 'Bantara' dan 'Laksana' kini 'Mula', 'Bantu', dan 'Tata'.
--   * sg_sertifikat_tingkat ditulis ulang (tanda tangan sama): tingkat Siaga hanya untuk anggota Siaga (kelas SD atau tanpa akun) dan
--     tingkat Penegak hanya untuk Penegak; syarat lain tetap (pemilik atau pengurus, seluruh butir tingkat itu lulus).
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agenda_jenis_check' and pg_get_constraintdef(oid) like '%pesta_siaga%') then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (sampai 2026-10-kegiatan-siaga.sql; lihat README), baru migrasi ini.';
  end if;
end $$;

alter table public.sertifikat_tingkat drop constraint if exists sertifikat_tingkat_tingkat_check;
alter table public.sertifikat_tingkat add constraint sertifikat_tingkat_tingkat_check check (tingkat in ('Bantara','Laksana','Mula','Bantu','Tata'));

create or replace function public.sg_sertifikat_tingkat(p_peserta_id uuid, p_tingkat text) returns text
language plpgsql security definer set search_path = public as
$$
declare v_uid uuid := auth.uid(); v_token text; v_p public.profiles;
begin
  perform sigarda.wajib_aktif();
  if p_tingkat is null or p_tingkat not in ('Bantara', 'Laksana', 'Mula', 'Bantu', 'Tata') then raise exception 'Tingkat SKU tidak dikenal.'; end if;
  select * into v_p from public.profiles where id = p_peserta_id and role = 'peserta';
  if not found then raise exception 'Peserta tidak ditemukan.'; end if;
  -- Tingkat Siaga (Mula, Bantu, Tata) hanya untuk anggota Siaga; Bantara dan Laksana hanya untuk Penegak.
  if (v_p.tanpa_akun or sigarda.kelas_siaga(v_p.kelas)) <> (p_tingkat in ('Mula', 'Bantu', 'Tata')) then raise exception 'Tingkat % tidak berlaku bagi anggota ini.', p_tingkat; end if;
  if p_peserta_id is distinct from v_uid and not sigarda.pengurus() then raise exception 'Anda tidak berwenang menerbitkan surat untuk peserta ini.'; end if;
  if not sigarda.tingkat_selesai(p_peserta_id, p_tingkat) then raise exception 'Surat Tanda Lulus hanya untuk tingkat yang seluruh butirnya sudah lulus.'; end if;
  insert into public.sertifikat_tingkat (token, peserta_id, tingkat, diterbitkan_oleh) values (sigarda.token_acak(), p_peserta_id, p_tingkat, v_uid)
  on conflict (peserta_id, tingkat) do nothing;
  select token into v_token from public.sertifikat_tingkat where peserta_id = p_peserta_id and tingkat = p_tingkat;
  return v_token;
end $$;

revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;
revoke all on function public.sg_sertifikat_tingkat(uuid, text) from public, anon, authenticated;
grant execute on function public.sg_sertifikat_tingkat(uuid, text) to authenticated;

commit;
notify pgrst, 'reload schema';
