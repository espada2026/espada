// Menyusun supabase/migrasi/2026-10-siaga-anggota.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-10-siaga-anggota.mjs
import { ambil, gantiFungsi, tulisMigrasi } from './bantu.mjs';

const rombel = gantiFungsi(ambil('create function sigarda.rombel_sah', '$$;', true));
const aksi = gantiFungsi(ambil('-- ===== Anggota Siaga tanpa akun (Pramuka Siaga, Fase 1): fungsi =====', '-- ===== akhir anggota Siaga tanpa akun =====', true));
const pemeriksaan = gantiFungsi(ambil('create function public.sg_pemeriksaan_data()', 'end $$;', true));

const kepala = `-- ============================================================================
-- MIGRASI: Pramuka Siaga, Fase 1: anggota Siaga tanpa akun, kelas SD, perindukan dan barung. AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-09-bersih-riwayat-cron.sql (lihat README). Isi:
--   * Tabel profiles: FK ke auth.users DIHAPUS (id kini berdefault acak) supaya anak Siaga dapat disimpan tanpa akun masuk; hapus akun login tetap menghapus
--     profilnya lewat pemicu profil_hapus_bersama_akun pada auth.users. Kolom baru tanpa_akun, perindukan, barung; kendala profil_peserta dilonggarkan (NIS wajib
--     hanya untuk akun yang dapat masuk) dan kendala baru profil_tanpa_akun dan profil_barung.
--   * sigarda.rombel_sah kini juga menerima kelas SD (angka 1-6 dengan satu huruf paralel opsional: 4, 5A). Nilai lama (X-01 ... XII-10) tetap sah.
--   * Fungsi baru: sigarda.siaga_periksa, sg_siaga_tambah, sg_siaga_ubah, sg_siaga_hapus, sg_barung_atur (Pembina dan Admin Gudep).
--   * sg_pemeriksaan_data ditulis ulang (tanda tangan sama): anak Siaga tidak ditandai "data diri belum lengkap".
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regprocedure('public.sg_berita_lagi(int)') is null or to_regprocedure('public.sg_galeri_lagi(int)') is null
     or (select prosrc from pg_proc where oid = to_regprocedure('public.sg_pemeriksaan_data()')) not like '%jumlahSebenarnya%' then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (sampai 2026-09-bersih-riwayat-cron.sql; lihat README), baru migrasi ini.';
  end if;
end $$;

-- Tabel profiles
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles add column if not exists tanpa_akun boolean not null default false;
alter table public.profiles add column if not exists perindukan text check (perindukan is null or (char_length(perindukan) between 1 and 40 and perindukan !~ '[[:cntrl:]<>]'));
alter table public.profiles add column if not exists barung text check (barung is null or (char_length(barung) between 1 and 40 and barung !~ '[[:cntrl:]<>]'));
alter table public.profiles drop constraint if exists profil_peserta;
alter table public.profiles add constraint profil_peserta check (role <> 'peserta' or (kelas is not null and jabatan is null and (nis is not null or tanpa_akun)));
alter table public.profiles drop constraint if exists profil_tanpa_akun;
alter table public.profiles add constraint profil_tanpa_akun check (not tanpa_akun or (role = 'peserta' and jabatan_dewan is null and not pinsa));
alter table public.profiles drop constraint if exists profil_barung;
alter table public.profiles add constraint profil_barung check (barung is null or perindukan is not null);

`;
const akhir = `

revoke all on function
  public.sg_siaga_tambah(jsonb), public.sg_siaga_ubah(uuid, jsonb), public.sg_siaga_hapus(uuid), public.sg_barung_atur(uuid[], text, text), public.sg_pemeriksaan_data()
  from public, anon, authenticated;
grant execute on function
  public.sg_siaga_tambah(jsonb), public.sg_siaga_ubah(uuid, jsonb), public.sg_siaga_hapus(uuid), public.sg_barung_atur(uuid[], text, text), public.sg_pemeriksaan_data()
  to authenticated;
-- Fungsi sigarda.* baru: hak dijalankan ulang di sini (grant "all functions in schema" tidak retroaktif untuk fungsi baru).
revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-10-siaga-anggota', kepala + rombel + '\n\n' + aksi + '\n\n' + pemeriksaan + akhir);
