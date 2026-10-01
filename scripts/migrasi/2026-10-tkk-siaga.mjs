// Menyusun supabase/migrasi/2026-10-tkk-siaga.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-10-tkk-siaga.mjs
import { ambil, gantiFungsi, kebijakanIdempoten, tabelJikaBelumAda, tulisMigrasi } from './bantu.mjs';

const tabel = tabelJikaBelumAda(ambil('-- ===== TKK Siaga (Pramuka Siaga, Fase 5): tabel =====', '-- ===== akhir tabel tkk siaga =====', true));
const aksi = gantiFungsi(ambil('-- ===== TKK Siaga (Pramuka Siaga, Fase 5): aksi =====', '-- ===== akhir aksi tkk siaga =====', true));
const kebijakan = kebijakanIdempoten("create policy baca_tkk_siaga on public.tkk_siaga for select to authenticated\n  using ((select sigarda.aktif()) and (peserta_id = (select auth.uid()) or (select sigarda.pembina_atau_admin())));");
const cadangan = gantiFungsi(ambil('create function public.sg_cadangan_admin()', 'end $$;\n\n-- Kapan dan siapa yang terakhir mengunduh cadangan', true)).replace(/\n\n-- Kapan dan siapa yang terakhir mengunduh cadangan[\s\S]*$/, '');

const kepala = `-- ============================================================================
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

${tabel}

alter table public.tkk_siaga enable row level security;
-- Tabel baru menerima hak penuh bawaan Supabase: dicabut agar sama dengan database baru (baca saja lewat kebijakan; tulis hanya lewat fungsi).
revoke all on public.tkk_siaga from anon, authenticated;
grant select on public.tkk_siaga to authenticated;
${kebijakan}

drop trigger if exists tak_aktif_tkk_siaga on public.tkk_siaga;
create trigger tak_aktif_tkk_siaga before insert or update on public.tkk_siaga for each row execute function sigarda.tolak_peserta_tak_aktif();

${aksi}

${cadangan}
`;
const akhir = `

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
`;
tulisMigrasi('2026-10-tkk-siaga', kepala + akhir.replace(/^\n+/, '\n'));
