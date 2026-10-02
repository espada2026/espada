// Menyusun supabase/migrasi/2026-10-istilah-siaga.sql dari PETA (istilah-siaga-peta.mjs; sumbernya sama dengan perubahan di supabase/sumber).
// Jalankan: node scripts/migrasi/2026-10-istilah-siaga.mjs
import { tulisMigrasi } from './bantu.mjs';
import { PETA } from './istilah-siaga-peta.mjs';

const larik = PETA.flatMap(([dari, ke]) => [`$p$${dari}$p$`, `$p$${ke}$p$`]).join(',\n    ');

const isi = `-- ============================================================================
-- MIGRASI: Teks pesan galat dan notifikasi di server memakai istilah Pramuka Siaga (bukan Penegak/Dewan Ambalan). AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-10-tema-tampilan.sql (lihat README). Isi: menulis ulang fungsi yang memuat teks lama (hanya TEKS pesan yang berubah; logika,
-- tanda tangan, dan hak akses fungsi sama), mis. "Hanya Dewan Ambalan atau Pembina yang dapat menutup kas." menjadi "Hanya Pembina yang dapat menutup kas.".
-- Penggantian dilakukan atas isi fungsi yang SUDAH terpasang (daftar pasangan teks di bawah), jadi aman diulang: sesudah sekali jalan tidak ada yang berubah lagi.
-- TIDAK menghapus data. Edge Function TIDAK berubah.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Hasilnya sama dengan supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $mig$
declare
  v_peta text[] := array[
    ${larik}
  ];
  r record; v_lama text; v_baru text; i int;
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'sigarda') and p.prokind = 'f'
  loop
    v_lama := pg_get_functiondef(r.oid);
    v_baru := v_lama;
    for i in 1 .. array_length(v_peta, 1) / 2 loop
      v_baru := replace(v_baru, v_peta[2 * i - 1], v_peta[2 * i]);
    end loop;
    if v_baru <> v_lama then execute v_baru; end if;
  end loop;
end $mig$;

revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-10-istilah-siaga', isi);
