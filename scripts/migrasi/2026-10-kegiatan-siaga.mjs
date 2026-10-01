// Menyusun supabase/migrasi/2026-10-kegiatan-siaga.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-10-kegiatan-siaga.mjs
import { ambil, gantiFungsi, tulisMigrasi } from './bantu.mjs';

const agendaSimpan = gantiFungsi(ambil('create function public.sg_agenda_simpan(', 'end $$;', true));
const eskIsi = gantiFungsi(ambil('create function sigarda.eskalasi_isi(', '\n$$;', true));
const eskProses = gantiFungsi(ambil('create function sigarda.eskalasi_proses()', 'end $$;', true));
const eskDaftar = gantiFungsi(ambil('create function public.sg_eskalasi_daftar()', 'end $$;', true));

const kepala = `-- ============================================================================
-- MIGRASI: Pramuka Siaga, Fase 8: kegiatan Siaga di Agenda dan pengingat yang cocok untuk Siaga. AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-10-siaga-garuda.sql (lihat README). Isi:
--   * Kendala jenis pada public.agenda diperluas: 'pesta_siaga', 'persari', 'pertemuan_siaga' (pertemuan Siaga di kwartir), 'pelantikan_siaga'.
--     Kolom peserta_terkait pada jenis-jenis itu dipakai sebagai daftar anak yang IKUT (dasar saran butir 4 dan 5 Siaga Garuda di aplikasi).
--   * sg_agenda_simpan ditulis ulang (tanda tangan sama): menerima empat jenis baru.
--   * Pengingat: kalimat eskalasi tidak lagi menyebut "Jumat"; anak Siaga TANPA AKUN (tidak punya akun untuk diingatkan) kini ikut: hanya kejadian absensi
--     (2 sesi terakhir Alpa) dan hanya pada tingkat mendesak (hari 8+), memberi tahu pengurus dan muncul di Tindak Lanjut (baris diberi tanda tanpaAkun).
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regclass('public.siaga_garuda') is null then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (sampai 2026-10-siaga-garuda.sql; lihat README), baru migrasi ini.';
  end if;
end $$;

alter table public.agenda drop constraint if exists agenda_jenis_check;
alter table public.agenda add constraint agenda_jenis_check check (jenis in (
  'musyawarah','naik_kelas','sidang','pelantikan_bantara','pelantikan_laksana','pelantikan_garuda','lainnya',
  'pengembaraan','perkemahan','gelora_saka_expo','gladi_tangguh_1','gladi_tangguh_2','penempuhan_sku_laksana','ptgd','pembekalan_dewan',
  'pesta_siaga','persari','pertemuan_siaga','pelantikan_siaga'
));

${agendaSimpan}

${eskIsi}

${eskProses}

${eskDaftar}

revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;
revoke all on function public.sg_agenda_simpan(bigint, text, text, text, date, text, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.sg_agenda_simpan(bigint, text, text, text, date, text, uuid[], boolean) to authenticated;
revoke all on function public.sg_eskalasi_daftar() from public, anon, authenticated;
grant execute on function public.sg_eskalasi_daftar() to authenticated;

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-10-kegiatan-siaga', kepala);
