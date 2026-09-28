// Prestasi, Galeri, dan Media Sosial di beranda berperilaku seperti Berita: sg_beranda_publik memberi 6 terbaru, sg_prestasi_lagi / sg_galeri_lagi / sg_sosial_lagi memberi
// 6 berikutnya per panggilan (tanpa login, hanya membaca). Yang dijaga: batas 6, urutan, sambungan tanpa celah dan tanpa kembar, adaLagi, batas p_lewati, hanya isi
// TERBIT/tampil, whitelist kolom, dan hak anon. Klien: uji/muat-lebih-lama-klien.mjs. Migrasi: uji/migrasi-muat-lebih-lama.mjs.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { siapkanPg, sqlSebagai } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';

const P = process.cwd().replace(/\\/g, '/');
let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };
const pg = new PGlite();
await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
await isiDataContoh(pg);
await pg.query('update public.profiles set wajib_ganti_pin = false');
const q = async (sql, p = []) => (await pg.query(sql, p)).rows;
const pembina = (await q("select id from public.profiles where username = 'pembina'"))[0].id;
const sebagai = async (id, sql, args = []) => { try { return { ok: true, rows: (await sqlSebagai(pg, id, sql, args)).rows }; } catch (e) { return { ok: false, pesan: e.message }; } };
const anon = async (sql) => (await sebagai(null, sql)).rows[0].d;
const N = 15;
const tahunIni = new Date().getFullYear();

for (let i = 1; i <= N; i++) {
  // Prestasi: tahun naik pelan-pelan; i=14 dan i=15 sama-sama tahun terbaru (uji urutan kedua = id terbaru).
  const tahun = i >= 14 ? tahunIni : tahunIni - (N - i);
  await sebagai(pembina, `select public.sg_prestasi_simpan(null, 'Prestasi ${i}', 'ranting', 'Juara ${i}', ${tahun}, 'Regu ${i}', '', 'terbit')`);
  await sebagai(pembina, `select public.sg_galeri_simpan(null, 'Album ${i}', 'https://drive.google.com/drive/folders/a${i}', '', 'lainnya', 'terbit')`);
  await sebagai(pembina, `select public.sg_sosial_simpan(null, 'instagram', 'https://www.instagram.com/p/KODE${String(i).padStart(3, '0')}/', 'Kiriman ${i}', '', true)`);
}
// Yang TIDAK boleh ikut: draf, menunggu, dan media sosial yang disembunyikan.
await sebagai(pembina, `select public.sg_prestasi_simpan(null, 'Prestasi draf', 'ranting', 'Juara', ${tahunIni}, 'Regu', '', 'draf')`);
await sebagai(pembina, "select public.sg_galeri_simpan(null, 'Album draf', 'https://drive.google.com/drive/folders/draf', '', 'lainnya', 'draf')");
await sebagai(pembina, "select public.sg_sosial_simpan(null, 'instagram', 'https://www.instagram.com/p/DISEMBUNYI1/', 'Disembunyikan', '', false)");

const judul = (larik, kunci = 'judul') => larik.map((x) => x[kunci]);

console.log('--- sg_beranda_publik: 6 terbaru ---');
const pub = await anon('select public.sg_beranda_publik() as d');
{
  ok(pub.prestasi.length === 6 && pub.galeri.length === 6 && pub.sosial.length === 6, `prestasi, galeri, dan media sosial masing-masing 6 (dari ${N} yang terbit): ${pub.prestasi.length}/${pub.galeri.length}/${pub.sosial.length}`);
  ok(judul(pub.galeri).join() === 'Album 15,Album 14,Album 13,Album 12,Album 11,Album 10', 'galeri: yang terbaru dibuat di atas');
  ok(pub.sosial.map((s) => s.keterangan).join() === 'Kiriman 15,Kiriman 14,Kiriman 13,Kiriman 12,Kiriman 11,Kiriman 10', 'media sosial: yang terbaru dibuat di atas, yang disembunyikan tidak ikut');
  ok(pub.prestasi.map((p) => p.tahun).every((t, i, a) => i === 0 || a[i - 1] >= t), 'prestasi: tahun terbaru di atas');
  ok(judul(pub.prestasi).slice(0, 2).join() === 'Prestasi 15,Prestasi 14', 'prestasi: pada tahun yang sama, yang dicatat lebih akhir di atas');
  ok(!JSON.stringify(pub).includes('draf') && !JSON.stringify(pub).includes('Disembunyikan'), 'draf dan kiriman tersembunyi tidak pernah keluar');
  ok(Object.keys(pub.prestasi[0]).sort().join() === 'diraihOleh,fotoUrl,judul,peringkat,tahun,tingkat' && Object.keys(pub.galeri[0]).sort().join() === 'judul,kelompok,sampulUrl,tautan' && Object.keys(pub.sosial[0]).sort().join() === 'gambarUrl,keterangan,platform,tautan', 'kolom persis whitelist lama (tanpa id, penulis, atau catatan)');
  ok(Array.isArray(pub.agenda) && pub.agenda.length <= 6 && Array.isArray(pub.berita) && pub.berita.length <= 6 && Array.isArray(pub.faq), 'agenda, berita, dan faq tetap ada dan tidak berubah bentuk');
}

console.log('\n--- Fungsi "lebih lama": sambungan tanpa celah dan tanpa kembar ---');
const JENIS = [
  ['prestasi', 'sg_prestasi_lagi', (x) => `${x.judul}`],
  ['galeri', 'sg_galeri_lagi', (x) => `${x.judul}`],
  ['sosial', 'sg_sosial_lagi', (x) => `${x.keterangan}`],
];
for (const [kunci, fn, nama] of JENIS) {
  const l1 = await anon(`select public.${fn}(6) as d`);
  const l2 = await anon(`select public.${fn}(12) as d`);
  ok(l1[kunci].length === 6 && l1.adaLagi === true, `${kunci}: sesudah 6 yang tampil, 6 berikutnya dan adaLagi = true`);
  ok(l2[kunci].length === 3 && l2.adaLagi === false, `${kunci}: sesudah 12, tersisa 3 dan adaLagi = false`);
  const semua = [...pub[kunci], ...l1[kunci], ...l2[kunci]].map(nama);
  ok(semua.length === N && new Set(semua).size === N, `${kunci}: 6 + 6 + 3 = ${N} kartu berbeda, tanpa celah dan tanpa kembar`);
  const kosong = await anon(`select public.${fn}(15) as d`);
  ok(kosong[kunci].length === 0 && kosong.adaLagi === false, `${kunci}: sesudah semuanya, kosong dan adaLagi = false`);
  const tepat = await anon(`select public.${fn}(9) as d`);
  ok(tepat[kunci].length === 6 && tepat.adaLagi === false, `${kunci}: tepat 6 tersisa, adaLagi = false (bukan "ada lagi" palsu)`);
  ok(Object.keys(l1).sort().join() === `adaLagi,${kunci}`, `${kunci}: jawaban hanya berisi ${kunci} dan adaLagi`);
}
{
  const a = await anon('select public.sg_galeri_lagi(-5) as d');
  const b = await anon('select public.sg_galeri_lagi(null) as d');
  ok(judul(a.galeri).join() === judul(pub.galeri).join() && judul(b.galeri).join() === judul(pub.galeri).join(), 'p_lewati negatif atau null = mulai dari yang terbaru');
  const c = await anon('select public.sg_sosial_lagi(5000) as d');
  ok(c.sosial.length === 0 && c.adaLagi === false, 'p_lewati dibatasi 1000: angka besar tidak memindai tanpa batas');
}

console.log('\n--- Hak akses ---');
{
  const hak = await q(`select routine_name, grantee from information_schema.role_routine_grants where routine_schema = 'public' and routine_name in ('sg_prestasi_lagi', 'sg_galeri_lagi', 'sg_sosial_lagi') and grantee in ('anon', 'authenticated') order by 1, 2`);
  ok(hak.length === 6, 'anon dan authenticated boleh menjalankan ketiga fungsi (hanya membaca): ' + hak.length);
  const pub2 = (await sebagai(pembina, 'select public.sg_galeri_lagi(6) as d'));
  ok(pub2.ok && pub2.rows[0].d.galeri.length === 6, 'pengguna yang sudah masuk juga dapat memanggilnya');
}

console.log(`\nRINGKASAN MUAT-LEBIH-LAMA: ${lulus} lulus, ${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
