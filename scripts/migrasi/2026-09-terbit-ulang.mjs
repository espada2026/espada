// Menyusun supabase/migrasi/2026-09-terbit-ulang.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-09-terbit-ulang.mjs
import { ambil, gantiFungsi, tabelJikaBelumAda, tulisMigrasi } from './bantu.mjs';

const pemicuIdempoten = (s, nama, tabel) => s.replace(new RegExp(`^create trigger ${nama} `, 'm'), `drop trigger if exists ${nama} on ${tabel};\ncreate trigger ${nama} `);

const tabel = tabelJikaBelumAda(ambil('-- ===== Terbit ulang situs saat berita terbit: tabel =====', '-- ===== akhir tabel terbit ulang =====', true));
const fungsi = pemicuIdempoten(gantiFungsi(ambil('-- ===== Terbit ulang situs saat berita terbit: fungsi =====', '-- ===== akhir fungsi terbit ulang =====', true)), 'terbit_ulang_berita', 'public.beranda_berita');

const kepala = `-- ============================================================================
-- MIGRASI: terbit ulang situs saat berita diterbitkan (pengganti deploy harian). AMAN untuk database berisi data.
--
-- Jalankan SETELAH migrasi 2026-09-berita-publik.sql (bila belum, berhenti dengan pesan yang menuntun). Isi:
--   * Tabel public.terbit_ulang_konfigurasi (satu baris; memuat kunci akses GitHub yang RAHASIA: RLS tanpa kebijakan, tanpa hak baca, tidak ikut cadangan).
--   * Fungsi sigarda.terbit_ulang_atur / _kirim / _keadaan / _matikan (hanya dari SQL Editor), _periksa / _catat / _kirim_sekarang (dijalankan pg_cron dan fungsi lain),
--     pemicu pada beranda_berita yang menandai perubahan berita terbit, dan fungsi aplikasi sg_terbit_ulang_status / sg_terbit_ulang_minta (Pembina dan Admin Gudep).
--   * Belum melakukan apa pun sampai pemilik menjalankan sigarda.terbit_ulang_atur (lihat README, bagian "Halaman berita untuk mesin pencari").
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regprocedure('public.sg_berita_publik()') is null then
    raise exception 'Jalankan lebih dulu migrasi 2026-09-berita-publik.sql (lihat README), baru migrasi ini.';
  end if;
end $$;

${tabel}

alter table public.terbit_ulang_konfigurasi enable row level security;
-- Tabel baru menerima hak penuh bawaan Supabase: dicabut (memuat kunci akses; hanya fungsi yang boleh menyentuhnya).
revoke all on public.terbit_ulang_konfigurasi from anon, authenticated;

${fungsi}
`;
const akhir = `

revoke all on function public.sg_terbit_ulang_status(), public.sg_terbit_ulang_minta() from public, anon, authenticated;
grant execute on function public.sg_terbit_ulang_status(), public.sg_terbit_ulang_minta() to authenticated;
-- Fungsi sigarda.* baru: hak dijalankan ulang di sini (grant "all functions in schema" tidak retroaktif untuk fungsi baru).
revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-09-terbit-ulang', kepala + akhir.replace(/^\n+/, '\n'));
