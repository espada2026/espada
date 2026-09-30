// Migrasi Pramuka Siaga Fase 1 (anggota tanpa akun): kesetaraan dengan skema baru (kolom, kendala, fungsi, hak, pemicu), data utuh, idempoten, perilaku baru,
// dan gagal jelas bila prasyarat belum ada.
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
const MP = bersih(readFileSync(`${P}/supabase/migrasi/2026-10-siaga-anggota.sql`, 'utf8'));

const skemaDari = (ref) => (ref === 'baru' ? readFileSync(`${P}/supabase/skema.sql`, 'utf8') : skemaLama(ref.slice(4), P));
const baru = async (ref) => { const db = new PGlite(); await siapkanPg(db, { sqlStub: stub, sqlSkema: bersih(skemaDari(ref)) }); return db; };
const cacah = async (db) => (await db.query(`select (select count(*) from public.profiles)::int p, (select count(*) from public.sku_progress)::int s, (select count(*) from public.agenda)::int a,
  (select count(*) from public.notifikasi)::int n, (select count(*) from public.penugasan_rombel)::int pr`)).rows[0];
const potret = async (db) => {
  const q = async (sql) => (await db.query(sql)).rows;
  return {
    fungsi: await q(`select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) args, p.prosecdef, p.provolatile, pg_get_function_result(p.oid) hasil, md5(p.prosrc) badan
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'sigarda') and p.prokind = 'f' order by 1, 2, 3`),
    hakFungsi: await q(`select routine_schema, routine_name, grantee, privilege_type from information_schema.role_routine_grants
      where routine_schema in ('public', 'sigarda') and grantee in ('anon','authenticated','service_role') order by 1, 2, 3, 4`),
    kolom: await q(`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'profiles' order by 1`),
    batasan: await q(`select conname, pg_get_constraintdef(oid) def from pg_constraint where conrelid = 'public.profiles'::regclass order by 1`),
    indeks: await q(`select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = 'profiles' order by 1`),
    pemicu: await q(`select tgrelid::regclass::text tabel, tgname from pg_trigger where not tgisinternal and (tgrelid::regclass::text like 'public.%' or tgrelid::regclass::text = 'auth.users') order by 1, 2`),
    hakTabel: await q(`select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'profiles' and grantee in ('anon','authenticated') order by 1, 2, 3`),
  };
};

const A = await baru('baru');
const pa = await potret(A);

console.log('--- Database berisi data: kesetaraan, data utuh, idempoten ---');
const B1 = await baru('git:ad277d8'); // commit TEPAT sebelum migrasi ini
await isiDataContoh(B1);
await B1.query('update public.profiles set wajib_ganti_pin = false');
const sebelum = await cacah(B1);
const md5Fungsi = async (db, nama) => (await db.query(`select md5(p.prosrc) m from pg_proc p where p.proname = $1`, [nama])).rows[0].m;
ok((await B1.query(`select count(*)::int n from information_schema.columns where table_name = 'profiles' and column_name = 'tanpa_akun'`)).rows[0].n === 0, 'prasyarat: kolom tanpa_akun belum ada');
const lama = { pem: await md5Fungsi(B1, 'sg_pemeriksaan_data'), rs: await md5Fungsi(B1, 'rombel_sah') };
await B1.exec(MP);
ok(JSON.stringify(await cacah(B1)) === JSON.stringify(sebelum), 'jumlah data tidak berubah oleh migrasi: ' + JSON.stringify(sebelum));
ok(await md5Fungsi(B1, 'sg_pemeriksaan_data') !== lama.pem && await md5Fungsi(B1, 'rombel_sah') !== lama.rs, 'sg_pemeriksaan_data dan rombel_sah ditulis ulang oleh migrasi');
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
  const r = await pembina.tambahSiaga([{ nama: 'Anak Uji', kelas: '4A', perindukan: 'Melati', barung: 'Kancil' }]);
  ok(r.ok && r.data === 1, 'Pembina menambah anggota Siaga pada database hasil migrasi ' + (r.pesan ?? ''));
  ok((await B1.query("select count(*)::int n from public.profiles where tanpa_akun and kelas = '4A'")).rows[0].n === 1, 'anggota tersimpan tanpa akun');
  const rs = (await B1.query("select sigarda.rombel_sah('5B') a, sigarda.rombel_sah('X-01') b, sigarda.rombel_sah('7') c")).rows[0];
  ok(rs.a === true && rs.b === true && rs.c === false, 'rombel_sah menerima kelas SD dan tetap menerima rombel lama');
  const uid = (await B1.query("select id from public.profiles where username = '10232'")).rows[0].id;
  await B1.query('delete from auth.users where id = $1', [uid]);
  ok((await B1.query('select count(*)::int n from public.profiles where id = $1', [uid])).rows[0].n === 0, 'hapus akun login tetap menghapus profilnya (pemicu)');
}

console.log('\n--- Tanpa migrasi sebelumnya: gagal jelas ---');
const B3 = await baru('git:40c98fe'); // jauh sebelum: tanpa jumlahSebenarnya
let galat = null;
try { await B3.exec(MP); } catch (e) { galat = e.message; await B3.exec('rollback'); }
ok(/Jalankan lebih dulu skema dan migrasi/.test(galat ?? ''), 'pesan yang menuntun: ' + (galat ?? 'TIDAK GAGAL').slice(0, 100));
ok((await B3.query(`select count(*)::int n from information_schema.columns where table_name = 'profiles' and column_name = 'tanpa_akun'`)).rows[0].n === 0, 'kegagalan membatalkan seluruh migrasi');

console.log(`\nRINGKASAN MIGRASI SIAGA-ANGGOTA: ${l} lulus, ${g} GAGAL`);
process.exit(g ? 1 : 0);
