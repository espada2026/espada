// Cermin klien periksaTabungan = sg_tabungan_catat (SQL): kisi masukan dibandingkan langsung (diterima/ditolak dan pesan yang sama).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { siapkanPg, buatKlienFake } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';
import { periksaTabungan } from '../src/lib/tabunganLogic.js';

const P = process.cwd().replace(/\\/g, '/');
let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };

const pg = new PGlite();
await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
await isiDataContoh(pg);
await pg.query('update public.profiles set wajib_ganti_pin = false');
const pembina = buatApi(buatKlienFake(pg));
await pembina.masuk('pembina', PIN_DEMO.pembina);
await pembina.tambahSiaga([{ nama: 'Anak Uji', kelas: '3', agama: 'Islam' }]);
const anak = (await pg.query(`select id from public.profiles where nama = 'Anak Uji'`)).rows[0].id;
const hari = (await pg.query('select sigarda.hari_ini()::text h')).rows[0].h;

const tanggal = ['2026-09-14', hari, '2015-01-01', '2014-12-31', '2099-12-31', '', null];
const jumlah = [1, 5000, 100000000, 0, -1, 100000001, null];
const catatan = ['', 'ok', 'x'.repeat(200), 'x'.repeat(201), '  spasi  ', null];
let n = 0, beda = 0;
for (const t of tanggal) for (const j of jumlah) for (const c of catatan) {
  n += 1;
  const k = periksaTabungan({ tanggal: t, jumlah: j, catatan: c }, hari);
  const s = await pembina.catatTabungan({ pesertaId: anak, tanggal: t, jumlah: j, catatan: c ?? '' });
  const samaHasil = k.ok === s.ok;
  const samaPesan = k.ok || (s.pesan === k.pesan);
  if (!samaHasil || !samaPesan) { beda += 1; if (beda <= 6) console.log('   beda:', JSON.stringify({ t, j, c: String(c).slice(0, 12) }), 'klien', JSON.stringify(k).slice(0, 90), 'server', JSON.stringify(s).slice(0, 110)); }
}
ok(beda === 0, `${n} kombinasi masukan: klien dan server sama (hasil dan pesan)`);
ok(!periksaTabungan(null).ok && !periksaTabungan([]).ok, 'masukan bukan objek ditolak');
{
  const k = periksaTabungan({ tanggal: '2026-09-14', jumlah: '2500', catatan: '  uang saku  ' }, hari);
  ok(k.ok && k.nilai.jumlah === 2500 && k.nilai.catatan === 'uang saku', 'jumlah teks dari formulir diubah ke angka dan catatan dirapikan');
  ok(!periksaTabungan({ tanggal: '2026-09-14', jumlah: '12,5' }, hari).ok && !periksaTabungan({ tanggal: '2026-09-14', jumlah: 1.5 }, hari).ok, 'pecahan ditolak di klien');
}

console.log(`\nRINGKASAN TABUNGAN-KLIEN: ${lulus} lulus, ${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
