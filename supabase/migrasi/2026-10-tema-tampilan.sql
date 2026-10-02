-- ============================================================================
-- MIGRASI: Tema tampilan (Siaga atau asli) yang diatur Admin untuk seluruh gudep. AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-10-dokumen-siaga.sql dan migrasi sesudahnya di README (lihat README). Isi:
--   * Fungsi baru sg_tema_simpan(text): hanya Admin Gudep; menyimpan pengaturan tampilan.tema ('siaga' atau 'asli').
--   * sg_gudep_publik() (tanda tangan sama, ditulis ulang) kini juga mengembalikan kunci tema bila sudah diatur, supaya halaman masuk dan halaman muka
--     memakai tema yang sama sebelum login. Belum diatur = tema bawaan Siaga.
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

-- ===== Tema tampilan: fungsi =====
create or replace function public.sg_gudep_publik() returns jsonb
language sql stable security definer set search_path = public as
$$
  select coalesce(
    (select jsonb_strip_nulls(jsonb_build_object('nama', p.nilai -> 'nama', 'singkat', p.nilai -> 'singkat', 'sekolah', p.nilai -> 'sekolah', 'kota', p.nilai -> 'kota'))
     from public.pengaturan p where p.kunci = 'gudep.data'), '{}'::jsonb)
  || coalesce((select jsonb_build_object('tema', t.nilai #>> '{}') from public.pengaturan t where t.kunci = 'tampilan.tema' and t.nilai #>> '{}' in ('siaga', 'asli')), '{}'::jsonb)
$$;

-- Tema tampilan seluruh gudep: 'siaga' (bawaan) atau 'asli' (cokelat-emas). Hanya Admin Gudep. Daftar tema sama dengan DAFTAR_TEMA di src/lib/temaStore.js (dijaga pengujian).
create or replace function public.sg_tema_simpan(p_tema text) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform sigarda.wajib_admin('Hanya Admin Gudep yang dapat mengubah tema tampilan.');
  if p_tema is null or p_tema not in ('siaga', 'asli') then raise exception 'Tema tidak dikenal.'; end if;
  insert into public.pengaturan (kunci, nilai, diubah_oleh, diubah_pada) values ('tampilan.tema', to_jsonb(p_tema), auth.uid(), now())
  on conflict (kunci) do update set nilai = excluded.nilai, diubah_oleh = excluded.diubah_oleh, diubah_pada = excluded.diubah_pada;
end $$;
-- ===== akhir fungsi tema tampilan =====

revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;
revoke all on function public.sg_tema_simpan(text) from public, anon, authenticated;
grant execute on function public.sg_tema_simpan(text) to authenticated;
revoke all on function public.sg_gudep_publik() from public, anon, authenticated;
grant execute on function public.sg_gudep_publik() to anon, authenticated;

commit;
notify pgrst, 'reload schema';
