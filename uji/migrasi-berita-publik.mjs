// Migrasi arsip berita publik (Fase 4 landing page): kesetaraan dengan skema baru (fungsi dan hak), data utuh, idempoten, perilaku baru (dapat dipanggil tanpa
// login), dan gagal jelas bila prasyarat (migrasi 2026-09-beranda-konten.sql) belum ada.
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
const MP = bersih(readFileSync(`${P}/supabase/migrasi/2026-09-berita-publik.sql`, 'utf8'));

const skemaDari = (ref) => (ref.startsWith('git:') ? skemaLama(ref.slice(4), P) : readFileSync(ref, 'utf8'));
const baru = async (skemaFile) => { const db = new PGlite(); await siapkanPg(db, { sqlStub: stub, sqlSkema: bersih(skemaDari(skemaFile)) }); return db; };
const cacah = async (db) => (await db.query(`select (select count(*) from public.profiles)::int p, (select count(*) from public.beranda_berita)::int bb`)).rows[0];
const potret = async (db) => {
  const q = async (sql) => (await db.query(sql)).rows;
  return {
    fungsi: await q(`select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) args, p.prosecdef, p.provolatile, pg_get_function_result(p.oid) hasil, md5(p.prosrc) badan
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'sigarda') and p.prokind = 'f' order by 1, 2, 3`),
    hakFungsi: await q(`select routine_schema, routine_name, grantee, privilege_type from information_schema.role_routine_grants
      where routine_schema in ('public', 'sigarda') and grantee in ('anon','authenticated','service_role') order by 1, 2, 3, 4`),
  };
};

const A = await baru('supabase/skema.sql'); // migrasi ini yang paling baru: skema.sql terbaru = keadaan sesudahnya
const pa = await potret(A);

console.log('--- Database berisi data: kesetaraan, data utuh, idempoten ---');
const B1 = await baru('git:6832723'); // commit TEPAT sebelum migrasi ini (main sesudah PR #46)
await isiDataContoh(B1);
await B1.query('update public.profiles set wajib_ganti_pin = false');
const masuk = async (username) => { const k = buatKlienFake(B1); const a = buatApi(k); const r = await a.masuk(username, PIN_DEMO[username] ?? PIN_DEMO.penegak); return { k, a, id: r.id }; };
const pembina = await masuk('pembina');
const r0 = await sqlSebagai(B1, pembina.id, "select public.sg_berita_simpan(null, 'kegiatan', 'Berita Arsip', 'Ringkas', 'Isi arsip.', '', 'terbit', null) as id");
const idBerita = r0.rows[0].id;
ok((await B1.query(`select to_regprocedure('public.sg_berita_publik()') as f`)).rows[0].f === null, 'prasyarat: skema lama belum punya sg_berita_publik');
const sebelum = await cacah(B1);
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

console.log('\n--- Sesudah migrasi: perilaku baru ---');
{
  const publik = (await sqlSebagai(B1, null, 'select public.sg_berita_publik() as d')).rows[0].d;
  ok(Array.isArray(publik) && publik.some((b) => b.id === idBerita && b.judul === 'Berita Arsip' && b.isi === 'Isi arsip.'), 'anon (tanpa login) dapat memanggil sg_berita_publik dan melihat berita terbit beserta id dan isi');
  ok(publik.every((b) => Object.keys(b).sort().join() === 'diubahPada,id,isi,judul,kategori,ringkasan,sampulUrl,terbitPada'), 'hanya kolom yang diizinkan (tanpa penulis, peninjau, atau catatan)');
}

console.log('\n--- Tanpa migrasi sebelumnya: gagal jelas ---');
const B3 = await baru('git:bab5bfd'); // sebelum migrasi 2026-09-beranda-konten.sql (Fase 2)
let galat = null;
try { await B3.exec(MP); } catch (e) { galat = e.message; await B3.exec('rollback'); }
ok(/Jalankan lebih dulu migrasi 2026-09-beranda-konten\.sql/.test(galat ?? ''), 'pesan yang menuntun: ' + (galat ?? 'TIDAK GAGAL').slice(0, 100));
ok((await B3.query(`select to_regprocedure('public.sg_berita_publik()') as f`)).rows[0].f === null, 'kegagalan membatalkan seluruh migrasi (fungsi tidak dibuat)');

console.log(`\nRINGKASAN MIGRASI BERITA-PUBLIK: ${l} lulus, ${g} GAGAL`);
process.exit(g ? 1 : 0);
