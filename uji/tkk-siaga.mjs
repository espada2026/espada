// TKK anak Siaga (Fase 5): hak, syarat, koreksi, hapus, cadangan, dan cermin klien periksaTkkSiaga = sg_tkk_siaga_catat (kisi masukan dibandingkan langsung).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { siapkanPg, buatKlienFake } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';
import { periksaTkkSiaga, pilihanTkkSiaga, ringkasTkkSiaga } from '../src/lib/tkkSiagaLogic.js';
import { tkkUntukSiaga, KATALOG_TKK } from '../src/data/tkkData.js';
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
await pembina.tambahSiaga([{ nama: 'Anak Islam', kelas: '4', agama: 'Islam' }, { nama: 'Anak Hindu', kelas: '5A', agama: 'Hindu' }, { nama: 'Anak Belum', kelas: '3', agama: 'Islam' }]);
const idDari = async (nama) => (await pg.query('select id from public.profiles where nama = $1', [nama])).rows[0].id;
const islam = await idDari('Anak Islam'), hindu = await idDari('Anak Hindu'), belum = await idDari('Anak Belum');
const hari = (await pg.query('select sigarda.hari_ini()::text h')).rows[0].h;
const luluskan = (id, tingkat) => pg.query(`insert into public.sku_progress (peserta_id, sku_id, status) select p.id, u.id, 'lulus' from public.profiles p join public.sku_unit u on u.tingkat = $2 and (u.agama is null or u.agama = p.agama) where p.id = $1 on conflict do nothing`, [id, tingkat]);
for (const id of [islam, hindu]) { await luluskan(id, 'Mula'); await luluskan(id, 'Bantu'); }
await luluskan(belum, 'Mula');

console.log('--- Syarat dan hak ---');
const tk = (id, t, a = {}) => pembina.catatTkkSiaga({ pesertaId: id, tkkId: t, tanggal: '2026-09-01', penguji: 'Bunda Ani', ...a });
let r = await tk(belum, 'menyanyi');
ok(!r.ok && /belum menyelesaikan SKU Bantu/.test(r.pesan), 'ditolak sebelum Bantu selesai: ' + r.pesan);
r = await tk(islam, 'menyanyi');
ok(r.ok, 'dicatat sesudah Bantu selesai ' + (r.pesan ?? ''));
r = await tk(islam, 'menyanyi', { tanggal: '2026-09-02', penguji: 'Pakcik Budi' });
ok(r.ok, 'mencatat ulang = koreksi');
const n = (await pg.query('select count(*)::int c, max(penguji) p from public.tkk_siaga where peserta_id = $1', [islam])).rows[0];
ok(n.c === 1 && n.p === 'Pakcik Budi', 'satu baris per TKK, isi diperbarui');
r = await tk(islam, 'sholat');
ok(r.ok, 'TKK agama sesuai (Sholat untuk Islam)');
r = await tk(hindu, 'sholat');
ok(!r.ok && /khusus penganut agama Islam/.test(r.pesan), 'TKK agama lain ditolak: ' + r.pesan);
r = await tk(islam, 'berkemah');
ok(!r.ok && /belum dipakai untuk golongan Siaga/.test(r.pesan), 'SKK tambahan (sesudah SK 132/1979) ditolak: ' + r.pesan);
r = await tk(islam, 'tidak-ada');
ok(!r.ok && /TKK tidak dikenal/.test(r.pesan), 'TKK tidak dikenal');
r = await tk(islam, 'menyanyi', { tanggal: '2099-01-01' });
ok(!r.ok && /antara 1 Januari 2015 dan hari ini/.test(r.pesan), 'tanggal masa depan ditolak');
const penegak = (await pg.query(`select id from public.profiles where role = 'peserta' and not tanpa_akun and kelas like 'X%' limit 1`)).rows[0]?.id;
if (penegak) { r = await tk(penegak, 'menyanyi'); ok(!r.ok && /hanya dicatat untuk anggota Siaga/.test(r.pesan), 'Penegak SMA ditolak'); }

console.log('\n--- Baca, hapus, cadangan, anggota tak aktif ---');
const baris = await pembina.muatTkkSiaga(islam);
ok(baris.ok && baris.data.length === 2, 'Pembina membaca TKK anak (' + baris.data?.length + ')');
const ring = ringkasTkkSiaga(baris.data);
ok(ring.total === 2 && ring.perBidang[1] === 1 && ring.perBidang[2] === 1, 'ringkasan per bidang');
const adm = buatApi(buatKlienFake(pg));
await adm.masuk('admin', PIN_DEMO.admin);
const cad = await adm.unduhCadangan();
ok(cad.ok && JSON.stringify(cad.data).includes('"tkk_siaga"'), 'cadangan memuat tkk_siaga');
r = await pembina.hapusTkkSiaga(baris.data[0].id);
ok(r.ok, 'Pembina menghapus catatan');
await pg.query(`update public.profiles set status = 'nonaktif' where id = $1`, [islam]);
r = await tk(islam, 'juru-masak');
ok(!r.ok, 'anggota nonaktif ditolak: ' + r.pesan);
r = await pembina.hapusTkkSiaga(baris.data[1].id);
ok(!r.ok && /nonaktif atau alumni/.test(r.pesan), 'hapus untuk nonaktif ditolak');
await pg.query(`update public.profiles set status = 'aktif' where id = $1`, [islam]);
ok((await pg.query(`select has_table_privilege('authenticated', 'public.tkk_siaga', 'insert') w`)).rows[0].w === false, 'klien tidak dapat menulis tabel langsung');

console.log('\n--- Cermin klien = SQL (kisi masukan) ---');
await pg.query('delete from public.tkk_siaga');
const tkkIds = ['menyanyi', 'sholat', 'berkemah', 'tidak-ada'];
const tanggal = ['2026-09-01', hari, '2014-12-31', '2099-12-31', ''];
const penguji = ['Bunda Ani', 'x'.repeat(81), '  ', 'a<b'];
const bukti = ['', 'https://contoh.id/a', 'ftp://x'];
const catatan = ['', 'x'.repeat(201), 'a>b'];
let total = 0, beda = 0;
for (const t of tkkIds) for (const tg of tanggal) for (const p of penguji) for (const b of bukti) for (const c of catatan) {
  total += 1;
  const k = periksaTkkSiaga({ tkkId: t, tanggal: tg, penguji: p, buktiUrl: b, catatan: c, agama: 'Hindu' }, hari);
  const s = await pembina.catatTkkSiaga({ pesertaId: hindu, tkkId: t, tanggal: tg, penguji: p, buktiUrl: b, catatan: c });
  if (k.ok !== s.ok || (!k.ok && k.pesan !== s.pesan)) { beda += 1; if (beda <= 5) console.log('   beda:', JSON.stringify({ t, tg, p: p?.slice(0, 5), b: b.slice(0, 10), c: c.slice(0, 5) }), '| klien:', k.ok ? 'ok' : k.pesan, '| server:', s.ok ? 'ok' : s.pesan); }
}
ok(beda === 0, `cermin klien = server pada ${total} kombinasi (${beda} beda)`);

console.log('\n--- Katalog ---');
ok(tkkUntukSiaga('Hindu').length === 80 && tkkUntukSiaga('Islam').length === 84, 'katalog Siaga: 84 SKK (Islam), 80 (tanpa 4 SKK khusus Islam)');
ok(KATALOG_TKK.filter((t) => t.sumber === 'skk-132-1979').length === 84, '84 SKK SK 132/1979 dalam katalog');
ok(pilihanTkkSiaga('Hindu', [{ tkkId: 'menyanyi' }]).every((g) => g.daftar.every((t) => t.id !== 'menyanyi' && t.id !== 'sholat')), 'pilihan menyaring yang sudah dimiliki dan agama lain');

console.log(`\nRINGKASAN TKK-SIAGA: ${lulus} lulus, ${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
