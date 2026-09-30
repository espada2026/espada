// Menyusun supabase/migrasi/2026-10-sku-siaga.sql dari bagian di supabase/sumber (satu sumber kebenaran) dan katalog di src/data/skuData.js + skuSiagaData.js.
// Jalankan: node scripts/migrasi/2026-10-sku-siaga.mjs
import { ambil, gantiFungsi, tulisMigrasi } from './bantu.mjs';
import { INDEKS_POIN } from '../../src/data/skuData.js';
import { TINGKAT_SIAGA } from '../../src/data/skuSiaga.js';

const q = (teks) => `'${String(teks).replace(/'/g, "''")}'`;

const prasyarat = gantiFungsi(ambil('-- ===== SKU Siaga (Pramuka Siaga, Fase 2): prasyarat tingkat =====', '-- ===== akhir prasyarat tingkat =====', true));
const ajukan = gantiFungsi(ambil('create function public.sg_sku_ajukan(', 'end $$;', true));
const catat = gantiFungsi(ambil('create function public.sg_sku_catat_internal(', 'end $$;', true));
const pemicu = gantiFungsi(ambil('create function sigarda.tolak_peserta_tak_aktif()', 'end $$;', true));
const eskalasiProses = gantiFungsi(ambil('create function sigarda.eskalasi_proses()', 'end $$;', true));
const eskalasiDaftar = gantiFungsi(ambil('create function public.sg_eskalasi_daftar()', 'end $$;', true));

// Katalog Siaga: sama dengan yang dibangkitkan scripts/buat-skema.mjs, tetapi idempoten (tidak menimpa baris yang sudah ada).
const butir = Object.entries(TINGKAT_SIAGA).flatMap(([tingkat, t]) => t.butir.map((b) => ({ id: b.id, tingkat, no: b.no, teks: b.teks ?? 'Sesuai agama yang dianut (ketakwaan)' })));
const unit = Object.entries(INDEKS_POIN)
  .filter(([id, p]) => !id.includes('-LAIN-') && ['Mula', 'Bantu', 'Tata'].includes(p.tingkat))
  .map(([id, p]) => ({ id, butirId: id.split('-').slice(0, 2).join('-'), tingkat: p.tingkat, butirNo: p.butirNo, agama: p.agama, sub: p.sub }))
  .sort((a, b) => a.id.localeCompare(b.id));
const katalog = `insert into public.sku_butir (id, tingkat, no, teks) values\n`
  + butir.map((b) => `  (${q(b.id)}, ${q(b.tingkat)}, ${b.no}, ${q(b.teks)})`).join(',\n')
  + `\non conflict (id) do nothing;\n\ninsert into public.sku_unit (id, butir_id, tingkat, butir_no, agama, sub) values\n`
  + unit.map((u) => `  (${q(u.id)}, ${q(u.butirId)}, ${q(u.tingkat)}, ${u.butirNo}, ${u.agama ? q(u.agama) : 'null'}, ${u.sub ?? 'null'})`).join(',\n')
  + `\non conflict (id) do nothing;`;

const kepala = `-- ============================================================================
-- MIGRASI: Pramuka Siaga, Fase 2: SKU Siaga (Mula, Bantu, Tata). AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-10-siaga-anggota.sql (lihat README). Isi:
--   * Kendala sku_butir_tingkat_check diperluas: tingkat Mula, Bantu, Tata (selain Bantara dan Laksana).
--   * Katalog SKU Siaga (SK Kwarnas 119/2011): ${butir.length} butir dan ${unit.length} unit (sub-butir agama), isi sama dengan src/data/skuSiagaData.js. Tidak menimpa baris yang sudah ada.
--   * Fungsi baru sigarda.prasyarat_tingkat (Laksana menunggu Bantara, Bantu menunggu Mula, Tata menunggu Bantu).
--   * sg_sku_ajukan dan sg_sku_catat_internal ditulis ulang (tanda tangan sama): aturan "tingkat sebelumnya selesai dulu" berlaku umum, bukan hanya Laksana.
--   * sigarda.tolak_peserta_tak_aktif ditulis ulang: pesan untuk anak Siaga tanpa agama menyuruh Pembina mengisinya di menu Anggota Siaga.
--   * sigarda.eskalasi_proses dan sg_eskalasi_daftar ditulis ulang (tanda tangan sama): anak Siaga tanpa akun tidak ikut tangga pengingat "tidak bergerak" dan Tindak Lanjut.
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'tanpa_akun') then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (sampai 2026-10-siaga-anggota.sql; lihat README), baru migrasi ini.';
  end if;
end $$;

-- Katalog: kendala tingkat diperluas lebih dulu, baru baris Siaga dimasukkan.
alter table public.sku_butir drop constraint if exists sku_butir_tingkat_check;
alter table public.sku_butir add constraint sku_butir_tingkat_check check (tingkat in ('Bantara','Laksana','Mula','Bantu','Tata'));

${katalog}

${prasyarat}

${ajukan}

${catat}

${pemicu}

${eskalasiProses}

${eskalasiDaftar}
`;
const akhir = `

-- Fungsi sigarda.* baru: hak dijalankan ulang di sini (grant "all functions in schema" tidak retroaktif untuk fungsi baru).
revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
`;
tulisMigrasi('2026-10-sku-siaga', kepala + akhir);
