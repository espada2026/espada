// Menyusun supabase/migrasi/2026-10-dokumen-siaga.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-10-dokumen-siaga.mjs
import { ambil, gantiFungsi, tulisMigrasi } from './bantu.mjs';

const sertifikat = gantiFungsi(ambil('create function public.sg_sertifikat_tingkat(', 'end $$;', true));

const kepala = `-- ============================================================================
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

${sertifikat}

revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;
revoke all on function public.sg_sertifikat_tingkat(uuid, text) from public, anon, authenticated;
grant execute on function public.sg_sertifikat_tingkat(uuid, text) to authenticated;

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-10-dokumen-siaga', kepala);
