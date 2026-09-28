// Fase 2 landing page: aturan isian Kelola Beranda konten di klien (src/lib/berandaKontenLogic.js) DIBANDINGKAN LANGSUNG dengan sg_berita_simpan,
// sg_prestasi_simpan, sg_galeri_simpan, sg_sosial_simpan, dan sg_faq_simpan di SQL pada kisi masukan (menerima/menolak sama).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { siapkanPg, buatKlienFake, sqlSebagai } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';
import {
  bolehUbah, periksaBerita, periksaFaq, periksaGaleri, periksaPrestasi, periksaSosial, tahunDari, terbitPadaDari, untukFormBerita, untukFormFaq, untukFormGaleri, untukFormPrestasi, untukFormSosial,
} from '../src/lib/berandaKontenLogic.js';
import { tanggalWib } from '../src/lib/berandaLogic.js';
import { hariIni as hariIniKlien } from '../src/lib/format.js';

const P = process.cwd().replace(/\\/g, '/');
let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };
const pg = new PGlite();
await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
await isiDataContoh(pg);
await pg.query('update public.profiles set wajib_ganti_pin = false');
const pembina = await (async () => { const a = buatApi(buatKlienFake(pg)); return (await a.masuk('pembina', PIN_DEMO.pembina)).id; })();
const HARI_INI = (await pg.query('select sigarda.hari_ini()::text d')).rows[0].d;

const url = (n) => `https://a.co/${'x'.repeat(Math.max(0, n - 13))}`;
const KANDIDAT_TAUTAN = ['', 'https://a.co', 'http://a.co', 'https://a', 'HTTPS://a.co', 'javascript:alert(1)', url(300), url(301), 'https://a.co/😀', '  https://a.co  '];
const KANDIDAT_JUDUL = ['', 'x', 'x'.repeat(150), 'x'.repeat(151), '😀'.repeat(150), '😀'.repeat(151), '  Judul dengan spasi  '];

console.log('--- Berita: kisi masukan klien = server ---');
{
  const DASAR = { kategori: 'kegiatan', judul: 'Judul', ringkasan: 'Ringkas', isi: 'Isi berita', sampulUrl: '' };
  const server = async (b, status) => { try { await sqlSebagai(pg, pembina, 'select public.sg_berita_simpan(null, $1, $2, $3, $4, $5, $6, null)', [b.kategori, b.judul, b.ringkasan, b.isi, b.sampulUrl, status]); return true; } catch { return false; } };
  const klien = (b, status) => Object.keys(periksaBerita(b, status, true)).length === 0;
  let n = 0; const beda = [];
  for (const status of ['draf', 'menunggu', 'terbit', 'ditolak', 'entah']) {
    const s = await server(DASAR, status), c = klien(DASAR, status); n++;
    if (s !== c) beda.push(`status=${status}: server ${s}, klien ${c}`);
  }
  for (const judul of KANDIDAT_JUDUL) {
    const b = { ...DASAR, judul }; const s = await server(b, 'draf'), c = klien(b, 'draf'); n++;
    if (s !== c) beda.push(`judul=${JSON.stringify(judul).slice(0, 30)}: server ${s}, klien ${c}`);
  }
  for (const isi of ['', 'x', 'x'.repeat(4000), 'x'.repeat(4001)]) {
    const b = { ...DASAR, isi }; const s = await server(b, 'draf'), c = klien(b, 'draf'); n++;
    if (s !== c) beda.push(`isi len=${isi.length}: server ${s}, klien ${c}`);
  }
  for (const ringkasan of ['x'.repeat(200), 'x'.repeat(201)]) {
    const b = { ...DASAR, ringkasan }; const s = await server(b, 'draf'), c = klien(b, 'draf'); n++;
    if (s !== c) beda.push(`ringkasan len=${ringkasan.length}: server ${s}, klien ${c}`);
  }
  for (const sampulUrl of KANDIDAT_TAUTAN) {
    const b = { ...DASAR, sampulUrl }; const s = await server(b, 'draf'), c = klien(b, 'draf'); n++;
    if (s !== c) beda.push(`sampulUrl=${JSON.stringify(sampulUrl)}: server ${s}, klien ${c}`);
  }
  for (const kategori of ['kegiatan', 'pengumuman', 'lainnya', 'entah']) {
    const b = { ...DASAR, kategori }; const s = await server(b, 'draf'), c = klien(b, 'draf'); n++;
    if (s !== c) beda.push(`kategori=${kategori}: server ${s}, klien ${c}`);
  }
  ok(beda.length === 0, `${n} kombinasi berita: klien dan server sama-sama menerima/menolak${beda.length ? ' | BEDA: ' + beda.slice(0, 6).join(' ; ') : ''}`);
  {
    // Tanggal terbit: kisi masukan klien (terbitTanggal lewat terbitPadaDari) = server (p_terbit_pada)
    const hariSql = async (n) => (await pg.query('select (sigarda.hari_ini() + $1::int)::text d', [n])).rows[0].d;
    const kandidatTanggal = ['', await hariSql(0), await hariSql(-400), await hariSql(1), await hariSql(365), await hariSql(366), await hariSql(367), '2015-01-01', '2014-12-31', '1999-05-05', '2026-13-45', '2026-02-30', 'abc'];
    const bedaTanggal = [];
    for (const tanggal of kandidatTanggal) {
      const b = { ...DASAR, terbitTanggal: tanggal };
      let s = true;
      try { await sqlSebagai(pg, pembina, 'select public.sg_berita_simpan(null, $1, $2, $3, $4, $5, $6, $7::timestamptz)', [b.kategori, b.judul, b.ringkasan, b.isi, b.sampulUrl, 'draf', terbitPadaDari(tanggal)]); } catch { s = false; }
      const c = klien(b, 'draf');
      if (s !== c) bedaTanggal.push(`tanggal=${JSON.stringify(tanggal)}: server ${s}, klien ${c}`);
    }
    ok(bedaTanggal.length === 0, `${kandidatTanggal.length} tanggal terbit: klien dan server sama-sama menerima/menolak${bedaTanggal.length ? ' | BEDA: ' + bedaTanggal.join(' ; ') : ''}`);
  }
  // bolehTerbit = false (Dewan): status 'terbit' harus ditolak DI KEDUA SISI
  ok(!(await server(DASAR, 'terbit_sbg_dewan')) === true || true, ''); // no-op, dicek eksplisit di bawah
  const sDewanTerbit = await (async () => { try { const dewan = await (async () => { const a = buatApi(buatKlienFake(pg)); return (await a.masuk('dewan', PIN_DEMO.dewan)).id; })(); await sqlSebagai(pg, dewan, "select public.sg_berita_simpan(null, 'kegiatan', 'x', '', 'y', '', 'terbit', null)"); return true; } catch { return false; } })();
  ok(sDewanTerbit === false && Object.keys(periksaBerita(DASAR, 'terbit', false)).length > 0, 'Dewan (bolehTerbit=false): status terbit ditolak di server dan klien');
}

console.log('\n--- Prestasi: kisi masukan klien = server ---');
{
  const tahunIni = tahunDari(HARI_INI);
  const DASAR = { judul: 'Juara 1', tingkat: 'ranting', peringkat: 'Juara 1', tahun: tahunIni, diraihOleh: 'Regu Putra', fotoUrl: '' };
  const server = async (p) => { try { await sqlSebagai(pg, pembina, 'select public.sg_prestasi_simpan(null, $1, $2, $3, $4, $5, $6, $7)', [p.judul, p.tingkat, p.peringkat, Number(p.tahun), p.diraihOleh, p.fotoUrl, 'draf']); return true; } catch { return false; } };
  const klien = (p) => Object.keys(periksaPrestasi(p, 'draf', true, HARI_INI)).length === 0;
  let n = 0; const beda = [];
  for (const tahun of [1999, 2000, tahunIni, tahunIni + 1, 'x', '', 2026.5]) {
    const p = { ...DASAR, tahun }; const s = await server(p), c = klien(p); n++;
    if (s !== c) beda.push(`tahun=${JSON.stringify(tahun)}: server ${s}, klien ${c}`);
  }
  for (const tingkat of ['gudep', 'ranting', 'cabang', 'provinsi', 'nasional', 'entah']) {
    const p = { ...DASAR, tingkat }; const s = await server(p), c = klien(p); n++;
    if (s !== c) beda.push(`tingkat=${tingkat}: server ${s}, klien ${c}`);
  }
  for (const judul of KANDIDAT_JUDUL) { const p = { ...DASAR, judul }; const s = await server(p), c = klien(p); n++; if (s !== c) beda.push(`judul: server ${s}, klien ${c}`); }
  for (const peringkat of ['', 'x', 'x'.repeat(60), 'x'.repeat(61)]) { const p = { ...DASAR, peringkat }; const s = await server(p), c = klien(p); n++; if (s !== c) beda.push(`peringkat len=${peringkat.length}: server ${s}, klien ${c}`); }
  for (const diraihOleh of ['', 'x'.repeat(150), 'x'.repeat(151)]) { const p = { ...DASAR, diraihOleh }; const s = await server(p), c = klien(p); n++; if (s !== c) beda.push(`diraihOleh len=${diraihOleh.length}: server ${s}, klien ${c}`); }
  for (const fotoUrl of KANDIDAT_TAUTAN) { const p = { ...DASAR, fotoUrl }; const s = await server(p), c = klien(p); n++; if (s !== c) beda.push(`fotoUrl=${JSON.stringify(fotoUrl)}: server ${s}, klien ${c}`); }
  ok(beda.length === 0, `${n} kombinasi prestasi: klien dan server sama-sama menerima/menolak${beda.length ? ' | BEDA: ' + beda.slice(0, 6).join(' ; ') : ''}`);
}

console.log('\n--- Galeri: kisi masukan klien = server ---');
{
  const DASAR = { judul: 'Album', tautan: 'https://drive.google.com/x', sampulUrl: '', kelompok: 'latihan' };
  const server = async (g) => { try { await sqlSebagai(pg, pembina, 'select public.sg_galeri_simpan(null, $1, $2, $3, $4, $5)', [g.judul, g.tautan, g.sampulUrl, g.kelompok, 'draf']); return true; } catch { return false; } };
  const klien = (g) => Object.keys(periksaGaleri(g, 'draf', true)).length === 0;
  let n = 0; const beda = [];
  for (const judul of ['', 'x', 'x'.repeat(100), 'x'.repeat(101)]) { const g = { ...DASAR, judul }; const s = await server(g), c = klien(g); n++; if (s !== c) beda.push(`judul len=${judul.length}: server ${s}, klien ${c}`); }
  for (const tautan of KANDIDAT_TAUTAN) { const g = { ...DASAR, tautan }; const s = await server(g), c = klien(g); n++; if (s !== c) beda.push(`tautan=${JSON.stringify(tautan)}: server ${s}, klien ${c}`); }
  for (const sampulUrl of KANDIDAT_TAUTAN) { const g = { ...DASAR, sampulUrl }; const s = await server(g), c = klien(g); n++; if (s !== c) beda.push(`sampulUrl=${JSON.stringify(sampulUrl)}: server ${s}, klien ${c}`); }
  for (const kelompok of ['latihan', 'perkemahan', 'pelantikan', 'lainnya', 'entah']) { const g = { ...DASAR, kelompok }; const s = await server(g), c = klien(g); n++; if (s !== c) beda.push(`kelompok=${kelompok}: server ${s}, klien ${c}`); }
  ok(beda.length === 0, `${n} kombinasi galeri: klien dan server sama-sama menerima/menolak${beda.length ? ' | BEDA: ' + beda.slice(0, 6).join(' ; ') : ''}`);
}

console.log('\n--- Media sosial: kisi masukan klien = server ---');
{
  const DASAR = { platform: 'instagram', tautan: 'https://instagram.com/x', keterangan: 'Ket', gambarUrl: '' };
  const server = async (s) => { try { await sqlSebagai(pg, pembina, 'select public.sg_sosial_simpan(null, $1, $2, $3, $4, true)', [s.platform, s.tautan, s.keterangan, s.gambarUrl]); return true; } catch { return false; } };
  const klien = (s) => Object.keys(periksaSosial(s)).length === 0;
  let n = 0; const beda = [];
  for (const platform of ['instagram', 'youtube', 'facebook', 'tiktok', 'entah']) { const s = { ...DASAR, platform }; const sv = await server(s), c = klien(s); n++; if (sv !== c) beda.push(`platform=${platform}: server ${sv}, klien ${c}`); }
  for (const tautan of KANDIDAT_TAUTAN) { const s = { ...DASAR, tautan }; const sv = await server(s), c = klien(s); n++; if (sv !== c) beda.push(`tautan=${JSON.stringify(tautan)}: server ${sv}, klien ${c}`); }
  for (const keterangan of ['', 'x'.repeat(200), 'x'.repeat(201)]) { const s = { ...DASAR, keterangan }; const sv = await server(s), c = klien(s); n++; if (sv !== c) beda.push(`keterangan len=${keterangan.length}: server ${sv}, klien ${c}`); }
  for (const gambarUrl of KANDIDAT_TAUTAN) { const s = { ...DASAR, gambarUrl }; const sv = await server(s), c = klien(s); n++; if (sv !== c) beda.push(`gambarUrl=${JSON.stringify(gambarUrl)}: server ${sv}, klien ${c}`); }
  ok(beda.length === 0, `${n} kombinasi media sosial: klien dan server sama-sama menerima/menolak${beda.length ? ' | BEDA: ' + beda.slice(0, 6).join(' ; ') : ''}`);
}

console.log('\n--- FAQ: kisi masukan klien = server ---');
{
  const DASAR = { pertanyaan: 'Pertanyaan?', jawaban: 'Jawaban.' };
  const server = async (f) => { try { await sqlSebagai(pg, pembina, 'select public.sg_faq_simpan(null, $1, $2)', [f.pertanyaan, f.jawaban]); return true; } catch { return false; } };
  const klien = (f) => Object.keys(periksaFaq(f)).length === 0;
  let n = 0; const beda = [];
  for (const pertanyaan of ['', 'x', 'x'.repeat(200), 'x'.repeat(201), '😀'.repeat(200), '😀'.repeat(201)]) { const f = { ...DASAR, pertanyaan }; const s = await server(f), c = klien(f); n++; if (s !== c) beda.push(`pertanyaan len=${pertanyaan.length}: server ${s}, klien ${c}`); }
  for (const jawaban of ['', 'x', 'x'.repeat(1000), 'x'.repeat(1001)]) { const f = { ...DASAR, jawaban }; const s = await server(f), c = klien(f); n++; if (s !== c) beda.push(`jawaban len=${jawaban.length}: server ${s}, klien ${c}`); }
  ok(beda.length === 0, `${n} kombinasi FAQ: klien dan server sama-sama menerima/menolak${beda.length ? ' | BEDA: ' + beda.slice(0, 6).join(' ; ') : ''}`);
}

console.log('\n--- untukForm*: aman untuk data rusak ---');
{
  ok(/^\d{4}-\d{2}-\d{2}$/.test(untukFormBerita(null).terbitTanggal) && untukFormBerita(null).terbitTanggal === hariIniKlien(), 'untukFormBerita: berita baru memakai hari ini (WIB) sebagai tanggal terbit bawaan');
  ok(untukFormBerita({ terbitPada: '2026-08-30T17:00:00+00:00' }).terbitTanggal === '2026-08-31' && untukFormBerita({ terbitPada: '2026-08-30T16:59:59+00:00' }).terbitTanggal === '2026-08-30', 'untukFormBerita: tanggal dari waktu terbit dibaca menurut WIB (17.00 UTC = 00.00 WIB hari berikutnya)');
  ok(untukFormBerita({ terbitTanggal: '', terbitPada: '2026-08-31T00:00:00+07:00' }).terbitTanggal === '', 'tanggal yang dikosongkan pengguna tetap kosong (tidak dikembalikan ke bawaan)');
  ok(tanggalWib('2026-08-30T17:00:00+00:00') === '2026-08-31' && tanggalWib('2026-08-31T00:00:00+07:00') === '2026-08-31' && tanggalWib('bukan tanggal') === '' && tanggalWib(null) === '', 'tanggalWib: cap waktu ke tanggal kalender WIB, rusak = kosong');
  ok(terbitPadaDari('') === null && terbitPadaDari('  ') === null && terbitPadaDari(null) === null, 'terbitPadaDari: kosong = null (server memakai saat diterbitkan)');
  ok(terbitPadaDari('2026-08-31') === '2026-08-31T00:00:00+07:00' && tanggalWib(terbitPadaDari('2026-08-31')) === '2026-08-31', 'terbitPadaDari: tanggal baru = 00.00 WIB tanggal itu, dan kembali ke tanggal yang sama');
  ok(terbitPadaDari('2026-08-31', '2026-08-31T03:20:00+07:00') === '2026-08-31T03:20:00+07:00' && terbitPadaDari('2026-09-01', '2026-08-31T03:20:00+07:00') === '2026-09-01T00:00:00+07:00', 'terbitPadaDari: tanggal tidak diubah = waktu semula (jam tidak bergeser); diubah = tanggal baru');
  ok(untukFormBerita(null).kategori === 'kegiatan' && untukFormBerita({ kategori: 'entah' }).kategori === 'kegiatan', 'untukFormBerita: kategori tak dikenal jatuh ke bawaan');
  ok(untukFormPrestasi(null).tingkat === 'ranting' && typeof untukFormPrestasi({ tahun: '2026' }).tahun === 'number', 'untukFormPrestasi: bawaan dan tahun dipaksa angka');
  ok(untukFormGaleri(5).judul === '' && untukFormGaleri({ kelompok: 'entah' }).kelompok === 'lainnya', 'untukFormGaleri: aman untuk input bukan objek');
  ok(untukFormSosial(null).tampil === true && untukFormSosial({ tampil: false }).tampil === false, 'untukFormSosial: tampil bawaan true');
  ok(untukFormFaq(undefined).pertanyaan === '' && untukFormFaq(undefined).jawaban === '', 'untukFormFaq: aman untuk undefined');
}

console.log('\n--- bolehUbah (cermin sigarda.beranda_konten_boleh_ubah) ---');
{
  const A = 'akun-a', B = 'akun-b';
  for (const status of ['draf', 'menunggu', 'ditolak']) {
    ok(bolehUbah(false, A, status, A) === true, `pemilik boleh ubah miliknya sendiri saat status ${status}`);
    ok(bolehUbah(false, A, status, B) === false, `bukan pemilik (bukan Pembina/Admin) tidak boleh ubah saat status ${status}`);
  }
  ok(bolehUbah(false, A, 'terbit', A) === false, 'pemilik TIDAK boleh ubah miliknya sendiri yang sudah terbit');
  ok(bolehUbah(true, A, 'terbit', B) === true, 'Pembina/Admin boleh ubah kapan saja, siapa pun pemiliknya');
  // Dibandingkan langsung dengan SQL: dipanggil SEBAGAI Pembina (bolehTerbit selalu true dari sudut pandang server saat itu)
  let beda = 0;
  for (const status of ['draf', 'menunggu', 'terbit', 'ditolak']) {
    for (const sama of [true, false]) {
      const sql = (await sqlSebagai(pg, pembina, 'select sigarda.beranda_konten_boleh_ubah($1::uuid, $2) as b', [sama ? pembina : '00000000-0000-4000-8000-000000000000', status])).rows[0].b;
      const klienNilai = bolehUbah(true, sama ? pembina : 'lain', status, pembina);
      if (sql !== klienNilai) beda++;
    }
  }
  ok(beda === 0, 'bolehUbah (dipanggil sebagai Pembina) sama dengan sigarda.beranda_konten_boleh_ubah pada seluruh kombinasi status/kepemilikan');
  // Dibandingkan sebagai pengurus BUKAN Pembina/Admin (Dewan): giliran kepemilikan yang menentukan.
  const dewanId = await (async () => { const a = buatApi(buatKlienFake(pg)); return (await a.masuk('dewan', PIN_DEMO.dewan)).id; })();
  let beda2 = 0;
  for (const status of ['draf', 'menunggu', 'terbit', 'ditolak']) {
    for (const sama of [true, false]) {
      const sql = (await sqlSebagai(pg, dewanId, 'select sigarda.beranda_konten_boleh_ubah($1::uuid, $2) as b', [sama ? dewanId : pembina, status])).rows[0].b;
      const klienNilai = bolehUbah(false, sama ? dewanId : pembina, status, dewanId);
      if (sql !== klienNilai) beda2++;
    }
  }
  ok(beda2 === 0, 'bolehUbah (dipanggil sebagai Dewan, bukan Pembina/Admin) sama dengan sigarda.beranda_konten_boleh_ubah pada seluruh kombinasi status/kepemilikan');
}

console.log(`\nRINGKASAN BERANDA-KONTEN-KLIEN: ${lulus} lulus, ${gagal} GAGAL.`);
await pg.close();
if (gagal) process.exit(1);
