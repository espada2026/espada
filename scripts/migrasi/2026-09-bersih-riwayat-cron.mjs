// Menyusun supabase/migrasi/2026-09-bersih-riwayat-cron.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-09-bersih-riwayat-cron.mjs
import { ambil, gantiFungsi, tulisMigrasi } from './bantu.mjs';

// notif_pengingat ditulis ulang penuh (penanda kedelapan membungkus fungsi yang sama dengan tujuh penanda sebelumnya).
const pengingat = gantiFungsi(ambil('-- ===== Pembersihan riwayat penjadwal: pengingat =====', '-- ===== akhir pembersihan riwayat penjadwal =====', true));

const kepala = `-- ============================================================================
-- MIGRASI: pembersihan riwayat penjadwal (pg_cron). AMAN untuk database berisi data.
--
-- Jalankan SETELAH migrasi sebelumnya (sampai 2026-09-muat-lebih-lama.sql; lihat README). Isi:
--   * sigarda.notif_pengingat (pengingat harian 07.00 WIB) ditulis ulang (tanda tangan sama) agar juga menghapus riwayat pg_cron
--     (cron.job_run_details) yang lebih dari 30 hari. Pekerjaan sigarda-terbit-ulang berjalan tiap 5 menit dan tabel itu tidak dibersihkan siapa pun.
--     Tanpa pg_cron atau tanpa izin, pengingat harian tetap berjalan seperti biasa.
-- TIDAK mengubah tabel maupun data aplikasi. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regprocedure('sigarda.garuda_kalender_pengingat()') is null or to_regprocedure('public.sg_galeri_lagi(int)') is null then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (sampai 2026-09-muat-lebih-lama.sql; lihat README), baru migrasi ini.';
  end if;
end $$;

${pengingat}

-- Fungsi sigarda.* diperbarui: hak dijalankan ulang di sini.
revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-09-bersih-riwayat-cron', kepala);
