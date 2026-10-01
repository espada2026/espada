// Pramuka Siaga, Fase 3: latihan di hari apa pun (bukan hanya Jumat), iuran oleh Pembina, dan tabungan anak Siaga (tabel tabungan_cek). Server (PGlite, skema baru) + logika klien.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { siapkanPg, buatKlienFake } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';
import { ringkasLatihan, awalTingkat, TARGET_LATIHAN } from '../src/lib/latihanSiagaLogic.js';
import { ringkasTabungan, mingguSenin, TARGET_MINGGU } from '../src/lib/tabunganLogic.js';
import { geserHari } from '../src/lib/absensiLogic.js';

const P = process.cwd().replace(/\\/g, '/');
let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };

const pg = new PGlite();
await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
await isiDataContoh(pg);
await pg.query('update public.profiles set wajib_ganti_pin = false');
const q = async (sql, p = []) => (await pg.query(sql, p)).rows;
const masuk = async (nama, pin) => { const a = buatApi(buatKlienFake(pg)); const r = await a.masuk(nama, pin); return { a, id: r.id, ok: r.ok }; };
const pembina = await masuk('pembina', PIN_DEMO.pembina);
const admin = await masuk('admin', PIN_DEMO.admin);
const dewan = await masuk('dewan', PIN_DEMO.dewan);
const ahmad = await masuk('10231', PIN_DEMO.penegak);

// Anak Siaga: satu tanpa akun (dicatat Pembina), satu berakun (masuk sendiri).
let r = await pembina.a.tambahSiaga([{ nama: 'Anak Tanpa Akun', kelas: '4A', agama: 'Islam' }]);
ok(r.ok, 'Pembina menambah anak Siaga tanpa akun ' + (r.pesan ?? ''));
const tanpa = (await q(`select id from public.profiles where nama = 'Anak Tanpa Akun'`))[0].id;
r = await pembina.a.buatAkun('peserta', [{ no: 1, nama: 'Anak Berakun', nis: '5301', kelas: '5', agama: 'Islam' }]);
const berakun = r.hasil[0];
await pg.query('update public.profiles set wajib_ganti_pin = false');
const kid = await masuk('5301', berakun.pin);
const kid2 = await (async () => { const x = await pembina.a.buatAkun('peserta', [{ no: 1, nama: 'Anak Lain', nis: '5302', kelas: '5', agama: 'Islam' }]); await pg.query('update public.profiles set wajib_ganti_pin = false'); return { ...(await masuk('5302', x.hasil[0].pin)), idAnak: x.hasil[0].id }; })();

console.log('--- Latihan di hari apa pun ---');
{
  const sabtu = '2026-09-26', minggu = '2026-09-27';
  ok(new Date(`${sabtu}T00:00:00`).getDay() === 6 && new Date(`${minggu}T00:00:00`).getDay() === 0, 'tanggal uji = Sabtu dan Minggu');
  ok((await q(`select count(*)::int n from pg_constraint where conrelid = 'public.absensi_sesi'::regclass and contype = 'c'`))[0].n === 0, 'tabel absensi_sesi tanpa kendala hari');
  let x = await pembina.a.buatSesiAbsen(sabtu);
  ok(x.ok, 'Pembina membuat sesi latihan hari Sabtu ' + (x.pesan ?? ''));
  x = await pembina.a.buatSesiAbsen(minggu);
  ok(x.ok, 'dan hari Minggu');
  x = await pembina.a.buatSesiAbsen('2099-01-02');
  ok(!x.ok && /belum tiba/.test(x.pesan), 'tanggal yang belum tiba tetap ditolak: ' + x.pesan);
  x = await ahmad.a.buatSesiAbsen('2026-09-28');
  ok(!x.ok, 'Penegak tidak dapat membuat sesi');
  x = await pembina.a.setStatusAbsen(sabtu, tanpa, 'H');
  ok(x.ok, 'Pembina mencatat hadir anak Siaga tanpa akun pada hari Sabtu ' + (x.pesan ?? ''));
  x = await pembina.a.setStatusAbsen(sabtu, berakun.id, 'H');
  ok(x.ok, 'dan anak berakun');
}

console.log('\n--- Iuran: Pembina ikut mencatat (Siaga tidak punya Dewan Ambalan) ---');
{
  const sabtu = '2026-09-26';
  let x = await pembina.a.aturIuran(sabtu, tanpa, 1000);
  ok(x.ok, 'Pembina mencatat iuran anak Siaga ' + (x.pesan ?? ''));
  const lembar = await pembina.a.muatLembarIuran(sabtu);
  ok(lembar.ok && lembar.data.some((d) => d.id === tanpa && d.jumlah === 1000), 'lembar iuran Pembina memuat anak Siaga dengan iurannya');
  x = await pembina.a.simpanKas(sabtu, 1000, 'cocok');
  ok(x.ok, 'Pembina menutup kas ' + (x.pesan ?? ''));
  x = await admin.a.aturIuran(sabtu, tanpa, 2000);
  ok(!x.ok, 'Admin Gudep tetap tidak mencatat iuran (bukan pencatat)');
  x = await kid.a.aturIuran(sabtu, tanpa, 5000);
  ok(!x.ok, 'anak berakun tidak dapat mencatat iuran');
  x = await dewan.a.aturIuran(sabtu, tanpa, 1500);
  ok(x.ok, 'Dewan (Penegak) tetap dapat mencatat (perilaku lama utuh) ' + (x.pesan ?? ''));
}

console.log('\n--- Tabungan: hak dan aturan ---');
{
  const t1 = '2026-09-14', t2 = '2026-09-21';
  let x = await pembina.a.catatTabungan({ pesertaId: tanpa, tanggal: t1, jumlah: 5000, catatan: 'dari uang saku' });
  ok(x.ok, 'Pembina mencatat pemeriksaan tabungan anak tanpa akun ' + (x.pesan ?? ''));
  x = await pembina.a.catatTabungan({ pesertaId: tanpa, tanggal: t1, jumlah: 7000 });
  ok(x.ok && (await q('select jumlah, catatan from public.tabungan_cek where peserta_id = $1 and tanggal = $2', [tanpa, t1]))[0].jumlah === 7000, 'mencatat ulang tanggal yang sama = koreksi (jumlah 7000)');
  ok((await q('select count(*)::int n from public.tabungan_cek where peserta_id = $1', [tanpa]))[0].n === 1, 'tetap satu baris per anak per tanggal');
  x = await admin.a.catatTabungan({ pesertaId: berakun.id, tanggal: t2, jumlah: 3000 });
  ok(x.ok, 'Admin Gudep juga dapat mencatat ' + (x.pesan ?? ''));
  x = await kid.a.catatTabungan({ pesertaId: berakun.id, tanggal: t2, jumlah: 9000 });
  ok(!x.ok && /Hanya Pembina atau Admin/.test(x.pesan), 'anak tidak mencatat tabungannya sendiri: ' + x.pesan);
  x = await dewan.a.catatTabungan({ pesertaId: tanpa, tanggal: t2, jumlah: 1000 });
  ok(!x.ok && /Hanya Pembina atau Admin/.test(x.pesan), 'Dewan Ambalan tidak mencatat tabungan');
  x = await pembina.a.catatTabungan({ pesertaId: ahmad.id, tanggal: t1, jumlah: 1000 });
  ok(!x.ok && /hanya dicatat untuk anggota Siaga/.test(x.pesan), 'bukan anggota Siaga ditolak: ' + x.pesan);
  x = await pembina.a.catatTabungan({ pesertaId: pembina.id, tanggal: t1, jumlah: 1000 });
  ok(!x.ok && /Anggota tidak ditemukan/.test(x.pesan), 'bukan peserta ditolak');
  x = await pembina.a.catatTabungan({ pesertaId: tanpa, tanggal: '2099-01-01', jumlah: 1000 });
  ok(!x.ok && /antara 1 Januari 2015 dan hari ini/.test(x.pesan), 'tanggal depan ditolak');
  x = await pembina.a.catatTabungan({ pesertaId: tanpa, tanggal: '2014-12-31', jumlah: 1000 });
  ok(!x.ok, 'sebelum 2015 ditolak');
  for (const j of [0, -5, 100000001]) {
    x = await pembina.a.catatTabungan({ pesertaId: tanpa, tanggal: t1, jumlah: j });
    ok(!x.ok && /antara Rp 1 dan Rp 100.000.000/.test(x.pesan), `setoran ${j} ditolak`);
  }
  x = await pembina.a.catatTabungan({ pesertaId: tanpa, tanggal: t1, jumlah: 1000, catatan: 'x'.repeat(201) });
  ok(!x.ok && /maksimal 200/.test(x.pesan), 'catatan terlalu panjang ditolak');
  x = await pembina.a.catatTabungan({ pesertaId: tanpa, tanggal: null, jumlah: 1000 });
  ok(!x.ok && /Tanggal pemeriksaan wajib/.test(x.pesan), 'tanggal kosong ditolak');

  const baca = async (a, id) => (await a.a.muatTabungan(id)).data?.length ?? -1;
  ok(await baca(pembina, tanpa) === 1 && await baca(admin, berakun.id) === 1, 'Pembina dan Admin membaca tabungan');
  ok(await baca(kid, berakun.id) === 1, 'anak membaca tabungannya sendiri');
  ok(await baca(kid2, berakun.id) === 0, 'anak lain tidak membaca tabungan teman (RLS)');
  ok(await baca(dewan, tanpa) === 0 && await baca(ahmad, tanpa) === 0, 'Dewan dan Penegak tidak membaca tabungan anak Siaga');
  const langsung = await kid.a.catatTabungan.length; // sekadar memastikan fungsi ada
  void langsung;

  x = await pembina.a.hapusTabungan(tanpa, t1);
  ok(x.ok && (await q('select count(*)::int n from public.tabungan_cek where peserta_id = $1', [tanpa]))[0].n === 0, 'Pembina menghapus catatan');
  x = await kid.a.hapusTabungan(berakun.id, t2);
  ok(!x.ok && /Hanya Pembina atau Admin/.test(x.pesan), 'anak tidak menghapus catatan');

  // nonaktif: tidak dapat diubah (pemicu tolak_peserta_tak_aktif)
  await pg.query(`update public.profiles set status = 'nonaktif' where id = $1`, [tanpa]);
  x = await pembina.a.catatTabungan({ pesertaId: tanpa, tanggal: t1, jumlah: 1000 });
  ok(!x.ok && /nonaktif/.test(x.pesan), 'anak nonaktif tidak dapat dicatat: ' + x.pesan);
  await pg.query(`update public.profiles set status = 'aktif' where id = $1`, [tanpa]);

  // cadangan memuat tabel baru
  const cad = await admin.a.unduhCadangan();
  ok(cad.ok && Array.isArray(cad.data.tabel?.tabungan_cek ?? cad.data.tabungan_cek), 'cadangan Admin memuat tabungan_cek');
  // hapus bersama profil
  await pembina.a.catatTabungan({ pesertaId: tanpa, tanggal: t1, jumlah: 1000 });
  await pg.query('delete from public.profiles where id = $1', [tanpa]);
  ok((await q('select count(*)::int n from public.tabungan_cek where peserta_id = $1', [tanpa]))[0].n === 0, 'catatan ikut terhapus bersama profil anak');
}

console.log('\n--- Logika klien: ringkasan tabungan dan latihan ---');
{
  const hari = '2026-09-30'; // Rabu
  ok(mingguSenin('2026-09-30') === '2026-09-28' && mingguSenin('2026-09-28') === '2026-09-28' && mingguSenin('2026-10-04') === '2026-09-28' && mingguSenin('2026-10-05') === '2026-10-05', 'mingguSenin: Senin sampai Minggu satu minggu');
  ok(geserHari('2026-09-30', 7) === '2026-10-07' && geserHari('2026-03-01', -1) === '2026-02-28', 'geserHari lintas bulan');
  const b = (tanggal, jumlah = 1000) => ({ tanggal, jumlah });
  let s = ringkasTabungan([b('2026-09-02'), b('2026-09-09'), b('2026-09-16'), b('2026-09-23')], { hari });
  ok(s.minggu === 4 && s.beruntun === 4 && !s.terputus && s.total === 4000 && s.terakhir === '2026-09-23', 'empat minggu berturut-turut');
  s = ringkasTabungan([b('2026-08-05'), b('2026-08-12'), b('2026-09-02'), b('2026-09-09'), b('2026-09-16')], { hari });
  ok(s.minggu === 5 && s.beruntun === 3, 'ada celah: beruntun terhitung dari minggu terbaru (3 dari 5)');
  s = ringkasTabungan([b('2026-09-01'), b('2026-09-03')], { hari });
  ok(s.minggu === 1 && s.pemeriksaan === 2 && s.total === 2000, 'dua pemeriksaan dalam satu minggu = satu minggu menabung');
  s = ringkasTabungan([b('2026-08-05')], { hari });
  ok(s.terputus === true && s.beruntun === 1, 'pemeriksaan terakhir lebih dari seminggu lalu = terputus');
  s = ringkasTabungan([b('2026-09-21')], { hari });
  ok(s.terputus === false, 'minggu lalu masih dianggap berjalan');
  s = ringkasTabungan([b('2026-08-05'), b('2026-09-09')], { sejak: '2026-09-01', hari });
  ok(s.minggu === 1 && s.pemeriksaan === 1, 'sejak membatasi pemeriksaan');
  s = ringkasTabungan([], { hari });
  ok(s.minggu === 0 && s.beruntun === 0 && s.terakhir === null && !s.terputus, 'tanpa data');
  ok(TARGET_MINGGU.Mula === 6 && TARGET_MINGGU.Bantu === 8 && TARGET_MINGGU.Tata === 12 && TARGET_LATIHAN.Mula === 6 && TARGET_LATIHAN.Bantu === 8 && TARGET_LATIHAN.Tata === 12, 'target minggu dan latihan sesuai butir SK 119/2011');

  const absensi = { sesi: { '2026-09-05': {}, '2026-09-12': {}, '2026-09-19': {}, '2026-09-26': {}, '2026-10-10': {} }, hadir: {
    '2026-09-05': { a: { status: 'H' } }, '2026-09-12': { a: { status: 'H' } }, '2026-09-19': { a: { status: 'A' } }, '2026-09-26': { a: { status: 'H' } }, '2026-10-10': { a: { status: 'H' } },
  } };
  let l = ringkasLatihan(absensi, 'a', { hari });
  ok(l.sesi === 4 && l.tercatat === 4 && l.hadir === 3 && l.beruntun === 1, 'latihan: sesi sesudah hari ini tidak dihitung; Alpa memutus beruntun');
  l = ringkasLatihan(absensi, 'a', { sejak: '2026-09-15', hari });
  ok(l.sesi === 2 && l.hadir === 1, 'latihan sejak tanggal tertentu');
  l = ringkasLatihan(absensi, 'b', { hari });
  ok(l.sesi === 4 && l.tercatat === 0 && l.hadir === 0, 'anak yang belum dicatat: sesi ada, tercatat 0');
  l = ringkasLatihan({ sesi: {}, hadir: {} }, 'a', { hari });
  ok(l.sesi === 0 && l.hadir === 0, 'tanpa sesi');

  const prog = { 'MUL-01': { status: 'lulus', tanggalUji: '2026-05-01' }, 'MUL-02': { status: 'lulus', tanggalUji: '2026-06-10' }, 'MUL-03': { status: 'ulang', tanggalUji: '2026-07-01' }, 'BNU-01': { status: 'lulus', tanggalUji: '2026-08-20' }, 'BAN-01': { status: 'lulus', tanggalUji: '2026-09-01' } };
  ok(awalTingkat(prog, 'Mula') === null, 'awal Mula = null');
  ok(awalTingkat(prog, 'Bantu') === '2026-06-10', 'awal Bantu = tanggal uji terakhir butir Mula yang lulus (yang ulang dan butir Penegak diabaikan)');
  ok(awalTingkat(prog, 'Tata') === '2026-08-20', 'awal Tata = tanggal uji terakhir butir Bantu');
  ok(awalTingkat({}, 'Bantu') === null && awalTingkat(undefined, 'Tata') === null, 'tanpa progres = null');
}

console.log(`\nRINGKASAN LATIHAN-TABUNGAN: ${lulus} lulus, ${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
