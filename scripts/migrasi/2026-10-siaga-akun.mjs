// Menyusun supabase/migrasi/2026-10-siaga-akun.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-10-siaga-akun.mjs
import { ambil, gantiFungsi, tulisMigrasi } from './bantu.mjs';

const kelasSiaga = gantiFungsi(ambil('create function sigarda.kelas_siaga(', '$$;', true));
const ubah = gantiFungsi(ambil('create function public.sg_siaga_ubah(', 'end $$;', true));
const hapus = gantiFungsi(ambil('create function public.sg_siaga_hapus(', 'end $$;', true));
const barung = gantiFungsi(ambil('create function public.sg_barung_atur(', 'end $$;', true));
const pengujiPeran = gantiFungsi(ambil('create function sigarda.penguji_peran_ok(', 'end $$;', true));
const catat = gantiFungsi(ambil('create function public.sg_sku_catat_internal(', 'end $$;', true));
const ajukan = gantiFungsi(ambil('create function public.sg_sku_ajukan(', 'end $$;', true));
const pemicu = gantiFungsi(ambil('create function sigarda.tolak_peserta_tak_aktif()', 'end $$;', true));
const pemeriksaan = gantiFungsi(ambil('create function public.sg_pemeriksaan_data()', 'end $$;', true));

const kepala = `-- ============================================================================
-- MIGRASI: Pramuka Siaga, Fase 2b: anak Siaga boleh punya akun masuk. AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-10-sku-siaga.sql (lihat README). Isi:
--   * Fungsi baru sigarda.kelas_siaga: anggota Siaga = anak berkelas SD (angka 1-6 + paralel), dengan atau tanpa akun masuk.
--   * sg_siaga_ubah, sg_siaga_hapus, sg_barung_atur ditulis ulang (tanda tangan sama): berlaku juga untuk anak Siaga berakun (NIS anak berakun tidak diubah dari sini;
--     anak berakun tidak dihapus lewat sg_siaga_hapus, hapus akunnya lewat menu Anggota Admin).
--   * sg_sku_ajukan ditulis ulang: pengajuan anak Siaga tidak melewati pra-uji (langsung ke antrian Pembina); butir Siaga hanya untuk anak berkelas SD dan butir Penegak hanya untuk Penegak.
--   * sg_sku_catat_internal ditulis ulang (aturan tingkat butir sesuai kelas) dan sigarda.penguji_peran_ok: anak Siaga hanya diuji Pembina (bukan Dewan Ambalan).
--   * sigarda.tolak_peserta_tak_aktif: pesan agama kosong untuk anak Siaga menuntun Pembina ke menu Anggota Siaga.
--   * sg_pemeriksaan_data ditulis ulang: anak Siaga berakun tidak ditandai "data diri belum lengkap" (isian data diri itu untuk Penegak).
-- Edge Function sigarda BERUBAH (Pembina boleh membuat akun anggota/peserta): deploy ulang di Dashboard Supabase agar Pembina dapat membuat akun anak.
-- TIDAK menghapus data. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regprocedure('sigarda.prasyarat_tingkat(text)') is null then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (sampai 2026-10-sku-siaga.sql; lihat README), baru migrasi ini.';
  end if;
end $$;

${kelasSiaga}

${ubah}

${hapus}

${barung}

${ajukan}

${catat}

${pengujiPeran}

${pemicu}

${pemeriksaan}
`;
const akhir = `

revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-10-siaga-akun', kepala + akhir);
