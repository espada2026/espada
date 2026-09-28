// Sampul otomatis album Google Photos: fungsi server `galeri-sampul` (logika murni, keamanan pengalihan, hak pengurus dibandingkan langsung dengan SQL),
// cermin klien (albumGooglePhotos, perluAmbilSampul), pemanggil api().ambilSampulAlbum, dan penyambungan di formulir Galeri.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { siapkanPg, sqlSebagai } from '../src/lokal/klienFake.js';
import { isiDataContoh, isiStatusContoh } from '../src/lokal/seedLokal.js';
import { albumGooglePhotos as albumKlien, perluAmbilSampul } from '../src/lib/galeriSampulLogic.js';
import { albumGooglePhotos, ambilAlbum, ambilMeta, bersihkanJudul, dasarSampul, pengurusAktif, tangani } from '../supabase/functions/galeri-sampul/index.ts';
import { SKEMA_GALERI, SKEMA_BERITA } from '../src/lib/berandaKontenSkema.js';
import { buatApi } from '../src/lib/api.js';

let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };
const P = process.cwd().replace(/\\/g, '/');

const DASAR = 'https://lh3.googleusercontent.com/pw/AP1GczN2PyLjk0B3ca_xuaYIAyE8CwRtIolT3P9mDv3teeE4She8xB9VExFqsZQlS2ICb4qtM-oZg7_WZmtE1fxWln3p5eq1A-qhzn1X4ft4H49ONdc4EQ4';
const HTML = (og = `${DASAR}=w600-h315-p-k`, judul = 'Pengujian Garuda oleh Kwarran Bukateja · Thursday, Sep 24 📸') =>
  `<!doctype html><html><head><title>x</title><meta property="og:title" content="${judul}"><meta property="og:type" content="website"><meta property="og:image" content="${og}"><meta property="og:image:width" content="600"></head><body></body></html>`;
const ALBUM = 'https://photos.app.goo.gl/vUNtVxWaQdzCocGZ8';
const SHARE = 'https://photos.google.com/share/AF1QipO-abc?key=xyz';

console.log('--- Cermin klien dan server: tautan album ---');
{
  const kisi = [ALBUM, SHARE, ` ${ALBUM} `, 'https://photos.app.goo.gl/', 'http://photos.app.goo.gl/abc', 'https://PHOTOS.GOOGLE.COM/share/x', 'https://photos.google.com.evil.com/x', 'https://evil.com/photos.google.com',
    'https://drive.google.com/drive/folders/abc', 'https://goo.gl/photos/abc', 'javascript:alert(1)', '', null, undefined, 42, 'photos.app.goo.gl/abc', 'https://user@photos.google.com/x', 'https://photos.google.com:8443/x'];
  const beda = kisi.filter((k) => albumKlien(k) !== albumGooglePhotos(k));
  ok(beda.length === 0, `klien dan fungsi server sepakat pada ${kisi.length} tautan${beda.length ? ' (beda: ' + JSON.stringify(beda) + ')' : ''}`);
  ok(albumKlien(ALBUM) && albumKlien(SHARE) && albumKlien('https://PHOTOS.GOOGLE.COM/share/x') && !albumKlien('http://photos.app.goo.gl/abc') && !albumKlien('https://photos.google.com.evil.com/x') && !albumKlien('https://drive.google.com/drive/folders/abc'), 'hanya https dan host photos.app.goo.gl / photos.google.com yang sah (bukan mirip-mirip)');
  ok(perluAmbilSampul({ tautan: ALBUM, sampulUrl: '' }) && perluAmbilSampul({ tautan: ALBUM, sampulUrl: '   ' }), 'album Google Photos tanpa sampul: perlu diambil');
  ok(!perluAmbilSampul({ tautan: ALBUM, sampulUrl: 'https://x.id/a.jpg' }) && !perluAmbilSampul({ tautan: 'https://drive.google.com/drive/folders/abc', sampulUrl: '' }) && !perluAmbilSampul({ tautan: '', sampulUrl: '' }), 'sampul sudah diisi (manual menang), bukan album Google Photos, atau tautan kosong: tidak diambil');
  ok(!perluAmbilSampul({ tautan: ALBUM, sampulUrl: '' }, ALBUM) && !perluAmbilSampul({ tautan: ` ${ALBUM}`, sampulUrl: '' }, ALBUM) && perluAmbilSampul({ tautan: SHARE, sampulUrl: '' }, ALBUM), 'tautan yang sudah dicoba tidak diminta ulang; tautan lain diminta');
}

console.log('\n--- Fungsi server: membaca halaman ---');
{
  ok(ambilMeta(HTML(), 'og:image') === `${DASAR}=w600-h315-p-k` && ambilMeta(HTML(), 'og:title').startsWith('Pengujian Garuda'), 'og:image dan og:title terbaca');
  ok(ambilMeta(`<meta content="${DASAR}" property="og:image">`, 'og:image') === DASAR && ambilMeta(`<meta property='og:image' content='${DASAR}'>`, 'og:image') === DASAR, 'urutan atribut bebas, kutip tunggal juga terbaca');
  ok(ambilMeta('<meta property="og:title" content="A &amp; B &quot;C&quot; &#39;D&#39;">', 'og:title') === 'A & B "C" \'D\'' && ambilMeta('<html></html>', 'og:image') === '' && ambilMeta(null, 'og:image') === '', 'entitas HTML dibuka; tidak ada = kosong');
  ok(ambilMeta('<meta property="og:image:width" content="600">', 'og:image') === '', 'og:image:width tidak dianggap og:image');
  ok(dasarSampul(`${DASAR}=w600-h315-p-k`) === DASAR && dasarSampul(DASAR) === DASAR && dasarSampul(`${DASAR}=s1000`) === DASAR, 'akhiran ukuran dibuang, alamat dasar dipertahankan');
  const jahat = ['https://evil.com/pw/AP1GczN2PyLjk0B3ca_xuaYIAyE8', 'http://lh3.googleusercontent.com/pw/AP1GczN2PyLjk0B3ca_xuaYIAyE8', 'https://lh3.googleusercontent.com.evil.com/pw/AP1GczN2PyLjk0B3ca_xuaYIAyE8',
    'https://lh3.googleusercontent.com/pendek', 'https://lh3.googleusercontent.com/pw/AP1GczN2PyLjk0B3ca?x=<script>', 'https://lh3.googleusercontent.com/pw/AP1Gcz N2PyLjk0B3ca_xuaYIAyE8', 'javascript:alert(1)', '', null, 'https://drive.google.com/thumbnail?id=AAAAAAAAAAAAAAAAAAAAAAAA'];
  ok(jahat.every((u) => dasarSampul(u) === ''), 'alamat gambar dari host lain, tanpa https, terlalu pendek, atau bermuatan skrip ditolak');
  ok(bersihkanJudul('Pengujian Garuda oleh Kwarran Bukateja · Thursday, Sep 24 📸') === 'Pengujian Garuda oleh Kwarran Bukateja' && bersihkanJudul('Perkemahan Jumat Agung · Kamis, 24 Sep') === 'Perkemahan Jumat Agung', 'penanggalan otomatis Google (Inggris atau Indonesia) dibuang dari nama album');
  ok(bersihkanJudul('Latihan Perdana') === 'Latihan Perdana' && bersihkanJudul('Album 2026 seru') === 'Album 2026 seru' && bersihkanJudul('A · B · Kamis, 24 Sep') === 'A · B' && bersihkanJudul(null) === '', 'nama tanpa penanggalan (walau berangka) tidak berubah; hanya segmen terakhir bertanda " · " berangka yang dibuang');
  ok([...bersihkanJudul('x'.repeat(300))].length === 100, 'nama paling panjang 100 karakter (batas kolom judul galeri)');
}

console.log('\n--- Fungsi server: pengalihan dan batas keamanan ---');
{
  const catat = (peta) => { const dipanggil = []; const ambil = async (u) => { dipanggil.push(u); const r = peta(u); if (r instanceof Error) throw r; return r; }; ambil.dipanggil = dipanggil; return ambil; };
  const alih = (ke, kode = 302) => new Response(null, { status: kode, headers: { location: ke } });
  const halaman = (html = HTML()) => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });

  let f = catat((u) => (u === ALBUM ? alih(SHARE) : halaman()));
  let r = await ambilAlbum(ALBUM, f);
  ok(r.sampul === `${DASAR}=w800-h600-p-k-no` && r.judul === 'Pengujian Garuda oleh Kwarran Bukateja' && f.dipanggil.join() === `${ALBUM},${SHARE}`, 'tautan pendek dialihkan ke halaman berbagi, sampul dan nama terbaca (ukuran kartu 800x600)');
  f = catat((u) => (u === ALBUM ? alih('/share/AF1Qip-rel?key=1') : halaman()));
  r = await ambilAlbum(ALBUM, f);
  ok(!!r.sampul && f.dipanggil[1] === 'https://photos.app.goo.gl/share/AF1Qip-rel?key=1', 'alamat pengalihan relatif dipulihkan terhadap alamat sebelumnya');
  f = catat((u) => (u === ALBUM ? alih('http://127.0.0.1:8080/rahasia') : halaman()));
  r = await ambilAlbum(ALBUM, f);
  ok(!!r.galat && f.dipanggil.length === 1, 'pengalihan ke alamat internal DITOLAK sebelum diminta (hanya satu permintaan keluar)');
  f = catat((u) => (u === ALBUM ? alih('https://evil.com/x') : halaman()));
  r = await ambilAlbum(ALBUM, f);
  ok(!!r.galat && !f.dipanggil.some((u) => /evil/.test(u)), 'pengalihan ke situs lain tidak pernah diikuti');
  f = catat((u) => (u === ALBUM ? alih(SHARE) : u === SHARE ? alih('https://photos.google.com/lagi') : halaman()));
  ok(!!(await ambilAlbum(ALBUM, f)).sampul, 'beberapa pengalihan berturut-turut di dalam Google Photos masih diikuti');
  f = catat((u) => alih(`${u}x`));
  r = await ambilAlbum(ALBUM, f);
  ok(/Terlalu banyak pengalihan/.test(r.galat) && f.dipanggil.length === 6, 'pengalihan tanpa akhir dihentikan (paling banyak 5 pengalihan)');
  f = catat(() => new Response(null, { status: 302 }));
  ok(/tidak lengkap/.test((await ambilAlbum(ALBUM, f)).galat), 'pengalihan tanpa alamat tujuan ditolak');
  f = catat(() => new Response('tidak ada', { status: 404 }));
  ok(/404/.test((await ambilAlbum(ALBUM, f)).galat), 'album tidak ada (404): pesan menyebut kode dan menuntun');
  f = catat(() => new Error('jaringan putus'));
  ok(/tidak dapat dihubungi/.test((await ambilAlbum(ALBUM, f)).galat), 'jaringan putus: pesan yang jelas, tanpa melempar galat');
  f = catat(() => halaman('<html><head><title>Tanpa sampul</title></head></html>'));
  ok(/Sampul album tidak ditemukan/.test((await ambilAlbum(ALBUM, f)).galat), 'halaman tanpa og:image (mis. album pribadi): pesan yang menuntun');
  f = catat(() => halaman(HTML('https://evil.com/pw/AP1GczN2PyLjk0B3ca_xuaYIAyE8CwRtIolT3P9mDv3teeE4She8xB9VExFqsZQlS2ICb4qtM')));
  ok(/Sampul album tidak ditemukan/.test((await ambilAlbum(ALBUM, f)).galat), 'og:image dari host selain googleusercontent.com tidak dikembalikan');
  f = catat(() => halaman(`${'a'.repeat(3_100_000)}${HTML()}`));
  ok(/Sampul album tidak ditemukan/.test((await ambilAlbum(ALBUM, f)).galat), 'halaman lebih dari 3 MB dibaca hanya sampai batasnya (tidak dimuat utuh)');
}

console.log('\n--- Fungsi server: tangani (hak dan masukan) ---');
{
  const profil = { role: 'penguji', jabatan_dewan: null, status: 'aktif', wajib_ganti_pin: false };
  const buat = (p = profil) => { const d = { dipanggil: 0, profilDari: async (t) => (t === 'sah' ? p : null), ambil: async () => { d.dipanggil += 1; return new Response(HTML(), { status: 200 }); } }; return d; };
  let d = buat();
  ok((await tangani('GET', 'Bearer sah', { tautan: ALBUM }, d)).pesan === 'Gunakan POST.' && d.dipanggil === 0, 'selain POST ditolak');
  ok((await tangani('POST', null, { tautan: ALBUM }, d)).sesiBerakhir === true && (await tangani('POST', 'Bearer palsu', { tautan: ALBUM }, d)).sesiBerakhir === true && d.dipanggil === 0, 'tanpa sesi atau sesi tidak sah: ditolak sebelum menghubungi Google');
  d = buat({ role: 'peserta', jabatan_dewan: null, status: 'aktif', wajib_ganti_pin: false });
  ok(/Hanya pengurus/.test((await tangani('POST', 'Bearer sah', { tautan: ALBUM }, d)).pesan) && d.dipanggil === 0, 'Penegak biasa ditolak sebelum menghubungi Google');
  d = buat();
  ok(/Hanya tautan album Google Photos/.test((await tangani('POST', 'Bearer sah', { tautan: 'https://evil.com/x' }, d)).pesan) && /Hanya tautan album/.test((await tangani('POST', 'Bearer sah', {}, d)).pesan) && /Hanya tautan album/.test((await tangani('POST', 'Bearer sah', { tautan: ['x'] }, d)).pesan) && d.dipanggil === 0, 'tautan selain album Google Photos, kosong, atau bukan teks ditolak tanpa menghubungi apa pun');
  const b = await tangani('POST', 'Bearer sah', { tautan: ` ${ALBUM} ` }, d);
  ok(b.ok === true && b.sampul === `${DASAR}=w800-h600-p-k-no` && b.judul === 'Pengujian Garuda oleh Kwarran Bukateja' && Object.keys(b).sort().join() === 'judul,ok,sampul', 'pengurus dilayani: hanya ok, sampul, dan judul yang dikembalikan');
  d.ambil = async () => new Response('x', { status: 500 });
  ok((await tangani('POST', 'Bearer sah', { tautan: ALBUM }, d)).ok === false, 'galat dari Google diteruskan sebagai ok:false dengan pesan');
}

console.log('\n--- Hak pengurus fungsi server = sigarda.pengurus() di SQL ---');
{
  const pg = new PGlite();
  await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
  await isiDataContoh(pg);
  await isiStatusContoh(pg);
  const bandingkan = async () => {
    const baris = (await pg.query('select id, role, jabatan, jabatan_dewan, status, wajib_ganti_pin from public.profiles')).rows;
    const beda = [];
    for (const p of baris) {
      const sql = (await sqlSebagai(pg, p.id, 'select sigarda.pengurus() as b')).rows[0].b;
      if (sql !== pengurusAktif(p)) beda.push({ role: p.role, jabatan_dewan: p.jabatan_dewan, status: p.status, wajib: p.wajib_ganti_pin, sql, fungsi: pengurusAktif(p) });
    }
    return { jumlah: baris.length, beda };
  };
  await pg.query('update public.profiles set wajib_ganti_pin = false');
  let h = await bandingkan();
  ok(h.beda.length === 0 && h.jumlah > 5, `akun contoh (${h.jumlah}): fungsi dan SQL sepakat ${h.beda.length ? JSON.stringify(h.beda) : ''}`);
  await pg.query(`update public.profiles set wajib_ganti_pin = true where role = 'admin'`);
  await pg.query(`update public.profiles set status = 'nonaktif' where role = 'penguji' and jabatan = 'Pembina'`);
  await pg.query(`update public.profiles set jabatan_dewan = 'Bendahara' where role = 'peserta' and jabatan_dewan is null and nis = (select min(nis) from public.profiles where role = 'peserta' and jabatan_dewan is null)`);
  h = await bandingkan();
  ok(h.beda.length === 0, `sesudah wajib ganti PIN, nonaktif, dan jabatan Dewan baru: tetap sepakat ${h.beda.length ? JSON.stringify(h.beda) : ''}`);
  await pg.query(`update public.profiles set status = 'alumni' where role = 'peserta' and jabatan_dewan is not null`);
  h = await bandingkan();
  ok(h.beda.length === 0, 'Penegak berjabatan yang sudah alumni: bukan pengurus, sepakat dengan SQL');
  ok(!pengurusAktif(null) && !pengurusAktif(undefined) && pengurusAktif({ role: 'admin' }) && !pengurusAktif({ role: 'peserta' }), 'profil kosong bukan pengurus; status kosong dianggap aktif');
}

console.log('\n--- api().ambilSampulAlbum dan formulir Galeri ---');
{
  const klien = (jawab) => { const k = { functions: { invoke: async (nama, opsi) => { k.dipanggil = { nama, opsi }; return jawab; } } }; return k; };
  const a = buatApi(klien({ data: { ok: true, sampul: `${DASAR}=w800-h600-p-k-no`, judul: 'Album' }, error: null }));
  const r = await a.ambilSampulAlbum(ALBUM);
  ok(r.ok && r.sampul.endsWith('=w800-h600-p-k-no') && r.judul === 'Album', 'jawaban sukses diteruskan');
  const k2 = klien({ data: { ok: true, sampul: DASAR, judul: 'A' }, error: null });
  await buatApi(k2).ambilSampulAlbum(ALBUM);
  ok(k2.dipanggil.nama === 'galeri-sampul' && k2.dipanggil.opsi.body.tautan === ALBUM, 'memanggil fungsi bernama galeri-sampul dengan tautan');
  const gagalFungsi = await buatApi(klien({ data: { ok: false, pesan: 'Sampul album tidak ditemukan.', sesiBerakhir: false }, error: null })).ambilSampulAlbum(ALBUM);
  ok(!gagalFungsi.ok && gagalFungsi.pesan === 'Sampul album tidak ditemukan.', 'pesan galat fungsi diteruskan apa adanya');
  const belumPasang = await buatApi(klien({ data: null, error: { context: { status: 404 } } })).ambilSampulAlbum(ALBUM);
  ok(!belumPasang.ok && /belum dipasang/.test(belumPasang.pesan) && /diisi manual/.test(belumPasang.pesan), 'fungsi belum di-deploy (404): pesan menuntun dan menyebut isian manual');
  const putus = await buatApi({ functions: { invoke: async () => { throw new Error('jaringan'); } } }).ambilSampulAlbum(ALBUM);
  ok(!putus.ok && typeof putus.pesan === 'string', 'galat jaringan tidak dilempar keluar');
  const sesi = await buatApi(klien({ data: { ok: false, pesan: 'Sesi berakhir. Masuk kembali.', sesiBerakhir: true }, error: null })).ambilSampulAlbum(ALBUM);
  ok(sesi.sesiBerakhir === true, 'penanda sesi berakhir diteruskan');

  const f = SKEMA_GALERI.fields.find((x) => x.kunci === 'sampulUrl');
  ok(f.dariAlbum === 'tautan' && /otomatis/.test(f.bantuan) && !/tidak dapat dipakai sebagai gambar/.test(f.bantuan), 'kolom sampul galeri menyebut pengambilan otomatis dari album (petunjuk lama "tidak dapat dipakai" dicabut)');
  ok(SKEMA_BERITA.fields.every((x) => !x.dariAlbum), 'hanya Galeri yang memakai pengambilan sampul dari album');
  const panel = readFileSync(`${P}/src/components/PanelKontenTinjau.jsx`, 'utf8');
  ok(/perluAmbilSampul\(form, sudahDicoba\.current\)/.test(panel) && /setTimeout\(\(\) => ambilSampul\(form\[kunciAlbum\]\), 800\)/.test(panel) && /Ambil ulang sampul dari album/.test(panel), 'formulir mengambil sampul otomatis (ditunda 800 ms, sekali per tautan) dan punya tombol ambil ulang');
  ok(/String\(f\.tautan\)\.trim\(\) !== t \? f :/.test(panel) && /String\(f\.judul\)\.trim\(\) \? f\.judul : r\.judul/.test(panel), 'hasil untuk tautan yang sudah diganti dibuang; nama album hanya mengisi judul yang masih kosong');
}

console.log('\n--- Penyambungan lain ---');
{
  const fake = readFileSync(`${P}/src/lokal/klienFake.js`, 'utf8');
  ok(/nama === 'galeri-sampul'/.test(fake), 'mode lokal: fungsi galeri-sampul dijawab "tidak tersedia", tidak dikirim ke fungsi sigarda');
  const vite = readFileSync(`${P}/vite.config.js`, 'utf8');
  ok(/process\.env\.GITHUB_SHA \? process\.env\.GITHUB_SHA\.slice\(0, 12\) : Date\.now\(\)/.test(vite), 'ID versi di GitHub hanya bergantung pada commit (terbit ulang harian tidak memunculkan ajakan "Muat ulang")');
  const fungsi = readFileSync(`${P}/supabase/functions/galeri-sampul/index.ts`, 'utf8');
  ok(/redirect: 'manual'/.test(fungsi) && /AbortSignal\.timeout/.test(fungsi) && !/\.insert\(|\.update\(|\.delete\(|\.upsert\(/.test(fungsi), 'fungsi: pengalihan manual, batas waktu, dan tidak menulis apa pun ke basis data');
}

console.log(`\nRINGKASAN GALERI-SAMPUL: ${lulus} lulus, ${gagal} GAGAL.`);
if (gagal) process.exit(1);
