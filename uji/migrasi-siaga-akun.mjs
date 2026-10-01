// Migrasi Pramuka Siaga Fase 2b (anak Siaga berakun): kesetaraan dengan skema baru (katalog, kendala, fungsi, hak, pemicu), data utuh, idempoten, perilaku baru,
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
const MP = bersih(readFileSync(`${P}/supabase/migrasi/2026-10-siaga-akun.sql`, 'utf8'));

const skemaDari = (ref) => (ref === 'baru' ? readFileSync(`${P}/supabase/skema.sql`, 'utf8') : skemaLama(ref.slice(4), P));
const baru = async (ref) => { const db = new PGlite(); await siapkanPg(db, { sqlStub: stub, sqlSkema: bersih(skemaDari(ref)) }); return db; };
const cacah = async (db) => (await db.query(`select (select count(*) from public.profiles)::int p, (select count(*) from public.sku_progress)::int s, (select count(*) from public.agenda)::int a,
  (select count(*) from public.notifikasi)::int n, (select count(*) from public.penugasan_rombel)::int pr, (select count(*) from public.sku_butir where tingkat in ('Bantara','Laksana'))::int bp`)).rows[0];
const potret = async (db) => {
  const q = async (sql) => (await db.query(sql)).rows;
  return {
    fungsi: await q(`select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) args, p.prosecdef, p.provolatile, pg_get_function_result(p.oid) hasil, md5(p.prosrc) badan
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'sigarda') and p.prokind = 'f' order by 1, 2, 3`),
    hakFungsi: await q(`select routine_schema, routine_name, grantee, privilege_type from information_schema.role_routine_grants
      where routine_schema in ('public', 'sigarda') and grantee in ('anon','authenticated','service_role') order by 1, 2, 3, 4`),
    batasan: await q(`select conrelid::regclass::text tabel, conname, pg_get_constraintdef(oid) def from pg_constraint where conrelid in ('public.sku_butir'::regclass, 'public.sku_unit'::regclass) order by 1, 2`),
    butir: await q(`select id, tingkat, no, teks from public.sku_butir order by id`),
    unit: await q(`select id, butir_id, tingkat, butir_no, agama, sub from public.sku_unit order by id`),
    pemicu: await q(`select tgrelid::regclass::text tabel, tgname from pg_trigger where not tgisinternal and (tgrelid::regclass::text like 'public.%' or tgrelid::regclass::text = 'auth.users') order by 1, 2`),
    hakTabel: await q(`select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name in ('sku_butir', 'sku_unit') and grantee in ('anon','authenticated') order by 1, 2, 3`),
  };
};

const A = await baru('baru');
const pa = await potret(A);

console.log('--- Database berisi data: kesetaraan, data utuh, idempoten ---');
const B1 = await baru('git:fe6f927'); // commit TEPAT sebelum migrasi ini
await isiDataContoh(B1);
await B1.query('update public.profiles set wajib_ganti_pin = false');
const sebelum = await cacah(B1);
const md5Fungsi = async (db, nama) => (await db.query(`select md5(p.prosrc) m from pg_proc p where p.proname = $1`, [nama])).rows[0].m;
ok((await B1.query(`select count(*)::int n from pg_proc where proname = 'kelas_siaga'`)).rows[0].n === 0, 'prasyarat: sigarda.kelas_siaga belum ada');
const lama = { cat: await md5Fungsi(B1, 'sg_sku_catat_internal'), aju: await md5Fungsi(B1, 'sg_sku_ajukan'), ubh: await md5Fungsi(B1, 'sg_siaga_ubah'), pp: await md5Fungsi(B1, 'penguji_peran_ok'), pem: await md5Fungsi(B1, 'sg_pemeriksaan_data') };
await B1.exec(MP);
ok(JSON.stringify(await cacah(B1)) === JSON.stringify(sebelum), 'jumlah data tidak berubah oleh migrasi: ' + JSON.stringify(sebelum));
ok(await md5Fungsi(B1, 'sg_sku_catat_internal') !== lama.cat && await md5Fungsi(B1, 'sg_sku_ajukan') !== lama.aju && await md5Fungsi(B1, 'sg_siaga_ubah') !== lama.ubh
  && await md5Fungsi(B1, 'penguji_peran_ok') !== lama.pp && await md5Fungsi(B1, 'sg_pemeriksaan_data') !== lama.pem, 'fungsi yang berubah ditulis ulang oleh migrasi');
ok((await B1.query(`select sigarda.kelas_siaga('4A') a, sigarda.kelas_siaga('X-01') b`)).rows[0].a === true, 'sigarda.kelas_siaga tersedia');
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
  let r = await pembina.buatAkun('peserta', [{ no: 1, nama: 'Anak Akun', nis: '5101', kelas: '4A', agama: 'Islam' }]);
  ok(r.ok && r.hasil?.[0]?.ok, 'Pembina membuat akun anak Siaga pada database hasil migrasi ' + (r.pesan ?? ''));
  const anak = r.hasil[0];
  r = await pembina.ubahSiaga(anak.id, { nama: 'Anak Akun', kelas: '4A', jk: 'L', agama: 'Islam', perindukan: 'Melati', barung: 'Kancil' });
  ok(r.ok, 'anak berakun dapat diubah lewat jalur Siaga ' + (r.pesan ?? ''));
  r = await pembina.hapusSiaga(anak.id);
  ok(!r.ok && /punya akun masuk/.test(r.pesan), 'anak berakun tidak dihapus lewat jalur Siaga');
  await B1.query('update public.profiles set wajib_ganti_pin = false');
  const kid = buatApi(buatKlienFake(B1));
  await kid.masuk('5101', anak.pin);
  r = await kid.ajukan({ skuId: 'MUL-02', jadwal: '2099-01-01', pengujiId: null });
  ok(r.ok, 'anak mengajukan butir Mula ' + (r.pesan ?? ''));
  r = await kid.ajukan({ skuId: 'BAN-02', jadwal: '2099-01-01', pengujiId: null });
  ok(!r.ok && /bukan untuk tingkat/.test(r.pesan), 'anak tidak dapat mengajukan butir Penegak');
  r = await pembina.catatHasil({ pin: PIN_DEMO.pembina, pesertaId: anak.id, skuId: 'MUL-02', hasil: 'lulus', tanggalUji: '2026-09-25', nilai: 'Baik', catatan: '' });
  ok(r.ok, 'Pembina meluluskan pengajuan anak ' + (r.pesan ?? ''));
}

console.log('\n--- Tanpa migrasi sebelumnya: gagal jelas ---');
const B3 = await baru('git:538d8d6'); // sebelum sku-siaga: tanpa sigarda.prasyarat_tingkat
let galat = null;
try { await B3.exec(MP); } catch (e) { galat = e.message; await B3.exec('rollback'); }
ok(/Jalankan lebih dulu skema dan migrasi/.test(galat ?? ''), 'pesan yang menuntun: ' + (galat ?? 'TIDAK GAGAL').slice(0, 100));
ok((await B3.query(`select count(*)::int n from pg_proc where proname = 'kelas_siaga'`)).rows[0].n === 0, 'kegagalan membatalkan seluruh migrasi');

console.log(`\nRINGKASAN MIGRASI SIAGA-AKUN: ${l} lulus, ${g} GAGAL`);
process.exit(g ? 1 : 0);
