// Pramuka Siaga, Fase 4: pelantikan kenaikan tingkat Siaga (Mula, Bantu, Tata). Server (PGlite, skema baru): tingkat baru, pemisahan Penegak/Siaga, syarat SKU, urutan tanggal,
// tautan Agenda, hak baca. Klien: calon, ringkasan, pemeriksaan isian (cermin dibandingkan langsung dengan SQL), awal tingkat latihan dari pelantikan, dan render halaman.
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { siapkanPg, buatKlienFake, sqlSebagai } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';
import { KonteksApp } from '../src/context/AppContext.jsx';
import '../src/data/skuSiaga.js';
import Pelantikan from '../src/pages/Pelantikan.jsx';
import KartuPelantikanSaya from '../src/components/KartuPelantikanSaya.jsx';
import { calonPelantikan, kelompokPelantikan, labelTingkatPelantikan, pelantikanPeserta, periksaPelantikan, ringkasPelantikan, tingkatSiaga, tingkatSku, TINGKAT_PELANTIKAN } from '../src/lib/pelantikanLogic.js';
import { awalTingkat } from '../src/lib/latihanSiagaLogic.js';
import { PRASYARAT_TINGKAT } from '../src/lib/skuLogic.js';

const P = process.cwd().replace(/\\/g, '/');
let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };

const pg = new PGlite();
await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
await isiDataContoh(pg);
await pg.query('update public.profiles set wajib_ganti_pin = false');
const q = async (sql, p = []) => (await pg.query(sql, p)).rows;
const masuk = async (nama, pin) => { const a = buatApi(buatKlienFake(pg)); const r = await a.masuk(nama, pin); return { a, id: r.id }; };
const sebagai = async (id, sql, args = []) => { try { return { ok: true, rows: (await sqlSebagai(pg, id, sql, args)).rows }; } catch (e) { return { ok: false, pesan: e.message }; } };
const cocok = (r, re) => !r.ok && re.test(r.pesan ?? '');
const hari = (await q('select sigarda.hari_ini()::text d'))[0].d;
const geser = async (n) => (await q(`select (sigarda.hari_ini() + $1::int)::text d`, [n]))[0].d;
const catat = (id, tk, tgl, tempat, ids, agenda = null) => sebagai(id, 'select public.sg_pelantikan_catat($1, $2::date, $3, $4::uuid[], $5::bigint, $6) as n', [tk, tgl, tempat, ids, agenda, '']);
const tulisSku = (pid, tingkat) => q(
  `insert into public.sku_progress (peserta_id, sku_id, status) select p.id, u.id, 'lulus' from public.profiles p join public.sku_unit u on u.tingkat = $2 and (u.agama is null or u.agama = p.agama)
   where p.id = $1 on conflict (peserta_id, sku_id) do update set status = 'lulus'`, [pid, tingkat]);

const pembina = await masuk('pembina', PIN_DEMO.pembina);
const ahmad = await masuk('10231', PIN_DEMO.penegak);
let r = await pembina.a.tambahSiaga([{ nama: 'Anak Tanpa Akun', kelas: '4A', agama: 'Islam' }]);
ok(r.ok, 'anak Siaga tanpa akun ditambahkan ' + (r.pesan ?? ''));
const tanpa = (await q(`select id from public.profiles where nama = 'Anak Tanpa Akun'`))[0].id;
r = await pembina.a.buatAkun('peserta', [{ no: 1, nama: 'Anak Berakun', nis: '5301', kelas: '5', agama: 'Islam' }]);
const berakun = r.hasil[0];
await pg.query('update public.profiles set wajib_ganti_pin = false');
const kid = await masuk('5301', berakun.pin);

console.log('--- Server: tingkat Siaga ---');
{
  const t1 = await geser(-40), t2 = await geser(-20), t3 = await geser(-5);
  r = await catat(pembina.id, 'mula', t1, 'Lapangan SD', [tanpa]);
  ok(cocok(r, /belum menyelesaikan seluruh butir SKU Mula/), 'sebelum seluruh butir Mula lulus: ditolak');
  await tulisSku(tanpa, 'Mula'); await tulisSku(berakun.id, 'Mula');
  r = await catat(ahmad.id, 'mula', t1, 'Lapangan SD', [tanpa]);
  ok(cocok(r, /Hanya Pembina dan Admin Gudep/), 'Penegak tidak dapat mencatat pelantikan Siaga');
  r = await catat(pembina.id, 'mula', t1, 'Lapangan SD', [ahmad.id]);
  ok(cocok(r, /bukan anggota Siaga; pelantikan Mula hanya untuk anggota Siaga/), 'Penegak tidak dapat dilantik Mula');
  r = await catat(pembina.id, 'bantara', t1, 'Lapangan SD', [tanpa]);
  ok(cocok(r, /bukan anggota Penegak; pelantikan Bantara hanya untuk Penegak/), 'anggota Siaga tidak dapat dilantik Bantara');
  r = await catat(pembina.id, 'garuda', t1, 'Lapangan SD', [tanpa]);
  ok(cocok(r, /Bantara, Laksana, Mula, Bantu, atau Tata/), 'tingkat tak dikenal ditolak');
  r = await catat(pembina.id, 'mula', t1, 'Lapangan SD', [tanpa, berakun.id]);
  ok(r.ok && r.rows[0].n === 2, 'Pembina melantik Mula untuk anak tanpa akun dan berakun sekaligus ' + (r.pesan ?? ''));
  r = await catat(pembina.id, 'mula', t2, 'Aula SD', [tanpa]);
  ok(r.ok && (await q(`select tanggal::text d, tempat from public.pelantikan where peserta_id = $1 and tingkat = 'mula'`, [tanpa]))[0].tempat === 'Aula SD', 'mencatat ulang = koreksi (satu baris per tingkat)');
  await q(`update public.pelantikan set tanggal = $2::date where peserta_id = $1 and tingkat = 'mula'`, [tanpa, t1]);

  r = await catat(pembina.id, 'bantu', t2, 'Lapangan SD', [tanpa]);
  ok(cocok(r, /belum menyelesaikan seluruh butir SKU Bantu/), 'Bantu menuntut seluruh butir Bantu lulus');
  await tulisSku(tanpa, 'Bantu');
  r = await catat(pembina.id, 'bantu', t1, 'Lapangan SD', [tanpa]);
  ok(cocok(r, /harus sesudah pelantikan Mula/), 'Bantu pada tanggal yang sama dengan Mula ditolak');
  r = await catat(pembina.id, 'bantu', await geser(-50), 'Lapangan SD', [tanpa]);
  ok(cocok(r, /harus sesudah pelantikan Mula/), 'Bantu sebelum Mula ditolak');
  const ag = (await sebagai(pembina.id, `select public.sg_agenda_simpan(null, $1, 'perkemahan', 'Perkemahan Siaga', $2::date, '', '{}'::uuid[], false) as id`, [(await q('select sigarda.tahun_ajaran_kini() ta'))[0].ta, await geser(3)])).rows?.[0]?.id;
  r = await catat(pembina.id, 'bantu', t2, 'Lapangan SD', [tanpa], ag);
  ok(r.ok, 'Siaga boleh menaut kegiatan Agenda berjenis apa pun ' + (r.pesan ?? ''));
  r = await catat(pembina.id, 'bantara', t2, 'Lapangan', [ahmad.id], ag);
  ok(cocok(r, /bukan pelantikan Bantara|belum menyelesaikan/), 'tautan Agenda untuk Penegak tetap harus berjenis pelantikan');
  r = await catat(pembina.id, 'tata', t3, 'Lapangan SD', [tanpa]);
  ok(cocok(r, /belum menyelesaikan seluruh butir SKU Tata/), 'Tata menuntut seluruh butir Tata lulus');
  await tulisSku(tanpa, 'Tata');
  r = await catat(pembina.id, 'tata', t3, 'Lapangan SD', [tanpa]);
  ok(r.ok, 'Tata sesudah Bantu dicatat ' + (r.pesan ?? ''));
  r = await catat(pembina.id, 'tata', t2, 'Lapangan SD', [tanpa]);
  ok(cocok(r, /harus sesudah pelantikan Bantu/), 'Tata sebelum atau pada tanggal Bantu ditolak (koreksi mundur)');

  await q(`update public.profiles set status = 'nonaktif' where id = $1`, [berakun.id]);
  r = await catat(pembina.id, 'bantu', t3, 'Lapangan SD', [berakun.id]);
  ok(cocok(r, /tidak aktif/), 'anak nonaktif tidak dapat dilantik');
  await q(`update public.profiles set status = 'aktif' where id = $1`, [berakun.id]);
}

console.log('\n--- RLS baca ---');
{
  r = await sebagai(berakun.id, 'select tingkat from public.pelantikan');
  ok(r.ok && r.rows.length === 1 && r.rows[0].tingkat === 'mula', 'anak berakun hanya membaca pelantikan miliknya');
  const muat = await kid.a.muatPelantikanSaka();
  ok(muat.ok && muat.data.pelantikan.length === 1 && muat.data.pelantikan[0].tingkat === 'mula', 'api: pelantikan Siaga dipetakan untuk pemilik');
}

console.log('\n--- Klien: logika murni ---');
{
  ok(TINGKAT_PELANTIKAN.map((t) => t.id).join() === 'bantara,laksana,mula,bantu,tata', 'daftar tingkat pelantikan');
  ok(tingkatSiaga('tata') && !tingkatSiaga('laksana') && tingkatSku('bantu') === 'Bantu' && labelTingkatPelantikan('mula') === 'Mula', 'tingkatSiaga dan nama tingkat SKU');
  ok(PRASYARAT_TINGKAT.Bantu === 'Mula' && PRASYARAT_TINGKAT.Tata === 'Bantu', 'prasyarat tingkat Siaga (dasar urutan pelantikan)');
  const progress = {};
  const sku = await q(`select u.id, u.tingkat from public.sku_unit u where u.tingkat in ('Mula','Bantu') and (u.agama is null or u.agama = 'Islam')`);
  progress.a = Object.fromEntries(sku.filter((x) => x.tingkat === 'Mula').map((x) => [x.id, { status: 'lulus' }]));
  progress.b = Object.fromEntries(sku.map((x) => [x.id, { status: 'lulus' }]));
  const siagaU = (id, nama, kelas, extra = {}) => ({ id, nama, kelas, role: 'peserta', status: 'aktif', agama: 'Islam', ...extra });
  const users = [siagaU('a', 'Anak A', '4A'), siagaU('b', 'Anak B', '5', { tanpaAkun: true }), siagaU('c', 'Anak C', '4B', { status: 'nonaktif' }), siagaU('p', 'Penegak P', 'X-01')];
  progress.p = progress.a;
  const pel = [{ id: 1, pesertaId: 'b', tingkat: 'mula', tanggal: '2026-08-01', tempat: 'SD' }];
  ok(calonPelantikan({ users, progress, pelantikan: pel, tingkat: 'mula' }).map((u) => u.nama).join() === 'Anak A', 'calon Mula: anak Siaga aktif, semua butir lulus, belum dilantik (Penegak dan nonaktif tidak)');
  ok(calonPelantikan({ users, progress, pelantikan: pel, tingkat: 'mula', termasukSudah: true }).map((u) => u.nama).sort().join() === 'Anak A,Anak B', 'termasuk yang sudah dilantik (koreksi)');
  ok(calonPelantikan({ users, progress, pelantikan: pel, tingkat: 'bantara' }).length === 0, 'Penegak tidak muncul sebagai calon Mula dan butir Siaga tidak menjadikan anak calon Bantara');
  ok(JSON.stringify(ringkasPelantikan([...pel, { tingkat: 'tata' }], [])) === '{"bantara":0,"laksana":0,"mula":1,"bantu":0,"tata":1,"sakaAktif":0}', 'ringkasPelantikan memuat tingkat Siaga');
  ok(pelantikanPeserta(pel, 'b').mula?.tempat === 'SD' && pelantikanPeserta(pel, 'b').bantu === null, 'pelantikanPeserta memuat tingkat Siaga');
  const kel = kelompokPelantikan(pel, users);
  ok(kel.length === 1 && kel[0].tingkat === 'mula' && kel[0].anggota[0].nama === 'Anak B', 'kelompokPelantikan');

  // Cermin: periksaPelantikan = sg_pelantikan_catat untuk tingkat baru
  let n = 0, beda = 0;
  for (const tk of ['mula', 'bantu', 'tata', 'bantara', 'laksana', 'siaga', null]) for (const jml of [0, 1]) for (const tg of [null, '1999-12-31', hari, await geser(1)]) {
    const klien = periksaPelantikan({ tingkat: tk, tanggal: tg, tempat: 'Lapangan', jumlah: jml, hari });
    const s = await sebagai(pembina.id, 'select public.sg_pelantikan_catat($1, $2::date, $3, $4::uuid[], null, $5) as n', [tk, tg, 'Lapangan', jml ? [kid.id] : [], '']);
    n++;
    // Server juga memeriksa anggotanya (belum lulus atau salah jenis); hanya galat isian yang dibandingkan: klien menolak = server menolak, klien menerima = server tidak menolak karena ISIAN.
    const galatIsian = !s.ok && /Tingkat pelantikan|Tanggal pelantikan|Tempat pelantikan|Catatan maksimal|sedikitnya satu anggota/.test(s.pesan);
    if ((klien !== '') !== galatIsian) { beda++; if (beda < 6) console.log('   beda:', { tk, tg, jml }, 'klien:', klien || 'ok', 'server:', s.ok ? 'ok' : s.pesan); }
  }
  ok(beda === 0, `${n} kombinasi: pemeriksaan isian klien = server untuk tingkat Siaga`);

  // Awal tingkat latihan memakai pelantikan bila ada
  const prog = { 'MUL-01': { status: 'lulus', tanggalUji: '2026-05-01' } };
  ok(awalTingkat(prog, 'Bantu') === '2026-05-01', 'awal Bantu tanpa pelantikan: tanggal uji terakhir butir Mula');
  ok(awalTingkat(prog, 'Bantu', [{ tingkat: 'mula', tanggal: '2026-06-10' }]) === '2026-06-10', 'awal Bantu dengan pelantikan Mula: tanggal pelantikan');
  ok(awalTingkat({}, 'Tata', [{ tingkat: 'bantu', tanggal: '2026-07-01' }]) === '2026-07-01' && awalTingkat({}, 'Mula', [{ tingkat: 'mula', tanggal: '2026-07-01' }]) === null, 'awal Tata dari pelantikan Bantu; Mula tak punya awal');
}

console.log('\n--- Tampilan ---');
{
  const render = (user, el) => renderToStaticMarkup(h(KonteksApp.Provider, { value: { user, users: [], daftarPeserta: [], progress: {}, api: () => ({ muatAgenda: async () => ({ ok: true, data: [] }), muatPelantikanSaka: async () => ({ ok: true, data: { pelantikan: [], saka: [] } }) }), notify() {} } }, el));
  const html = render({ id: 'p', role: 'penguji', jabatan: 'Pembina', nama: 'Pembina' }, h(Pelantikan));
  ok(html.includes('Siaga Mula') && html.includes('Siaga Tata') && html.includes('Bantara') && html.includes('Belum ada Penegak yang layak'), 'formulir menawarkan tingkat Penegak dan Siaga');
  ok(html.includes('Keputusan Kwarnas 119/2011') || html.includes('119/2011') || html.includes('Siaga'), 'rujukan peraturan Siaga tampil');
  const kartu = renderToStaticMarkup(h(KonteksApp.Provider, { value: { user: { id: 'x', role: 'peserta' }, api: () => ({ muatPelantikanSaka: async () => ({ ok: true, data: { pelantikan: [], saka: [] } }) }) } }, h(KartuPelantikanSaya)));
  ok(kartu === '', 'kartu pelantikan kosong tidak tampil');
}

console.log(`\nRINGKASAN PELANTIKAN-SIAGA: ${lulus} lulus, ${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
