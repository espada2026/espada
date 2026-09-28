// Sisi klien "muat lebih lama" untuk Prestasi, Galeri, dan Media Sosial (seperti Berita): penyusun aman, penggabungan tanpa kembar, jalur data penuh terhadap SQL
// sungguhan (6 + 6 + sisa), dan tombol di bagian-bagian beranda. Aturan pemotongan ada di server (uji/muat-lebih-lama.mjs); Agenda sengaja tidak berubah.
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { siapkanPg, sqlSebagai } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { gabungKartu, susunBerandaPublik, susunGaleri, susunKartuLagi, susunPrestasi, susunSosial } from '../src/lib/berandaLogic.js';
import { Galeri, MediaSosial, Prestasi } from '../src/landing/bagian.jsx';

const P = process.cwd().replace(/\\/g, '/');
let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };
const teks = (el) => renderToStaticMarkup(el);

console.log('--- Penyusun dan penggabung ---');
{
  ok(susunPrestasi([{ judul: 'A', tahun: '2025' }, { judul: '' }, null, 'x']).length === 1 && susunPrestasi([{ judul: 'A', tahun: '2025' }])[0].tahun === 2025, 'prestasi: data rusak dibuang, tahun menjadi angka');
  ok(susunGaleri([{ judul: 'A', tautan: 'https://x.test/a' }, { judul: 'B', tautan: 'bukan-url' }]).length === 1, 'galeri: tanpa tautan sah dibuang');
  ok(susunSosial([{ platform: 'instagram', tautan: 'https://www.instagram.com/p/AAAAA/' }, { platform: '', tautan: 'https://x.test' }]).length === 1, 'sosial: tanpa platform dibuang');
  ok(susunPrestasi(undefined).length === 0 && susunGaleri({}).length === 0 && susunSosial('x').length === 0, 'jawaban bukan larik: kosong, tanpa galat');
  const g = (n) => ({ judul: `Album ${n}`, tautan: `https://x.test/${n}`, sampulUrl: '', kelompok: 'lainnya' });
  const gab = gabungKartu('galeri', [g(3), g(2), g(1)], [g(1), g(0)]);
  ok(gab.map((x) => x.judul).join() === 'Album 3,Album 2,Album 1,Album 0', 'gabungan: kartu yang datang dua kali (penulisan baru menggeser urutan) hanya satu');
  ok(gabungKartu('sosial', [], [{ platform: 'instagram', tautan: 'a' }, { platform: 'youtube', tautan: 'a' }]).length === 2, 'kunci sosial memuat platform dan tautan');
  const mirip = { judul: 'Juara', tingkat: 'ranting', peringkat: '1', tahun: 2026, diraihOleh: 'Regu A' };
  ok(gabungKartu('prestasi', [mirip], [{ ...mirip, diraihOleh: 'Regu B' }]).length === 2, 'prestasi berjudul sama tetapi diraih regu berbeda tidak dianggap kembar');
  const l = susunKartuLagi('galeri', { galeri: Array.from({ length: 9 }, (_, i) => g(i)), adaLagi: true });
  ok(l.daftar.length === 6 && l.adaLagi === true, 'jawaban "lagi": dipotong 6 (tidak memercayai server sepenuhnya)');
  const rusak = susunKartuLagi('sosial', 'bukan objek');
  ok(rusak.daftar.length === 0 && rusak.adaLagi === false, 'jawaban "lagi" rusak: kosong dan tidak ada lagi');
  ok(susunKartuLagi('prestasi', { prestasi: [], adaLagi: 'ya' }).adaLagi === false, 'adaLagi hanya benar bila persis true');
  const awal = susunBerandaPublik({ galeri: Array.from({ length: 8 }, (_, i) => g(i)), sosial: Array.from({ length: 8 }, (_, i) => ({ platform: 'instagram', tautan: `https://www.instagram.com/p/K${i}AAAA/` })) });
  ok(awal.sosial.length === 6 && awal.galeri.length === 8, 'susunBerandaPublik: sosial tetap dipotong 6 (perilaku lama); galeri dari server apa adanya (server yang membatasi)');
}

console.log('\n--- Jalur data penuh terhadap SQL sungguhan (tanpa React) ---');
{
  const pg = new PGlite();
  await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
  await isiDataContoh(pg);
  await pg.query('update public.profiles set wajib_ganti_pin = false');
  const pembina = (await pg.query("select id from public.profiles where username = 'pembina'")).rows[0].id;
  const tulis = (sql) => sqlSebagai(pg, pembina, sql);
  for (let i = 1; i <= 14; i++) {
    await tulis(`select public.sg_prestasi_simpan(null, 'Prestasi ${i}', 'ranting', 'Juara ${i}', ${2010 + i}, 'Regu ${i}', '', 'terbit')`);
    await tulis(`select public.sg_galeri_simpan(null, 'Album ${i}', 'https://drive.google.com/drive/folders/a${i}', '', 'lainnya', 'terbit')`);
    await tulis(`select public.sg_sosial_simpan(null, 'instagram', 'https://www.instagram.com/p/KODE${String(i).padStart(3, '0')}/', 'Kiriman ${i}', '', true)`);
  }
  const panggil = async (nama, args = {}) => {
    try { return { ok: true, data: (await sqlSebagai(pg, null, args.p_lewati === undefined ? `select public.${nama}() as d` : `select public.${nama}(${Number(args.p_lewati)}) as d`)).rows[0].d }; } catch (e) { return { ok: false, pesan: e.message }; }
  };
  const awal = susunBerandaPublik((await panggil('sg_beranda_publik')).data);
  const JENIS = { prestasi: 'sg_prestasi_lagi', galeri: 'sg_galeri_lagi', sosial: 'sg_sosial_lagi' };
  for (const [jenis, fn] of Object.entries(JENIS)) {
    let daftar = awal[jenis], ada = daftar.length >= 6, tekan = 0;
    ok(daftar.length === 6, `${jenis}: beranda awal 6 kartu`);
    while (ada && tekan < 10) {
      const r = await panggil(fn, { p_lewati: daftar.length });
      const d = susunKartuLagi(jenis, r.data);
      daftar = gabungKartu(jenis, daftar, d.daftar);
      ada = d.adaLagi;
      tekan++;
    }
    const nama = (x) => x.judul ?? x.keterangan;
    ok(tekan === 2 && daftar.length === 14, `${jenis}: dua kali menekan tombol memuat semuanya (14 kartu, tekan ${tekan}x)`);
    ok(new Set(daftar.map(nama)).size === 14, `${jenis}: tanpa kembar`);
    const urut = daftar.map(nama);
    const diharapkan = Array.from({ length: 14 }, (_, i) => `${jenis === 'sosial' ? 'Kiriman' : jenis === 'galeri' ? 'Album' : 'Prestasi'} ${14 - i}`);
    ok(JSON.stringify(urut) === JSON.stringify(diharapkan), `${jenis}: urut dari yang terbaru ke yang terlama`);
  }
  const gagalPanggil = await panggil('fungsi_tidak_ada', { p_lewati: 6 });
  ok(!gagalPanggil.ok, 'pemanggilan yang gagal dikenali (tombol menampilkan pesan, bukan diam)');
}

console.log('\n--- Tombol di beranda ---');
{
  const kartuG = (n) => ({ judul: `Album ${n}`, tautan: `https://x.test/${n}`, sampulUrl: '', kelompok: 'lainnya' });
  const enam = Array.from({ length: 6 }, (_, i) => kartuG(i));
  const fungsi = () => {};
  const t0 = teks(h(Galeri, { galeri: enam }));
  ok(!t0.includes('Muat album lebih lama') && !t0.includes('Semua album sudah ditampilkan'), 'tanpa `lagi` (prarender): tidak ada tombol maupun pesan');
  const t1 = teks(h(Galeri, { galeri: enam, lagi: { ada: true, memuat: false, galat: false, muat: fungsi } }));
  ok(t1.includes('Muat album lebih lama') && !t1.includes('disabled=""'), 'Galeri: tombol "Muat album lebih lama" tampil dan aktif');
  ok(teks(h(Galeri, { galeri: enam, lagi: { ada: true, memuat: true, galat: false, muat: fungsi } })).includes('Memuat...'), 'Galeri: saat memuat tombol berubah "Memuat..." dan nonaktif');
  ok(teks(h(Galeri, { galeri: enam, lagi: { ada: true, memuat: false, galat: true, muat: fungsi } })).includes('Album lebih lama belum dapat dimuat'), 'Galeri: gagal memuat menampilkan pesan yang jelas');
  ok(teks(h(Galeri, { galeri: enam, lagi: { ada: false, memuat: false, galat: false, muat: fungsi } })).includes('Semua album sudah ditampilkan'), 'Galeri: habis dan 6 atau lebih tampil = "Semua album sudah ditampilkan"');
  ok(!teks(h(Galeri, { galeri: enam.slice(0, 3), lagi: { ada: false, memuat: false, galat: false, muat: fungsi } })).includes('Semua album sudah ditampilkan'), 'kurang dari 6 kartu: tidak ada keterangan "semua sudah ditampilkan"');
  ok(!teks(h(Galeri, { galeri: [], lagi: { ada: true, memuat: false, galat: false, muat: fungsi } })).includes('lebih lama'), 'belum ada album: tanpa tombol');
  const pres = Array.from({ length: 6 }, (_, i) => ({ judul: `P${i}`, tingkat: 'ranting', peringkat: 'Juara 1', tahun: 2026, diraihOleh: 'Regu' }));
  const tp = teks(h(Prestasi, { prestasi: pres, lagi: { ada: true, memuat: false, galat: false, muat: fungsi } }));
  ok(tp.includes('Muat prestasi lebih lama') && tp.includes('btn-gold'), 'Prestasi: tombol "Muat prestasi lebih lama" (emas di latar gelap)');
  const sos = Array.from({ length: 6 }, (_, i) => ({ platform: 'instagram', tautan: `https://www.instagram.com/p/K${i}AAAA/`, keterangan: '', gambarUrl: '' }));
  const ts = teks(h(MediaSosial, { sosial: sos, lagi: { ada: true, memuat: false, galat: false, muat: fungsi } }));
  ok(ts.includes('Muat kiriman lebih lama') && ts.includes('btn-gold'), 'Media Sosial: tombol "Muat kiriman lebih lama"');
  ok(teks(h(MediaSosial, { sosial: sos, lagi: { ada: false, memuat: false, galat: false, muat: fungsi } })).includes('Semua kiriman sudah ditampilkan'), 'Media Sosial: habis = "Semua kiriman sudah ditampilkan"');
  ok(teks(h(MediaSosial, { sosial: [] })) === '', 'media sosial kosong: bagian tetap tidak dirender');
}

console.log('\n--- Penyambungan (kode sumber) ---');
{
  const hook = readFileSync(`${P}/src/landing/useBerandaPublik.js`, 'utf8');
  ok(/sg_prestasi_lagi/.test(hook) && /sg_galeri_lagi/.test(hook) && /sg_sosial_lagi/.test(hook) && /p_lewati: daftar\.length/.test(hook), 'hook memanggil ketiga fungsi dengan p_lewati = jumlah kartu yang sudah tampil');
  const landing = readFileSync(`${P}/src/landing/Landing.jsx`, 'utf8');
  ok(/lagi=\{beranda\.lagi\.prestasi\}/.test(landing) && /lagi=\{beranda\.lagi\.galeri\}/.test(landing) && /lagi=\{beranda\.lagi\.sosial\}/.test(landing), 'Landing meneruskan `lagi` ke Prestasi, Galeri, dan Media Sosial');
  const agenda = landing.match(/<KabarAgenda[^>]*\/>/)?.[0] ?? '';
  ok(agenda && !/lagi/.test(agenda), 'Agenda sengaja tidak diubah (tanpa tombol lebih lama)');
}

console.log(`\nRINGKASAN MUAT-LEBIH-LAMA-KLIEN: ${lulus} lulus, ${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
