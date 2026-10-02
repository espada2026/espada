// Migrasi Pramuka Siaga Fase 5 (TKK anak Siaga): kesetaraan dengan skema baru (tabel, fungsi, hak), data utuh, idempoten,
// perilaku baru, dan gagal jelas bila prasyarat belum ada.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { skemaLama } from '../scripts/skema-lama.mjs';
import { siapkanPg, buatKlienFake } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';

const P = process.cwd().replace(/\\/g, '/');
let g = 0, l = 0;
const ok = (c, m) => { if (c) { l++; console.log('ok   :', m); } else { g++; console.log('GAGAL:', m); } };
const stub = readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8');
const bersih = (s) => s.replace(/^﻿/, '').replace(/\r\n/g, '\n');
const MP = bersih(readFileSync(`${P}/supabase/migrasi/2026-10-tkk-siaga.sql`, 'utf8'));

const skemaDari = (ref) => (ref === 'baru' ? readFileSync(`${P}/supabase/skema.sql`, 'utf8') : skemaLama(ref.slice(4), P));
const baru = async (ref) => { const db = new PGlite(); await siapkanPg(db, { sqlStub: stub, sqlSkema: bersih(skemaDari(ref)) }); return db; };
const cacah = async (db) => (await db.query(`select (select count(*) from public.profiles)::int p, (select count(*) from public.sku_progress)::int s, (select count(*) from public.agenda)::int a,
  (select count(*) from public.notifikasi)::int n, (select count(*) from public.penugasan_rombel)::int pr, (select count(*) from public.absensi_sesi)::int ab, (select count(*) from public.iuran)::int iu`)).rows[0];
const potret = async (db) => {
  const q = async (sql) => (await db.query(sql)).rows;
  return {
    fungsi: await q(`select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) args, p.prosecdef, p.provolatile, pg_get_function_result(p.oid) hasil, md5(p.prosrc) badan
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'sigarda') and p.prokind = 'f' and p.proname not in ('sg_tema_simpan', 'sg_gudep_publik', 'eskalasi_isi', 'pra_uji_teruskan', 'sg_absen_buat_sesi', 'sg_absen_hapus_sesi', 'sg_agenda_simpan', 'sg_anggota_status_atur', 'sg_asisten_iuran_atur', 'sg_beranda_kontak_simpan', 'sg_berita_simpan', 'sg_eskalasi_daftar', 'sg_galeri_simpan', 'sg_iuran_kas_simpan', 'sg_iuran_lembar', 'sg_iuran_ringkas', 'sg_iuran_set', 'sg_iuran_set_banyak', 'sg_iuran_susulan', 'sg_naik_kelas', 'sg_pemeriksaan_data', 'sg_penguji_pilihan', 'sg_prestasi_simpan', 'sg_push_ringkasan', 'sg_rombel_perbarui', 'sg_sesi_simpan', 'sg_sesi_status', 'sg_sku_alihkan', 'sg_sku_catat_internal', 'sg_sku_catat_rubrik_internal', 'sg_sosial_simpan', 'sg_sertifikat_tingkat', 'sg_agenda_simpan', 'eskalasi_isi', 'eskalasi_proses', 'sg_eskalasi_daftar', 'sg_cadangan_admin', 'sg_siaga_garuda_catat', 'sg_siaga_garuda_hapus') order by 1, 2, 3`),
    hakFungsi: await q(`select routine_schema, routine_name, grantee, privilege_type from information_schema.role_routine_grants
      where routine_schema in ('public', 'sigarda') and routine_name not in ('sg_tema_simpan', 'sg_gudep_publik', 'eskalasi_isi', 'pra_uji_teruskan', 'sg_absen_buat_sesi', 'sg_absen_hapus_sesi', 'sg_agenda_simpan', 'sg_anggota_status_atur', 'sg_asisten_iuran_atur', 'sg_beranda_kontak_simpan', 'sg_berita_simpan', 'sg_eskalasi_daftar', 'sg_galeri_simpan', 'sg_iuran_kas_simpan', 'sg_iuran_lembar', 'sg_iuran_ringkas', 'sg_iuran_set', 'sg_iuran_set_banyak', 'sg_iuran_susulan', 'sg_naik_kelas', 'sg_pemeriksaan_data', 'sg_penguji_pilihan', 'sg_prestasi_simpan', 'sg_push_ringkasan', 'sg_rombel_perbarui', 'sg_sesi_simpan', 'sg_sesi_status', 'sg_sku_alihkan', 'sg_sku_catat_internal', 'sg_sku_catat_rubrik_internal', 'sg_sosial_simpan', 'sg_sertifikat_tingkat', 'sg_agenda_simpan', 'eskalasi_isi', 'eskalasi_proses', 'sg_eskalasi_daftar', 'sg_cadangan_admin', 'sg_siaga_garuda_catat', 'sg_siaga_garuda_hapus') and grantee in ('anon','authenticated','service_role') order by 1, 2, 3, 4`),
    batasan: await q(`select conrelid::regclass::text tabel, conname, pg_get_constraintdef(oid) def from pg_constraint where conrelid = 'public.tkk_siaga'::regclass order by 1, 2`),
    kolom: await q(`select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'tkk_siaga' order by 1, 2`),
    kebijakan: await q(`select tablename, policyname, cmd, qual from pg_policies where schemaname = 'public' and tablename = 'tkk_siaga' order by 1, 2`),
    rls: await q(`select relname, relrowsecurity from pg_class where relname = 'tkk_siaga'`),
    pemicu: await q(`select tgrelid::regclass::text tabel, tgname from pg_trigger where not tgisinternal and (tgrelid::regclass::text like 'public.%' or tgrelid::regclass::text = 'auth.users') order by 1, 2`),
    hakTabel: await q(`select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'tkk_siaga' and grantee in ('anon','authenticated') order by 1, 2, 3`),
  };
};

const A = await baru('baru');
const pa = await potret(A);

console.log('--- Database berisi data: kesetaraan, data utuh, idempoten ---');
const B1 = await baru('git:e8784a6'); // commit TEPAT sebelum migrasi ini
await isiDataContoh(B1);
await B1.query('update public.profiles set wajib_ganti_pin = false');
const sebelum = await cacah(B1);
const md5Fungsi = async (db, nama) => (await db.query(`select md5(p.prosrc) m from pg_proc p where p.proname = $1`, [nama])).rows[0].m;
ok((await B1.query(`select to_regclass('public.tkk_siaga') t`)).rows[0].t === null, 'prasyarat: tabel tkk_siaga belum ada');
const lama = { cadangan: await md5Fungsi(B1, 'sg_cadangan_admin') };
await B1.exec(MP);
ok(JSON.stringify(await cacah(B1)) === JSON.stringify(sebelum), 'jumlah data tidak berubah oleh migrasi: ' + JSON.stringify(sebelum));
ok(await md5Fungsi(B1, 'sg_cadangan_admin') !== lama.cadangan, 'sg_cadangan_admin ditulis ulang oleh migrasi');
await B1.exec(MP); await B1.exec(MP);
ok(JSON.stringify(await cacah(B1)) === JSON.stringify(sebelum), 'menjalankan migrasi tiga kali: data tetap sama');
const pb = await potret(B1);
for (const k of Object.keys(pa)) {
  const sama = JSON.stringify(pa[k]) === JSON.stringify(pb[k]);
  ok(sama, `katalog setara (${k}): ${pa[k].length} entri`);
  if (!sama) {
    const a = new Set(pa[k].map((x) => JSON.stringify(x))), b = new Set(pb[k].map((x) => JSON.stringify(x)));
    console.log('   hanya di skema baru =', [...a].filter((x) => !b.has(x)).slice(0, 5), '\n   hanya di migrasi =', [...b].filter((x) => !a.has(x)).slice(0, 5));
  }
}

console.log('\n--- Sesudah migrasi: perilaku baru ---');
{
  const pembina = buatApi(buatKlienFake(B1));
  await pembina.masuk('pembina', PIN_DEMO.pembina);
  await pembina.tambahSiaga([{ nama: 'Anak Migrasi', kelas: '4A', agama: 'Islam' }]);
  const id = (await B1.query(`select id from public.profiles where nama = 'Anak Migrasi'`)).rows[0].id;
  await B1.query(`insert into public.sku_progress (peserta_id, sku_id, status) select p.id, u.id, 'lulus' from public.profiles p join public.sku_unit u on u.tingkat in ('Mula', 'Bantu') and (u.agama is null or u.agama = p.agama) where p.id = $1`, [id]);
  let r = await pembina.catatTkkSiaga({ pesertaId: id, tkkId: 'menyanyi', tanggal: '2026-09-01', penguji: 'Bunda Ani' });
  ok(r.ok, 'TKK Siaga dapat dicatat sesudah migrasi ' + (r.pesan ?? ''));
  r = await pembina.catatTkkSiaga({ pesertaId: id, tkkId: 'berkemah', tanggal: '2026-09-01', penguji: 'Bunda Ani' });
  ok(!r.ok && /belum dipakai untuk golongan Siaga/.test(r.pesan), 'SKK tambahan ditolak');
  const adm = buatApi(buatKlienFake(B1));
  await adm.masuk('admin', PIN_DEMO.admin);
  const cad = await adm.unduhCadangan();
  ok(cad.ok && JSON.stringify(cad.data).includes('"tkk_siaga"'), 'cadangan memuat tkk_siaga');
}

console.log('\n--- Tanpa migrasi sebelumnya: gagal jelas ---');
const B3 = await baru('git:538d8d6'); // sebelum latihan-tabungan: tanpa tabel tabungan_cek
let galat = null;
try { await B3.exec(MP); } catch (e) { galat = e.message; await B3.exec('rollback'); }
ok(/Jalankan lebih dulu skema dan migrasi/.test(galat ?? ''), 'pesan yang menuntun: ' + (galat ?? 'TIDAK GAGAL').slice(0, 100));
ok((await B3.query(`select to_regclass('public.tkk_siaga') t`)).rows[0].t === null, 'kegagalan membatalkan seluruh migrasi');

console.log(`\nRINGKASAN MIGRASI TKK-SIAGA: ${l} lulus, ${g} GAGAL`);
process.exit(g ? 1 : 0);
