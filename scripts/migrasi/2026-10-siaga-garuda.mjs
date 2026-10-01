// Menyusun supabase/migrasi/2026-10-siaga-garuda.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-10-siaga-garuda.mjs
import { ambil, gantiFungsi, kebijakanIdempoten, tabelJikaBelumAda, tulisMigrasi } from './bantu.mjs';

const tabel = tabelJikaBelumAda(ambil('-- ===== Siaga Garuda (Pramuka Siaga, Fase 6): tabel =====', '-- ===== akhir tabel siaga garuda =====', true));
const aksi = gantiFungsi(ambil('-- ===== Siaga Garuda (Pramuka Siaga, Fase 6): aksi =====', '-- ===== akhir aksi siaga garuda =====', true));
const kebijakan = kebijakanIdempoten("create policy baca_siaga_garuda on public.siaga_garuda for select to authenticated\n  using ((select sigarda.aktif()) and (peserta_id = (select auth.uid()) or (select sigarda.pembina_atau_admin())));");
const cadangan = gantiFungsi(ambil('create function public.sg_cadangan_admin()', 'end $$;\n\n-- Kapan dan siapa yang terakhir mengunduh cadangan', true)).replace(/\n\n-- Kapan dan siapa yang terakhir mengunduh cadangan[\s\S]*$/, '');

const kepala = `-- ============================================================================
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

${tabel}

alter table public.siaga_garuda enable row level security;
-- Tabel baru menerima hak penuh bawaan Supabase: dicabut agar sama dengan database baru (baca saja lewat kebijakan; tulis hanya lewat fungsi).
revoke all on public.siaga_garuda from anon, authenticated;
grant select on public.siaga_garuda to authenticated;
${kebijakan}

drop trigger if exists tak_aktif_siaga_garuda on public.siaga_garuda;
create trigger tak_aktif_siaga_garuda before insert or update on public.siaga_garuda for each row execute function sigarda.tolak_peserta_tak_aktif();

${aksi}

${cadangan}
`;
const akhir = `

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
`;
tulisMigrasi('2026-10-siaga-garuda', kepala + akhir.replace(/^\n+/, '\n'));
