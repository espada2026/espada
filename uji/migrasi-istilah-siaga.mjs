// Migrasi istilah Siaga pada teks pesan server: kesetaraan dengan skema baru (fungsi dan hak), data utuh, idempoten, dan teks pesan baru.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { skemaLama } from '../scripts/skema-lama.mjs';
import { siapkanPg, buatKlienFake } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';
import { PETA } from '../scripts/migrasi/istilah-siaga-peta.mjs';

const P = process.cwd().replace(/\\/g, '/');
let g = 0, l = 0;
const ok = (c, m) => { if (c) { l++; console.log('ok   :', m); } else { g++; console.log('GAGAL:', m); } };
const stub = readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8');
const bersih = (s) => s.replace(/^﻿/, '').replace(/\r\n/g, '\n');
const MP = bersih(readFileSync(`${P}/supabase/migrasi/2026-10-istilah-siaga.sql`, 'utf8'));
const skemaDari = (ref) => (ref === 'baru' ? readFileSync(`${P}/supabase/skema.sql`, 'utf8') : skemaLama(ref.slice(4), P));
const baru = async (ref) => { const db = new PGlite(); await siapkanPg(db, { sqlStub: stub, sqlSkema: bersih(skemaDari(ref)) }); return db; };
const cacah = async (db) => (await db.query(`select (select count(*) from public.profiles)::int p, (select count(*) from public.sku_progress)::int s, (select count(*) from public.agenda)::int a,
  (select count(*) from public.pengaturan)::int pg, (select count(*) from public.notifikasi)::int n`)).rows[0];
const potret = async (db) => {
  const q = async (sql) => (await db.query(sql)).rows;
  return {
    fungsi: await q(`select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) args, p.prosecdef, p.provolatile, pg_get_function_result(p.oid) hasil, md5(p.prosrc) badan
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'sigarda') and p.prokind = 'f' order by 1, 2, 3`),
    hakFungsi: await q(`select routine_schema, routine_name, grantee, privilege_type from information_schema.role_routine_grants
      where routine_schema in ('public', 'sigarda') and grantee in ('anon','authenticated','service_role') order by 1, 2, 3, 4`),
  };
};
const semuaIsi = async (db) => (await db.query(`select string_agg(p.prosrc, ' ') t from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'sigarda')`)).rows[0].t;

const A = await baru('baru');
const pa = await potret(A);

console.log('--- Database berisi data: kesetaraan, data utuh, idempoten ---');
const B1 = await baru('git:98daf09'); // commit TEPAT sebelum migrasi ini
await isiDataContoh(B1);
await B1.query('update public.profiles set wajib_ganti_pin = false');
const sebelum = await cacah(B1);
const isiLama = await semuaIsi(B1);
ok(PETA.every(([dari]) => isiLama.includes(dari)), `prasyarat: ke-${PETA.length} teks lama masih terpasang`);
await B1.exec(MP);
ok(JSON.stringify(await cacah(B1)) === JSON.stringify(sebelum), 'jumlah data tidak berubah oleh migrasi: ' + JSON.stringify(sebelum));
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

console.log('\n--- Sesudah migrasi: pesan memakai istilah Siaga ---');
{
  const isi = await semuaIsi(B1);
  ok(PETA.every(([dari]) => !isi.includes(dari)), 'semua teks lama sudah tidak ada');
  ok(PETA.every(([, ke]) => isi.includes(ke)), 'semua teks baru terpasang');
  const adm = buatApi(buatKlienFake(B1));
  await adm.masuk('admin', PIN_DEMO.admin);
  ok((await adm.simpanTema('asli')).ok, 'fungsi lain tetap berjalan (simpan tema)');
  const pembina = buatApi(buatKlienFake(B1));
  await pembina.masuk('pembina', PIN_DEMO.pembina);
  const r = await pembina.simpanTema('asli');
  ok(!r.ok && /Hanya Admin/.test(r.pesan ?? ''), 'hak akses fungsi tidak berubah');
}

console.log(`\nRINGKASAN MIGRASI ISTILAH-SIAGA: ${l} lulus, ${g} GAGAL`);
process.exit(g ? 1 : 0);
