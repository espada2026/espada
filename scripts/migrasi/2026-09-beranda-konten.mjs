// Menyusun supabase/migrasi/2026-09-beranda-konten.sql dari bagian di supabase/sumber (satu sumber kebenaran).
// Jalankan: node scripts/migrasi/2026-09-beranda-konten.mjs
import { ambil, gantiFungsi, kebijakanIdempoten, tabelJikaBelumAda, tulisMigrasi } from './bantu.mjs';

const tabel = tabelJikaBelumAda(ambil('-- ===== Kelola Beranda (Fase 2 landing page): tabel =====', '-- ===== akhir tabel beranda konten =====', true));
const kebijakan = kebijakanIdempoten(ambil('-- ===== Kelola Beranda (Fase 2 landing page): kebijakan =====', '-- ===== akhir kebijakan beranda konten =====', true));
const aksi = gantiFungsi(ambil('-- ===== Kelola Beranda (Fase 2 landing page): aksi =====', '-- ===== akhir aksi beranda konten =====', true));
// sg_beranda_publik (Fase 1) ditulis ulang: kini juga memuat berita, prestasi, galeri, sosial, dan faq.
const publik = gantiFungsi(ambil('create function public.sg_beranda_publik()', 'end $$;', true));
// sg_cadangan_admin ditulis ulang: 5 tabel baru ditambahkan ke daftar ekspor.
const cadangan = gantiFungsi(ambil('create function public.sg_cadangan_admin()', 'end $$;\n\n-- Kapan dan siapa yang terakhir mengunduh cadangan', true)).replace(/\n\n-- Kapan dan siapa yang terakhir mengunduh cadangan[\s\S]*$/, '');

const TABEL_BARU = ['beranda_berita', 'beranda_prestasi', 'beranda_galeri', 'beranda_sosial', 'beranda_faq'];

const kepala = `-- ============================================================================
-- MIGRASI: Fase 2 landing page -- Kelola Beranda: konten (Berita, Prestasi, Galeri, Media Sosial, Pertanyaan Umum). AMAN untuk database berisi data.
--
-- Jalankan SETELAH migrasi 2026-09-beranda.sql (bila belum, berhenti dengan pesan yang menuntun). Isi:
--   * 5 tabel baru: beranda_berita, beranda_prestasi, beranda_galeri (alur tinjauan: Dewan mengajukan, Pembina/Admin menerbitkan atau meninjau),
--     beranda_sosial (tanpa alur, langsung tampil), beranda_faq (hanya Pembina dan Admin Gudep). RLS baca: pengurus; tulis hanya lewat fungsi.
--   * Fungsi baru: sg_berita_simpan/_hapus/_tinjau, sg_prestasi_simpan/_hapus/_tinjau, sg_galeri_simpan/_hapus/_tinjau, sg_sosial_simpan/_hapus,
--     sg_faq_simpan/_hapus/_geser, dan fungsi bantu sigarda.beranda_konten_boleh_ubah, sigarda.nama_saya.
--   * sg_beranda_publik() ditulis ulang (tanda tangan sama): kini juga memuat berita, prestasi, galeri, sosial, dan faq yang TERBIT (whitelist ketat,
--     tanpa data anggota, tanpa catatan tinjauan, tanpa siapa yang menulis/meninjau).
--   * sg_cadangan_admin() ditulis ulang (tanda tangan sama): kelima tabel baru ditambahkan ke cadangan data Admin Gudep.
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regprocedure('public.sg_beranda_kontak_simpan(jsonb)') is null then
    raise exception 'Jalankan lebih dulu migrasi 2026-09-beranda.sql (lihat README), baru migrasi ini.';
  end if;
end $$;

${tabel}

${TABEL_BARU.map((t) => `alter table public.${t} enable row level security;`).join('\n')}
-- Tabel baru menerima hak penuh bawaan Supabase: dicabut agar sama dengan database baru (baca saja lewat kebijakan; tulis hanya lewat fungsi).
revoke all on ${TABEL_BARU.map((t) => `public.${t}`).join(', ')} from anon, authenticated;
grant select on ${TABEL_BARU.map((t) => `public.${t}`).join(', ')} to authenticated;
${kebijakan}

${aksi}

${publik}

${cadangan}
`;
const akhir = `

revoke all on function
  public.sg_berita_simpan(bigint, text, text, text, text, text, text, timestamptz), public.sg_berita_hapus(bigint), public.sg_berita_tinjau(bigint, text, text),
  public.sg_prestasi_simpan(bigint, text, text, text, integer, text, text, text), public.sg_prestasi_hapus(bigint), public.sg_prestasi_tinjau(bigint, text, text),
  public.sg_galeri_simpan(bigint, text, text, text, text, text), public.sg_galeri_hapus(bigint), public.sg_galeri_tinjau(bigint, text, text),
  public.sg_sosial_simpan(bigint, text, text, text, text, boolean), public.sg_sosial_hapus(bigint),
  public.sg_faq_simpan(bigint, text, text), public.sg_faq_hapus(bigint), public.sg_faq_geser(bigint, integer)
  from public, anon, authenticated;
grant execute on function
  public.sg_berita_simpan(bigint, text, text, text, text, text, text, timestamptz), public.sg_berita_hapus(bigint), public.sg_berita_tinjau(bigint, text, text),
  public.sg_prestasi_simpan(bigint, text, text, text, integer, text, text, text), public.sg_prestasi_hapus(bigint), public.sg_prestasi_tinjau(bigint, text, text),
  public.sg_galeri_simpan(bigint, text, text, text, text, text), public.sg_galeri_hapus(bigint), public.sg_galeri_tinjau(bigint, text, text),
  public.sg_sosial_simpan(bigint, text, text, text, text, boolean), public.sg_sosial_hapus(bigint),
  public.sg_faq_simpan(bigint, text, text), public.sg_faq_hapus(bigint), public.sg_faq_geser(bigint, integer)
  to authenticated;

revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-09-beranda-konten', kepala + akhir.replace(/^\n+/, '\n'));
