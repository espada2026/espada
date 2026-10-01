// Menyusun supabase/migrasi/2026-10-latihan-tabungan.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-10-latihan-tabungan.mjs
import { ambil, gantiFungsi, kebijakanIdempoten, tabelJikaBelumAda, tulisMigrasi } from './bantu.mjs';

const tabel = tabelJikaBelumAda(ambil('-- ===== Tabungan Siaga (Fase 3): tabel =====', '-- ===== akhir tabel tabungan =====', true));
const aksi = gantiFungsi(ambil('-- ===== Tabungan Siaga (Fase 3): aksi =====', '-- ===== akhir aksi tabungan =====', true));
const kebijakan = kebijakanIdempoten("create policy baca_tabungan_cek on public.tabungan_cek for select to authenticated\n  using ((select sigarda.aktif()) and (peserta_id = (select auth.uid()) or (select sigarda.pembina_atau_admin())));");
const buatSesi = gantiFungsi(ambil('create function public.sg_absen_buat_sesi(', 'end $$;', true));
const pencatat = gantiFungsi(ambil('create function sigarda.pencatat_iuran()', 'end $$;', true));
const kas = gantiFungsi(ambil('create function public.sg_iuran_kas_simpan(', 'end $$;', true));
const susulan = gantiFungsi(ambil('create function public.sg_iuran_susulan(', 'end $$;', true));
const cadangan = gantiFungsi(ambil('create function public.sg_cadangan_admin()', 'end $$;\n\n-- Kapan dan siapa yang terakhir mengunduh cadangan', true)).replace(/\n\n-- Kapan dan siapa yang terakhir mengunduh cadangan[\s\S]*$/, '');

const kepala = `-- ============================================================================
-- MIGRASI: Pramuka Siaga, Fase 3: latihan (hari apa pun) dan tabungan. AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-10-siaga-akun.sql (lihat README). Isi:
--   * Absensi latihan tidak lagi dibatasi hari Jumat: kendala hari pada absensi_sesi dibuang dan sg_absen_buat_sesi ditulis ulang (tanda tangan sama). Iuran memakai sesi yang sama,
--     jadi ikut bebas hari. Data lama tidak berubah.
--   * Pembina ikut dapat mencatat iuran, menutup kas, dan iuran susulan (gugus depan Siaga tidak punya Dewan Ambalan): sigarda.pencatat_iuran, sg_iuran_kas_simpan, sg_iuran_susulan
--     ditulis ulang (tanda tangan sama).
--   * Tabel baru public.tabungan_cek (Pembina memeriksa buku tabungan anak Siaga: tanggal dan setoran minggu itu; RLS baca pemilik, Pembina, Admin; tulis hanya lewat fungsi) dan
--     fungsi baru sg_tabungan_catat dan sg_tabungan_hapus (Pembina dan Admin). sg_cadangan_admin ditulis ulang agar memuat tabel baru.
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regprocedure('sigarda.kelas_siaga(text)') is null then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (sampai 2026-10-siaga-akun.sql; lihat README), baru migrasi ini.';
  end if;
end $$;

-- Membuang kendala "hanya Jumat" pada absensi_sesi (namanya dicari dari definisinya agar tahan terhadap perbedaan nama).
do $$
declare k record;
begin
  for k in select conname from pg_constraint
           where conrelid = 'public.absensi_sesi'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%dow%'
  loop
    execute format('alter table public.absensi_sesi drop constraint %I', k.conname);
  end loop;
end $$;

${buatSesi}

${pencatat}

${kas}

${susulan}

${tabel}

alter table public.tabungan_cek enable row level security;
-- Tabel baru menerima hak penuh bawaan Supabase: dicabut agar sama dengan database baru (baca saja lewat kebijakan; tulis hanya lewat fungsi).
revoke all on public.tabungan_cek from anon, authenticated;
grant select on public.tabungan_cek to authenticated;
${kebijakan}

drop trigger if exists tak_aktif_tabungan_cek on public.tabungan_cek;
create trigger tak_aktif_tabungan_cek before insert or update on public.tabungan_cek for each row execute function sigarda.tolak_peserta_tak_aktif();

${aksi}

${cadangan}
`;
const akhir = `

revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;
revoke all on function
  public.sg_absen_buat_sesi(date), public.sg_iuran_kas_simpan(date, int, text), public.sg_iuran_susulan(uuid, date, int, int),
  public.sg_tabungan_catat(uuid, date, int, text), public.sg_tabungan_hapus(uuid, date), public.sg_cadangan_admin()
  from public, anon, authenticated;
grant execute on function
  public.sg_absen_buat_sesi(date), public.sg_iuran_kas_simpan(date, int, text), public.sg_iuran_susulan(uuid, date, int, int),
  public.sg_tabungan_catat(uuid, date, int, text), public.sg_tabungan_hapus(uuid, date), public.sg_cadangan_admin()
  to authenticated;

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-10-latihan-tabungan', kepala + akhir.replace(/^\n+/, '\n'));
