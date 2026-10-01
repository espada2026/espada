// Skrip supabase/demo/data_demo_siaga.sql (dan pembersihnya hapus_data_demo_siaga.sql): dijalankan APA ADANYA pada Postgres sungguhan (PGlite) di atas data
// contoh, lalu diperiksa: cakupan, keutuhan (urutan pelantikan, butir agama), keamanan (tanpa notifikasi dan tanpa akun), dapat diulang, dan bersih saat dihapus.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { siapkanPg } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { periksaSiaga, susunKelompok } from '../src/lib/siagaLogic.js';

const P = process.cwd().replace(/\\/g, '/');
let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };
const baca = (f) => readFileSync(`${P}/supabase/demo/${f}`, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
const DEMO = baca('data_demo_siaga.sql');
const HAPUS = baca('hapus_data_demo_siaga.sql');

console.log('--- Teks berkas ---');
ok(/hapus_data_demo_siaga\.sql/.test(DEMO), 'menunjuk pembersih pasangannya');
ok(/disable trigger user/.test(DEMO) && /enable trigger user/.test(DEMO), 'pemicu dimatikan lalu dinyalakan kembali');
ok(!/insert into (auth\.|public\.(agenda|pengaturan|absensi_sesi|iuran))/.test(DEMO), 'tidak membuat akun, agenda, pengaturan, sesi, atau iuran');

const pg = new PGlite();
await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
await isiDataContoh(pg);
const N = async (sql) => Number((await pg.query(sql)).rows[0].n);
const demoIds = "(select id from public.profiles where nis ~ '^9910[0-9]{2}$' and nama like 'Demo %')";
const awal = { profil: await N('select count(*)::int n from public.profiles'), notif: await N('select count(*)::int n from public.notifikasi'), auth: await N('select count(*)::int n from auth.users') };

console.log('\n--- Menjalankan skrip ---');
await pg.exec(DEMO);
ok((await N(`select count(*)::int n from public.profiles where id in ${demoIds}`)) === 24, '24 anak demo dibuat');
ok((await N(`select count(*)::int n from public.profiles where id in ${demoIds} and tanpa_akun`)) === 24, 'semuanya tanpa akun');
ok((await N('select count(*)::int n from auth.users')) === awal.auth, 'tidak ada akun masuk baru');
ok((await N('select count(*)::int n from public.notifikasi')) === awal.notif, 'tidak ada notifikasi baru');
ok((await N(`select count(distinct perindukan)::int n from public.profiles where id in ${demoIds}`)) === 2 && (await N(`select count(distinct barung)::int n from public.profiles where id in ${demoIds}`)) === 4, 'dua perindukan dan empat barung');

const rows = (await pg.query(`select nama, kelas, agama, jenis_kelamin jk, nis, perindukan, barung, tanpa_akun "tanpaAkun", status from public.profiles where id in ${demoIds}`)).rows;
ok(rows.every((r) => periksaSiaga({ nama: r.nama, kelas: r.kelas, jk: r.jk, agama: r.agama, nis: r.nis, perindukan: r.perindukan, barung: r.barung }).ok), 'setiap anak lolos aturan isian Siaga di klien');
const kel = susunKelompok(rows.map((r) => ({ ...r, role: 'peserta' })));
ok(JSON.stringify(kel).includes('Demo Anggrek'), 'kelompok tersusun menurut perindukan');

ok((await N(`select count(*)::int n from public.sku_progress where peserta_id in ${demoIds} and status <> 'lulus'`)) === 0, 'hanya butir lulus');
ok((await N(`select count(*)::int n from public.sku_progress s join public.profiles p on p.id = s.peserta_id join public.sku_unit u on u.id = s.sku_id where p.id in ${demoIds} and u.agama is not null and u.agama <> p.agama`)) === 0, 'butir agama hanya untuk agama anak itu');
ok((await N(`select count(*)::int n from public.sku_progress s join public.sku_unit u on u.id = s.sku_id where s.peserta_id in ${demoIds} and u.tingkat not in ('Mula','Bantu','Tata')`)) === 0, 'tidak ada butir Penegak');
ok((await N(`select count(*)::int n from public.pelantikan where peserta_id in ${demoIds}`)) > 0, 'ada pelantikan');
ok((await N(`select count(*)::int n from public.pelantikan b join public.pelantikan a on a.peserta_id = b.peserta_id where b.tingkat = 'bantu' and a.tingkat = 'mula' and b.tanggal <= a.tanggal and b.peserta_id in ${demoIds}`)) === 0, 'pelantikan Bantu sesudah Mula');
ok((await N(`select count(*)::int n from public.pelantikan b join public.pelantikan a on a.peserta_id = b.peserta_id where b.tingkat = 'tata' and a.tingkat = 'bantu' and b.tanggal <= a.tanggal and b.peserta_id in ${demoIds}`)) === 0, 'pelantikan Tata sesudah Bantu');
ok((await N(`select count(*)::int n from public.tkk_siaga where peserta_id in ${demoIds}`)) > 0, 'ada TKK Siaga');
// Pelantikan hanya untuk yang seluruh butir tingkatnya lulus (aturan sg_pelantikan_catat)
const tak = await N(`select count(*)::int n from public.pelantikan pl where pl.peserta_id in ${demoIds} and (select count(*) from public.sku_progress s join public.sku_unit u on u.id = s.sku_id join public.profiles p on p.id = s.peserta_id where s.peserta_id = pl.peserta_id and s.status = 'lulus' and u.tingkat = initcap(pl.tingkat)) < (select count(*) from public.sku_unit u join public.profiles p on p.id = pl.peserta_id where u.tingkat = initcap(pl.tingkat) and (u.agama is null or u.agama = p.agama))`);
ok(tak === 0, 'setiap pelantikan didahului seluruh butir tingkatnya');

console.log('\n--- Dapat diulang dan dibersihkan ---');
await pg.exec(DEMO);
ok((await N(`select count(*)::int n from public.profiles where id in ${demoIds}`)) === 24, 'dijalankan dua kali: tetap 24 anak');
await pg.exec(HAPUS);
ok((await N(`select count(*)::int n from public.profiles where nis ~ '^9910[0-9]{2}$'`)) === 0, 'pembersih menghapus semua anak demo');
ok((await N('select count(*)::int n from public.profiles')) === awal.profil && (await N('select count(*)::int n from public.notifikasi')) === awal.notif, 'sesudah dihapus: profil dan notifikasi kembali seperti awal');
ok((await N(`select count(*)::int n from public.sku_progress where verifikasi = 'x'`)) === 0 && (await N('select count(*)::int n from public.pelantikan p where not exists (select 1 from public.profiles q where q.id = p.peserta_id)')) === 0, 'tidak ada baris yatim');

await pg.close();
console.log(`\nRINGKASAN: ${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
