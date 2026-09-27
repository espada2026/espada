// Fase 1 landing page: aturan isian beranda di klien (src/lib/berandaLogic.js) DIBANDINGKAN LANGSUNG dengan sg_beranda_kontak_simpan dan sigarda.rapikan_paragraf di SQL
// pada kisi masukan (menerima/menolak sama; perapian sama), ditambah logika tampilan murni (tanggal, tautan, jaringan sosial).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { siapkanPg, buatKlienFake, sqlSebagai } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';
import { BATAS, KOLOM_PARAGRAF, KOLOM_TAUTAN, SEMUA_KOLOM, jaringanSosial, pecahParagraf, pecahTanggal, periksaKontak, rapikan, rapikanParagraf, samaKontak, tautanPencarianPeta, tautanPeta, tautanWhatsapp, untukForm, untukKirim } from '../src/lib/berandaLogic.js';

const P = process.cwd().replace(/\\/g, '/');
let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };
const pg = new PGlite();
await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
await isiDataContoh(pg);
await pg.query('update public.profiles set wajib_ganti_pin = false');
const pembina = await (async () => { const a = buatApi(buatKlienFake(pg)); return (await a.masuk('pembina', PIN_DEMO.pembina)).id; })();
const server = async (nilai) => { try { await sqlSebagai(pg, pembina, 'select public.sg_beranda_kontak_simpan($1::jsonb)', [JSON.stringify(nilai)]); return true; } catch { return false; } };
const klien = (nilai) => Object.keys(periksaKontak(nilai)).length === 0;

const DASAR = {
  whatsapp: '0812 3456 7890', email: 'a@b.co', telepon: '0281 123', jadwal: 'Jumat', instagram: 'https://a.co', youtube: 'https://a.co', facebook: 'https://a.co', tiktok: 'https://a.co', peta: 'https://a.co',
  sambutanPembina: 'Halo', sambutanKepsek: 'Halo', cerita: 'Halo',
};
const url = (n) => `https://a.co/${'x'.repeat(Math.max(0, n - 13))}`;
const KANDIDAT = {
  whatsapp: ['', '   ', '0812 3456 7890', '+62 812-3456-7890', '0812', '12345678', '1234567', '1'.repeat(20), '1'.repeat(21), '(0281) 12-3456', '08a12345678', '0812 3456 789 x'],
  telepon: ['', '0281 123', '(0281)123/456', 'telp', '0281-123x', '+62 281 123', '0'.repeat(40), '0'.repeat(41)],
  email: ['', 'a@b.co', 'a@b', '@b.co', 'a b@c.co', 'a@b.c', 'x@y.z.w', 'a@b@c.co', `${'a'.repeat(94)}@b.co`, `${'a'.repeat(95)}@b.co`, '  a@b.co  '],
  jadwal: ['', 'Jumat', 'x'.repeat(120), 'x'.repeat(121), '  Jumat   sore  ', '😀'.repeat(120), '😀'.repeat(121)],
  tautan: ['', 'https://a.co', 'https://a.co/path?x=1#y', 'http://a.co', 'https://a', 'https://a.b', 'https://A-b.c0.id/x', 'https://exa mple.com', 'HTTPS://a.co', 'https://a..co', 'javascript:alert(1)', 'ftp://a.co', '//a.co', '  https://a.co  ', url(300), url(301), 'https://a.co/😀', 'https://a.co?q=a b'],
  paragraf: ['', 'Halo', 'x'.repeat(1500), 'x'.repeat(1501), `${'x'.repeat(1499)}\r\n\r\n\r\n`, `a${'\n'.repeat(50)}b`, 'a\r\n\r\n\r\n\r\nb', '😀'.repeat(1500), '😀'.repeat(1501), 'x'.repeat(2000), 'x'.repeat(2001)],
};
const daftarKolom = (k) => (KOLOM_TAUTAN.includes(k) ? KANDIDAT.tautan : KOLOM_PARAGRAF.includes(k) ? KANDIDAT.paragraf : KANDIDAT[k]);

console.log('--- Kisi masukan: klien = server ---');
{
  ok((await server(DASAR)) && klien(DASAR), 'nilai dasar sah di kedua sisi');
  let n = 0;
  const beda = [];
  for (const k of SEMUA_KOLOM) {
    for (const v of daftarKolom(k)) {
      const nilai = { ...DASAR, [k]: v };
      const s = await server(nilai), c = klien(nilai);
      n++;
      if (s !== c) beda.push(`${k}=${JSON.stringify(v).slice(0, 40)}: server ${s ? 'menerima' : 'menolak'}, klien ${c ? 'menerima' : 'menolak'}`);
    }
  }
  ok(beda.length === 0, `${n} kombinasi: klien dan server sama-sama menerima/menolak${beda.length ? ' | BEDA: ' + beda.slice(0, 6).join(' ; ') : ''}`);
  ok(SEMUA_KOLOM.length === 12 && Object.keys(BATAS).length === 12, '12 kolom, semua punya batas');
}

console.log('\n--- Perapian: klien = server ---');
{
  const contoh = ['', ' a ', 'a  b', 'a\r\nb', 'a\rb', 'a\n\n\nb', 'a \n \n \n b', '\n\na\n\n', 'a\t\tb', 'a\n \nb', ' a\r\n\r\n\r\n\r\nb ', 'x\n\n\n\n\n\ny\n', 'ç é ñ\n\n\n😀', '  \n  '];
  const beda = [];
  for (const t of contoh) {
    const s = (await pg.query('select sigarda.rapikan_paragraf($1) as t', [t])).rows[0].t;
    if (s !== rapikanParagraf(t)) beda.push(JSON.stringify(t));
  }
  ok(beda.length === 0, `rapikanParagraf sama dengan sigarda.rapikan_paragraf pada ${contoh.length} contoh${beda.length ? ' | BEDA: ' + beda.join(' ') : ''}`);
  const contoh1 = ['', '  a  ', 'a   b', 'a\nb', ' \t a \t ', '\t\t', 'a\t\tb', '\n a \n', 'ç  é'];
  const b1 = [];
  for (const t of contoh1) { const s = (await pg.query('select sigarda.rapikan_baris($1) as t', [t])).rows[0].t; if (s !== rapikan(t)) b1.push(JSON.stringify(t)); }
  ok(b1.length === 0, `rapikan sama dengan sigarda.rapikan_baris pada ${contoh1.length} contoh${b1.length ? ' | BEDA: ' + b1.join(' ') : ''}`);
  const harapan = { ...Object.fromEntries(SEMUA_KOLOM.map((k) => [k, ''])), whatsapp: '1 2', cerita: 'a\n\nb' };
  ok(JSON.stringify(untukKirim({ whatsapp: '  1  2 ', cerita: 'a\r\n\r\n\r\nb' })) === JSON.stringify(harapan), 'untukKirim melengkapi 12 kolom dan merapikan');
  ok(samaKontak({ email: ' a@b.co ' }, { email: 'a@b.co', jadwal: '' }) && !samaKontak({ email: 'a@b.co' }, { email: 'b@b.co' }), 'samaKontak membandingkan setelah dirapikan');
  ok(Object.keys(untukForm({ cerita: 5, asing: 'x', email: 'a' })).length === 12 && untukForm({ cerita: 5 }).cerita === '', 'untukForm: 12 kolom, bukan teks menjadi kosong, kunci asing dibuang');
}

console.log('\n--- Tampilan murni ---');
{
  const t = pecahTanggal('2026-10-02');
  ok(t.hari === 2 && t.bulan === 'Oktober' && t.bulanPendek === 'Okt' && t.tahun === 2026 && t.namaHari === 'Jumat', 'pecahTanggal 2026-10-02 = Jumat, 2 Oktober 2026');
  ok(pecahTanggal('2026-02-30') === null && pecahTanggal('2026-13-01') === null && pecahTanggal('besok') === null && pecahTanggal(null) === null, 'pecahTanggal menolak tanggal yang tidak ada');
  ok(pecahTanggal('2024-02-29').namaHari === 'Kamis' && pecahTanggal('2026-01-01').namaHari === 'Kamis', 'nama hari tepat (tahun kabisat dan awal tahun)');
  ok(JSON.stringify(pecahParagraf('a\n\n\nb\n\n  \n\nc')) === '["a","b","c"]' && pecahParagraf('').length === 0, 'pecahParagraf memisah pada baris kosong');
  ok(tautanWhatsapp('0812 3456 7890').startsWith('https://wa.me/6281234567890') && tautanWhatsapp('') === '' && tautanWhatsapp('abc') === '', 'tautanWhatsapp: nomor lokal menjadi 62..., kosong/rusak = tanpa tautan');
  const kontak = { instagram: 'https://instagram.com/x', youtube: '', facebook: 'javascript:alert(1)', tiktok: 'https://tiktok.com/@x', peta: 'http://tidak-aman.com' };
  ok(jaringanSosial(kontak).map((s) => s.kunci).join() === 'instagram,tiktok', 'jaringanSosial hanya memuat tautan https yang sah (javascript: dan kosong dibuang)');
  ok(tautanPeta(kontak) === '' && tautanPeta({ peta: 'https://maps.app.goo.gl/x' }) === 'https://maps.app.goo.gl/x', 'tautanPeta: hanya https yang sah');
  ok(tautanPencarianPeta('SMA Negeri 1 Bukateja', 'Bukateja') === 'https://www.google.com/maps/search/?api=1&query=SMA%20Negeri%201%20Bukateja%20Bukateja', 'tautan pencarian peta bawaan');
}

console.log(`\nRINGKASAN BERANDA-KLIEN: ${lulus} lulus, ${gagal} GAGAL.`);
await pg.close();
if (gagal) process.exit(1);
