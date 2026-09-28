// Sisi klien "terbit ulang halaman berita": ringkasan keadaan (terbitUlangLogic), api().statusTerbitUlang / mintaTerbitUlang terhadap SQL sungguhan, dan panel di Kelola Beranda
// (hanya Pembina dan Admin). Aturan kapan deploy diminta ada di server dan diuji di uji/terbit-ulang.mjs.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { siapkanPg, buatKlienFake } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';
import { ringkasTerbitUlang } from '../src/lib/terbitUlangLogic.js';

const P = process.cwd().replace(/\\/g, '/');
let g = 0, l = 0;
const ok = (c, m) => { if (c) { l++; console.log('ok   :', m); } else { g++; console.log('GAGAL:', m); } };

console.log('--- Ringkasan keadaan ---');
{
  const r0 = ringkasTerbitUlang(null);
  ok(r0.tingkat === 'belum' && !r0.bolehMinta, 'tanpa keadaan atau belum diatur: "belum dipasang", tombol tidak ditawarkan');
  ok(ringkasTerbitUlang({ diatur: false }).tingkat === 'belum', 'diatur false: belum dipasang');
  const baru = ringkasTerbitUlang({ diatur: true, perlu: false, kirimTerakhir: null, status: null, pesan: null, gagalBeruntun: 0, menyerah: false });
  ok(baru.tingkat === 'baru' && baru.bolehMinta, 'sudah diatur, belum pernah mengirim: "sudah dipasang"');
  const tunggu = ringkasTerbitUlang({ diatur: true, perlu: true, kirimTerakhir: '2026-09-28T03:00:00Z', status: 204, pesan: 'x', gagalBeruntun: 0, menyerah: false });
  ok(tunggu.tingkat === 'menunggu' && /Permintaan terakhir/.test(tunggu.rincian), 'ada perubahan yang menunggu diterbitkan: menunggu');
  const jawab = ringkasTerbitUlang({ diatur: true, perlu: false, kirimTerakhir: '2026-09-28T03:00:00Z', status: null, pesan: 'Menunggu jawaban GitHub', gagalBeruntun: 0, menyerah: false });
  ok(jawab.tingkat === 'menunggu', 'dikirim tetapi belum ada jawaban GitHub: menunggu');
  const sukses = ringkasTerbitUlang({ diatur: true, perlu: false, kirimTerakhir: '2026-09-28T03:00:00Z', status: 204, pesan: 'Deploy diminta ke GitHub.', gagalBeruntun: 0, menyerah: false });
  ok(sukses.tingkat === 'ok' && sukses.bolehMinta, 'sukses 204 dan tidak ada yang menunggu: mutakhir');
  const gagal = ringkasTerbitUlang({ diatur: true, perlu: true, kirimTerakhir: '2026-09-28T03:00:00Z', status: 401, pesan: 'Kunci ditolak.', gagalBeruntun: 1, menyerah: false });
  ok(gagal.tingkat === 'gagal' && gagal.rincian === 'Kunci ditolak.', 'gagal sekali: dicoba lagi otomatis, pesan server ditampilkan apa adanya');
  const nyerah = ringkasTerbitUlang({ diatur: true, perlu: true, kirimTerakhir: '2026-09-28T03:00:00Z', status: 404, pesan: 'Tidak cocok.', gagalBeruntun: 3, menyerah: true });
  ok(nyerah.tingkat === 'menyerah' && /pemilik proyek/.test(nyerah.rincian) && nyerah.bolehMinta, 'menyerah: menyuruh menghubungi pemilik, tombol tetap ada');
  ok(![r0, baru, tunggu, jawab, sukses, gagal, nyerah].some((r) => /github_pat|Bearer/.test(JSON.stringify(r))), 'ringkasan tidak memuat kunci');
}

console.log('\n--- api terhadap SQL sungguhan ---');
{
  const pg = new PGlite();
  await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
  await isiDataContoh(pg);
  await pg.query('update public.profiles set wajib_ganti_pin = false');
  const masuk = async (u) => { const a = buatApi(buatKlienFake(pg)); await a.masuk(u, PIN_DEMO[u] ?? PIN_DEMO.penegak); return a; };
  const pembina = await masuk('pembina'), dewan = await masuk('dewan'), penegak = await masuk('10231');

  let r = await pembina.statusTerbitUlang();
  ok(r.ok && r.data.diatur === false && ringkasTerbitUlang(r.data).tingkat === 'belum', 'Pembina: belum diatur pemilik -> ringkasan "belum dipasang"');
  r = await pembina.mintaTerbitUlang();
  ok(!r.ok && /belum diatur oleh pemilik proyek/.test(r.pesan), 'tombol tanpa pengaturan: pesan yang menuntun dari server');
  r = await dewan.statusTerbitUlang();
  ok(!r.ok && /Hanya Pembina dan Admin/.test(r.pesan), 'Dewan Ambalan: server menolak keadaan');
  r = await penegak.mintaTerbitUlang();
  ok(!r.ok && /Hanya Pembina dan Admin/.test(r.pesan), 'Penegak biasa: server menolak permintaan');
  await pg.exec(`select sigarda.terbit_ulang_atur('tribudi3267/sigarda', 'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz')`);
  r = await pembina.statusTerbitUlang();
  ok(r.ok && r.data.diatur === true && !/github_pat|tribudi3267/.test(JSON.stringify(r.data)), 'sesudah diatur: keadaan tanpa kunci dan repositori');
}

console.log('\n--- Panel di Kelola Beranda ---');
{
  const halaman = readFileSync(`${P}/src/pages/KelolaBeranda.jsx`, 'utf8');
  const panel = readFileSync(`${P}/src/components/PanelTerbitUlang.jsx`, 'utf8');
  ok(/\{bolehTerbit && <PanelTerbitUlang \/>\}/.test(halaman) && /tabAktif === 'berita'/.test(halaman), 'panel hanya tampil di tab Berita dan hanya untuk Pembina/Admin (bolehTerbit)');
  ok(/if \(galat\) return null/.test(panel), 'kegagalan memuat keadaan (mis. belum migrasi) tidak mengganggu daftar berita');
  ok(/statusTerbitUlang/.test(panel) && /mintaTerbitUlang/.test(panel), 'panel memakai dua panggilan api yang sama dengan uji ini');
}

console.log(`\nRINGKASAN TERBIT-ULANG-KLIEN: ${l} lulus, ${g} GAGAL`);
process.exit(g ? 1 : 0);
