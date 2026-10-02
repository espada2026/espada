// Menyusun supabase/migrasi/2026-10-tema-tampilan.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-10-tema-tampilan.mjs
import { ambil, gantiFungsi, tulisMigrasi } from './bantu.mjs';

const fungsi = gantiFungsi(ambil('-- ===== Tema tampilan: fungsi =====', '-- ===== akhir fungsi tema tampilan =====', true));

const kepala = `-- ============================================================================
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

${fungsi}
`;
const akhir = `

revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;
revoke all on function public.sg_tema_simpan(text) from public, anon, authenticated;
grant execute on function public.sg_tema_simpan(text) to authenticated;
revoke all on function public.sg_gudep_publik() from public, anon, authenticated;
grant execute on function public.sg_gudep_publik() to anon, authenticated;

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-10-tema-tampilan', kepala + akhir.replace(/^\n+/, '\n'));
