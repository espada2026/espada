// Migrasi "terbit ulang situs saat berita terbit" (tabel terbit_ulang_konfigurasi, pemicu pada beranda_berita, fungsi sigarda.terbit_ulang_* dan sg_terbit_ulang_*):
// kesetaraan dengan skema baru (fungsi, hak, kolom, pemicu, RLS), data utuh, idempoten, perilaku baru, dan gagal jelas bila prasyarat (berita-publik) belum ada.
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
const MP = bersih(readFileSync(`${P}/supabase/migrasi/2026-09-terbit-ulang.sql`, 'utf8'));

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
    kolom: await q(`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'terbit_ulang_konfigurasi' order by ordinal_position`),
    batasan: await q(`select conname, pg_get_constraintdef(oid) def from pg_constraint where conrelid = 'public.terbit_ulang_konfigurasi'::regclass order by 1`),
    pemicu: await q(`select tgname, pg_get_triggerdef(oid) def from pg_trigger where tgrelid = 'public.beranda_berita'::regclass and not tgisinternal order by 1`),
    rls: await q(`select relrowsecurity r, has_table_privilege('authenticated', c.oid, 'select') s, has_table_privilege('anon', c.oid, 'select') a,
      (select count(*) from pg_policies where tablename = 'terbit_ulang_konfigurasi')::int k from pg_class c where relname = 'terbit_ulang_konfigurasi' and relnamespace = 'public'::regnamespace`),
  };
};

const A = await baru('git:a004b1b'); // keadaan TEPAT sesudah migrasi ini (main sesudah PR #56, tanpa perubahan SQL sejak PR #55); skema.sql terbaru kini juga memuat muat-lebih-lama
const pa = await potret(A);

console.log('--- Database berisi data: kesetaraan, data utuh, idempoten ---');
const B1 = await baru('git:da16a3f'); // commit TEPAT sebelum migrasi ini (main sesudah PR #54)
await isiDataContoh(B1);
await B1.query('update public.profiles set wajib_ganti_pin = false');
const masuk = async (username) => { const k = buatKlienFake(B1); const a = buatApi(k); const r = await a.masuk(username, PIN_DEMO[username] ?? PIN_DEMO.penegak); return { k, a, id: r.id }; };
const pembina = await masuk('pembina');
await sqlSebagai(B1, pembina.id, "select public.sg_berita_simpan(null, 'kegiatan', 'Berita lama', 'Ringkas', 'Isi.', '', 'terbit', null) as id");
ok((await B1.query(`select to_regclass('public.terbit_ulang_konfigurasi') as t`)).rows[0].t === null, 'prasyarat: skema lama belum punya tabel terbit_ulang_konfigurasi');
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
  ok(pb.rls[0].r && !pb.rls[0].s && !pb.rls[0].a && pb.rls[0].k === 0, 'tabel kunci: RLS aktif, tanpa kebijakan, tanpa hak baca (persis skema baru)');
  const tanpa = (await sqlSebagai(B1, pembina.id, 'select public.sg_terbit_ulang_status() as d').catch((e) => ({ galat: e.message })));
  ok(tanpa.rows?.[0].d.diatur === false, 'Pembina melihat keadaan "belum diatur" tanpa galat');
  await B1.exec(`select sigarda.terbit_ulang_atur('tribudi3267/sigarda', 'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz')`);
  await B1.exec('update public.terbit_ulang_konfigurasi set perlu = false');
  await sqlSebagai(B1, pembina.id, "select public.sg_berita_simpan(null, 'kegiatan', 'Berita baru', 'Ringkas', 'Isi.', '', 'terbit', null) as id");
  ok((await B1.query('select perlu from public.terbit_ulang_konfigurasi')).rows[0].perlu === true, 'pemicu terpasang: berita terbit baru menandai "perlu"');
}

console.log('\n--- Tanpa migrasi sebelumnya: gagal jelas ---');
const B3 = await baru('git:bab5bfd'); // sebelum migrasi 2026-09-beranda-konten.sql dan 2026-09-berita-publik.sql
let galat = null;
try { await B3.exec(MP); } catch (e) { galat = e.message; await B3.exec('rollback'); }
ok(/Jalankan lebih dulu migrasi 2026-09-berita-publik\.sql/.test(galat ?? ''), 'pesan yang menuntun: ' + (galat ?? 'TIDAK GAGAL').slice(0, 100));
ok((await B3.query(`select to_regclass('public.terbit_ulang_konfigurasi') as t`)).rows[0].t === null, 'kegagalan membatalkan seluruh migrasi (tabel tidak dibuat)');

console.log(`\nRINGKASAN MIGRASI TERBIT-ULANG: ${l} lulus, ${g} GAGAL`);
process.exit(g ? 1 : 0);
