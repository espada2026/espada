// Migrasi beranda publik (Fase 1 landing page): kesetaraan dengan skema baru (fungsi dan hak; tanpa tabel baru), data utuh, idempoten, perilaku baru,
// dan gagal jelas bila prasyarat belum ada.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { skemaLama } from '../scripts/skema-lama.mjs';
import { siapkanPg, buatKlienFake, sqlSebagai } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';

const P = process.cwd().replace(/\\/g, '/');
let g = 0, l = 0;
const ok = (c, m) => { if (c) { l++; console.log('ok   :', m); } else { g++; console.log('GAGAL:', m); } };
const stub = readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8');
const bersih = (s) => s.replace(/^﻿/, '').replace(/\r\n/g, '\n');
const MP = bersih(readFileSync(`${P}/supabase/migrasi/2026-09-beranda.sql`, 'utf8'));

const skemaDari = (ref) => (ref.startsWith('git:') ? skemaLama(ref.slice(4), P) : readFileSync(ref, 'utf8'));
const baru = async (skemaFile) => { const db = new PGlite(); await siapkanPg(db, { sqlStub: stub, sqlSkema: bersih(skemaDari(skemaFile)) }); return db; };
const cacah = async (db) => (await db.query(`select (select count(*) from public.profiles)::int p, (select count(*) from public.sku_progress)::int s, (select count(*) from public.agenda)::int a,
  (select count(*) from public.pengaturan)::int pe, (select count(*) from public.notifikasi)::int no`)).rows[0];
const potret = async (db) => {
  const q = async (sql) => (await db.query(sql)).rows;
  return {
    fungsi: await q(`select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) args, p.prosecdef, p.provolatile, pg_get_function_result(p.oid) hasil, md5(p.prosrc) badan
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'sigarda') and p.prokind = 'f' order by 1, 2, 3`),
    hakFungsi: await q(`select routine_schema, routine_name, grantee, privilege_type from information_schema.role_routine_grants
      where routine_schema in ('public', 'sigarda') and grantee in ('anon','authenticated','service_role') order by 1, 2, 3, 4`),
    hakTabel: await q(`select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon','authenticated') order by 1, 2, 3`),
    tabel: await q(`select table_name from information_schema.tables where table_schema = 'public' order by 1`),
  };
};

const A = await baru('git:bab5bfd'); // skema tepat sesudah migrasi ini; migrasi berikutnya (beranda konten) menulis ulang sg_beranda_publik dan sg_cadangan_admin
const pa = await potret(A);

console.log('--- Database berisi data: kesetaraan, data utuh, idempoten ---');
const B1 = await baru('git:89e2051'); // commit TEPAT sebelum migrasi ini (main sesudah PR #39)
await isiDataContoh(B1);
await B1.query('update public.profiles set wajib_ganti_pin = false');
const sebelum = await cacah(B1);
ok((await B1.query(`select to_regprocedure('public.sg_beranda_publik()') as f`)).rows[0].f === null, 'prasyarat: skema lama belum punya sg_beranda_publik');
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
ok(!pb.hakFungsi.some((h) => h.grantee === 'anon' && h.routine_name === 'sg_beranda_kontak_simpan') && pb.hakFungsi.some((h) => h.grantee === 'anon' && h.routine_name === 'sg_beranda_publik'),
  'hak: anon hanya boleh sg_beranda_publik (membaca), bukan sg_beranda_kontak_simpan');

console.log('\n--- Sesudah migrasi: perilaku baru ---');
{
  const masuk = async (username) => { const k = buatKlienFake(B1); const a = buatApi(k); const r = await a.masuk(username, PIN_DEMO[username] ?? PIN_DEMO.penegak); return { k, a, id: r.id }; };
  const pembina = await masuk('pembina');
  const siti = await masuk('10232');
  let r = await siti.a.simpanBerandaKontak({ jadwal: 'Jumat' });
  ok(!r.ok && /Hanya pengurus/.test(r.pesan), 'Penegak biasa ditolak mengubah isi beranda');
  r = await pembina.a.simpanBerandaKontak({ whatsapp: '0812 3456 7890', jadwal: 'Jumat sore', cerita: 'Halo.\n\nDunia.' });
  ok(r.ok, 'Pembina mengubah isi beranda sesudah migrasi ' + (r.pesan ?? ''));
  const publik = (await sqlSebagai(B1, null, 'select public.sg_beranda_publik() as d')).rows[0].d;
  ok(publik.kontak.whatsapp === '0812 3456 7890' && publik.kontak.cerita === 'Halo.\n\nDunia.' && Array.isArray(publik.agenda), 'anon membaca isi beranda lewat sg_beranda_publik');
  r = await pembina.a.muatBerandaKontak();
  ok(r.ok && r.data.jadwal === 'Jumat sore', 'api().muatBerandaKontak membaca yang tersimpan');
}

console.log('\n--- Tanpa migrasi sebelumnya: gagal jelas ---');
const B3 = await baru('git:060fe49'); // skema lama (sebelum agenda dan fungsi pengurus)
let galat = null;
try { await B3.exec(MP); } catch (e) { galat = e.message; await B3.exec('rollback'); }
ok(/Jalankan lebih dulu skema dan migrasi/.test(galat ?? ''), 'pesan yang menuntun: ' + (galat ?? 'TIDAK GAGAL').slice(0, 100));
ok((await B3.query(`select to_regprocedure('public.sg_beranda_publik()') as f`)).rows[0].f === null, 'kegagalan membatalkan seluruh migrasi (fungsi tidak dibuat)');

console.log(`\nRINGKASAN MIGRASI BERANDA: ${l} lulus, ${g} GAGAL`);
process.exit(g ? 1 : 0);
