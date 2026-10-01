// Menyusun supabase/migrasi/2026-10-pelantikan-siaga.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-10-pelantikan-siaga.mjs
import { ambil, gantiFungsi, tulisMigrasi } from './bantu.mjs';

const catat = gantiFungsi(ambil('create function public.sg_pelantikan_catat(', 'end $$;', true));

const kepala = `-- ============================================================================
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

${catat}

revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;
revoke all on function public.sg_pelantikan_catat(text, date, text, uuid[], bigint, text) from public, anon, authenticated;
grant execute on function public.sg_pelantikan_catat(text, date, text, uuid[], bigint, text) to authenticated;

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-10-pelantikan-siaga', kepala);
