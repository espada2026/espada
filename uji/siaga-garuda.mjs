// Siaga Garuda (Fase 6): hak, syarat, koreksi, hapus, cadangan, saran otomatis, dan cermin klien periksaSiagaGaruda = sg_siaga_garuda_catat (kisi masukan dibandingkan langsung).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { siapkanPg, buatKlienFake } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';
import { periksaSiagaGaruda, hitungSiagaGaruda, ringkasSiagaGaruda } from '../src/lib/siagaGarudaLogic.js';
import { BUTIR_SIAGA_GARUDA } from '../src/data/siagaGarudaData.js';
import { daftarPoin } from '../src/lib/skuLogic.js';
import { tkkUntukSiaga } from '../src/data/tkkData.js';
import '../src/data/skuSiaga.js';

const P = process.cwd().replace(/\\/g, '/');
let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };

const pg = new PGlite();
await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
await isiDataContoh(pg);
await pg.query('update public.profiles set wajib_ganti_pin = false');
const pembina = buatApi(buatKlienFake(pg));
await pembina.masuk('pembina', PIN_DEMO.pembina);
await pembina.tambahSiaga([{ nama: 'Anak Tata', kelas: '6', agama: 'Islam' }, { nama: 'Anak Bantu', kelas: '5', agama: 'Islam' }]);
const idDari = async (nama) => (await pg.query('select id from public.profiles where nama = $1', [nama])).rows[0].id;
const tata = await idDari('Anak Tata'), bantu = await idDari('Anak Bantu');
const hari = (await pg.query('select sigarda.hari_ini()::text h')).rows[0].h;
const luluskan = (id, tingkat) => pg.query(`insert into public.sku_progress (peserta_id, sku_id, status) select p.id, u.id, 'lulus' from public.profiles p join public.sku_unit u on u.tingkat = $2 and (u.agama is null or u.agama = p.agama) where p.id = $1 on conflict do nothing`, [id, tingkat]);
for (const t of ['Mula', 'Bantu']) await luluskan(bantu, t);
for (const t of ['Mula', 'Bantu']) await luluskan(tata, t);

console.log('--- Syarat dan hak ---');
const sg = (id, butir, a = {}) => pembina.catatSiagaGaruda({ pesertaId: id, butir, nilai: 100, tanggal: '2026-09-01', ...a });
let r = await sg(tata, 3);
ok(!r.ok && /belum menyelesaikan SKU Tata/.test(r.pesan), 'ditolak sebelum SKU Tata selesai: ' + r.pesan);
await luluskan(tata, 'Tata');
r = await sg(tata, 3);
ok(r.ok, 'dicatat sesudah SKU Tata selesai ' + (r.pesan ?? ''));
r = await sg(tata, 3, { nilai: 0, tanggal: '2026-09-02', catatan: 'belum lengkap' });
ok(r.ok, 'menetapkan ulang = koreksi');
const n = (await pg.query('select count(*)::int c, max(nilai) v, max(catatan) k from public.siaga_garuda where peserta_id = $1', [tata])).rows[0];
ok(n.c === 1 && n.v === 0 && n.k === 'belum lengkap', 'satu baris per butir, isi diperbarui');
r = await sg(tata, 7);
ok(!r.ok && /1 sampai 6/.test(r.pesan), 'butir di luar 1-6 ditolak');
r = await sg(tata, 4, { nilai: 50 });
ok(!r.ok && /100 \(memenuhi\) atau 0/.test(r.pesan), 'nilai selain 0/100 ditolak');
r = await sg(tata, 4, { tanggal: '2099-01-01' });
ok(!r.ok && /antara 1 Januari 2015 dan hari ini/.test(r.pesan), 'tanggal masa depan ditolak');
const penegak = (await pg.query(`select id from public.profiles where role = 'peserta' and not tanpa_akun and kelas like 'X%' limit 1`)).rows[0]?.id;
if (penegak) { r = await sg(penegak, 3); ok(!r.ok && /hanya untuk anggota Siaga/.test(r.pesan), 'Penegak SMA ditolak'); }

console.log('\n--- Baca, hapus, cadangan, anggota tak aktif ---');
await sg(tata, 6);
const baris = await pembina.muatSiagaGaruda(tata);
ok(baris.ok && baris.data.length === 2 && baris.data[0].butir === 3, 'Pembina membaca penetapan anak (' + baris.data?.length + ')');
const adm = buatApi(buatKlienFake(pg));
await adm.masuk('admin', PIN_DEMO.admin);
const cad = await adm.unduhCadangan();
ok(cad.ok && JSON.stringify(cad.data).includes('"siaga_garuda"'), 'cadangan memuat siaga_garuda');
r = await pembina.hapusSiagaGaruda(tata, 6);
ok(r.ok, 'Pembina menghapus penetapan');
r = await pembina.hapusSiagaGaruda(tata, 6);
ok(!r.ok && /tidak ditemukan/.test(r.pesan), 'hapus yang tidak ada ditolak');
await pg.query(`update public.profiles set status = 'nonaktif' where id = $1`, [tata]);
r = await sg(tata, 4);
ok(!r.ok, 'anggota nonaktif ditolak: ' + r.pesan);
r = await pembina.hapusSiagaGaruda(tata, 3);
ok(!r.ok && /nonaktif atau alumni/.test(r.pesan), 'hapus untuk nonaktif ditolak');
await pg.query(`update public.profiles set status = 'aktif' where id = $1`, [tata]);
ok((await pg.query(`select has_table_privilege('authenticated', 'public.siaga_garuda', 'insert') w`)).rows[0].w === false, 'klien tidak dapat menulis tabel langsung');
r = await sg(bantu, 3);
ok(!r.ok && /belum menyelesaikan SKU Tata/.test(r.pesan), 'anak yang baru sampai Bantu ditolak');

console.log('\n--- Cermin klien = SQL (kisi masukan) ---');
await pg.query('delete from public.siaga_garuda');
const butirs = [0, 1, 6, 7, -1];
const nilais = [100, 0, 50, 99];
const tanggal = ['2026-09-01', hari, '2014-12-31', '2099-12-31', ''];
const catatan = ['', 'x'.repeat(201), 'a>b', 'ok  rapi'];
let total = 0, beda = 0;
for (const b of butirs) for (const v of nilais) for (const tg of tanggal) for (const c of catatan) {
  total += 1;
  const k = periksaSiagaGaruda({ butir: b, nilai: v, tanggal: tg, catatan: c }, hari);
  const s = await pembina.catatSiagaGaruda({ pesertaId: tata, butir: b, nilai: v, tanggal: tg, catatan: c });
  if (k.ok !== s.ok || (!k.ok && k.pesan !== s.pesan)) { beda += 1; if (beda <= 5) console.log('   beda:', JSON.stringify({ b, v, tg, c: c.slice(0, 5) }), '| klien:', k.ok ? 'ok' : k.pesan, '| server:', s.ok ? 'ok' : s.pesan); }
}
ok(beda === 0, `cermin klien = server pada ${total} kombinasi (${beda} beda)`);

console.log('\n--- Saran otomatis (klien) ---');
const peserta = { id: 'a', agama: 'Islam', kelas: '6' };
const progress = { a: {} };
const dasar = { peserta, progress, pelantikan: [], tkk: [], penetapan: [], hari: '2026-10-01' };
let h = hitungSiagaGaruda(dasar);
ok(h.length === 6 && h.every((b) => b.status === 'belum'), 'tanpa data: enam butir belum');
ok(/SKU Tata belum selesai/.test(h[0].saran.teks), 'saran butir 1: SKU Tata belum selesai');
ok(/belum 4 di bidang/.test(h[1].saran.teks), 'saran butir 2: TKK kurang per bidang');
h = hitungSiagaGaruda({ ...dasar, penetapan: [{ pesertaId: 'a', butir: 3, nilai: 100, tanggal: '2026-09-01', catatan: '' }, { pesertaId: 'a', butir: 4, nilai: 0, tanggal: '2026-09-01', catatan: '' }, { pesertaId: 'b', butir: 5, nilai: 100, tanggal: '2026-09-01', catatan: '' }] });
ok(h[2].status === 'terpenuhi' && h[2].sumber === 'pembina' && h[3].status === 'belum' && h[4].status === 'belum', 'penetapan Pembina menentukan; penetapan anak lain tidak ikut');
ok(ringkasSiagaGaruda(h).terpenuhi === 1 && !ringkasSiagaGaruda(h).siap, 'ringkasan: 1 dari 6');
// TKK 4 per bidang -> saran terpenuhi; penetapan 0 menimpa saran.
const semuaTkk = [];
for (const bid of [1, 2, 3, 4, 5]) for (const t of tkkUntukSiaga('Islam').filter((x) => x.bidang === bid).slice(0, 4)) semuaTkk.push({ tkkId: t.id });
h = hitungSiagaGaruda({ ...dasar, tkk: semuaTkk });
ok(h[1].saran.terpenuhi && h[1].status === 'terpenuhi' && h[1].sumber === 'otomatis', 'saran butir 2 terpenuhi bila tiap bidang >= 4');
h = hitungSiagaGaruda({ ...dasar, tkk: semuaTkk, penetapan: [{ pesertaId: 'a', butir: 2, nilai: 0, tanggal: '2026-09-01', catatan: '' }] });
ok(h[1].status === 'belum' && h[1].sumber === 'pembina', 'penetapan Pembina menimpa saran');
// Butir 1: SKU Tata selesai + pelantikan Tata + 2 bulan.
const lengkapTata = {};
for (const poin of daftarPoin('Tata', 'Islam')) lengkapTata[poin.id] = { status: 'lulus', riwayat: [] };
const bagi = (pelantikan, hr) => hitungSiagaGaruda({ ...dasar, hari: hr, progress: { a: lengkapTata }, pelantikan });
const pel = [{ pesertaId: 'a', tingkat: 'tata', tanggal: '2026-08-01' }];
{
  ok(/pelantikan Tata belum dicatat/.test(bagi([], '2026-10-01')[0].saran.teks), 'butir 1: SKU Tata selesai, belum dilantik');
  ok(!bagi(pel, '2026-09-30')[0].saran.terpenuhi && /genap 2 bulan pada/.test(bagi(pel, '2026-09-30')[0].saran.teks), 'butir 1: belum genap 2 bulan');
  ok(bagi(pel, '2026-10-01')[0].saran.terpenuhi, 'butir 1: genap 2 bulan terpenuhi');
}
ok(Object.keys(lengkapTata).length > 20, 'katalog Tata terbaca (' + Object.keys(lengkapTata).length + ' unit)');
ok(BUTIR_SIAGA_GARUDA.length === 6, 'katalog 6 butir');

console.log(`\nRINGKASAN SIAGA-GARUDA: ${lulus} lulus, ${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
