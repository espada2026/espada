// Pramuka Siaga, Fase 8: jenis Agenda kegiatan Siaga, saran butir Siaga Garuda dari kegiatan yang diikuti, dan pengingat untuk anak tanpa akun.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { siapkanPg, buatKlienFake } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';
import '../src/data/skuSiaga.js';
import { JENIS_AGENDA, JENIS_SIAGA, jenisSiaga, kegiatanDiikuti, labelJenisAgenda } from '../src/lib/agendaLogic.js';
import { hitungSiagaGaruda } from '../src/lib/siagaGarudaLogic.js';
import { teksWaSiap } from '../src/lib/eskalasiLogic.js';

const P = process.cwd().replace(/\\/g, '/');
let g = 0, l = 0;
const ok = (c, m) => { if (c) { l++; console.log('ok   :', m); } else { g++; console.log('GAGAL:', m); } };

console.log('--- Klien: jenis dan kegiatan diikuti (murni) ---');
{
  ok(JENIS_SIAGA.length === 4 && JENIS_SIAGA.every((j) => JENIS_AGENDA.some((x) => x.id === j)), 'empat jenis Siaga terdaftar di JENIS_AGENDA');
  ok(jenisSiaga('persari') && jenisSiaga('pesta_siaga') && !jenisSiaga('perkemahan') && !jenisSiaga('lainnya'), 'jenisSiaga hanya empat jenis itu');
  ok(/Persari/.test(labelJenisAgenda('persari')) && /Pesta Siaga/.test(labelJenisAgenda('pesta_siaga')), 'label jenis tampil');
  const ag = [
    { id: 1, jenis: 'persari', judul: 'Persari A', tanggal: '2026-08-01', pesertaTerkait: ['a', 'b'] },
    { id: 2, jenis: 'persari', judul: 'Persari B', tanggal: '2026-10-20', pesertaTerkait: ['a'] },
    { id: 3, jenis: 'pertemuan_siaga', judul: 'Pertemuan', tanggal: '2026-09-01', pesertaTerkait: ['b'] },
  ];
  ok(kegiatanDiikuti(ag, 'a', 'persari', '2026-10-01').length === 1 && kegiatanDiikuti(ag, 'a', 'persari', '2026-10-01')[0].id === 1, 'kegiatan yang BELUM berlangsung tidak dihitung');
  ok(kegiatanDiikuti(ag, 'a', 'persari', '2026-10-20').length === 2 && kegiatanDiikuti(ag, 'a', 'persari', '2026-10-20')[0].id === 2, 'hari-H dihitung; terbaru lebih dulu');
  ok(kegiatanDiikuti(ag, 'c', 'persari', '2026-10-20').length === 0 && kegiatanDiikuti(ag, 'a', 'pertemuan_siaga', '2026-10-20').length === 0, 'anak yang tidak ditandai atau jenis lain: kosong');
  ok(kegiatanDiikuti(undefined, 'a', 'persari').length === 0, 'tanpa agenda: kosong');

  const anak = { id: 'a', role: 'peserta', kelas: '4', agama: 'Islam' };
  const hitung = (agenda) => hitungSiagaGaruda({ peserta: anak, progress: {}, pelantikan: [], tkk: [], agenda, penetapan: [], hari: '2026-10-01' });
  let b = hitung(ag);
  ok(b[3].jenis === 'otomatis' && b[3].status === 'belum' && /Belum ada kegiatan/.test(b[3].saran.teks), 'butir 4 tanpa kegiatan yang diikuti: belum, dengan petunjuk');
  ok(b[4].status === 'terpenuhi' && b[4].sumber === 'otomatis' && /Persari A/.test(b[4].saran.teks), 'butir 5 terpenuhi otomatis dari Persari yang diikuti: ' + b[4].saran.teks);
  b = hitungSiagaGaruda({ peserta: { ...anak, id: 'b' }, progress: {}, pelantikan: [], tkk: [], agenda: ag, penetapan: [], hari: '2026-10-01' });
  ok(b[3].status === 'terpenuhi' && b[3].nilai === 100 && b[4].status === 'terpenuhi', 'butir 4 dari Pertemuan Siaga di kwartir, butir 5 dari Persari A');
  b = hitungSiagaGaruda({ peserta: anak, progress: {}, pelantikan: [], tkk: [], agenda: ag, penetapan: [{ pesertaId: 'a', butir: 5, nilai: 0, tanggal: '2026-09-01', catatan: '' }], hari: '2026-10-01' });
  ok(b[4].status === 'belum' && b[4].sumber === 'pembina', 'penetapan Pembina menang atas saran Agenda');
  ok(hitung(undefined)[4].status === 'belum', 'tanpa data Agenda: tetap aman (belum)');
  const wa = teksWaSiap({ nama: 'Budi', jenis: 'absensi', hari: 9, tanpaAkun: true });
  ok(/Bapak\/Ibu/.test(wa) && /Budi/.test(wa) && !/Jumat/.test(wa) && !/lulus|ulang/i.test(wa), 'teks WhatsApp anak tanpa akun ditujukan ke orang tua: ' + wa);
  ok(!/Bapak\/Ibu/.test(teksWaSiap({ nama: 'Budi', jenis: 'absensi', hari: 9 })), 'teks WhatsApp biasa tidak berubah');
}

console.log('\n--- Server: jenis Agenda Siaga ---');
{
  const stub = readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8');
  const skema = readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '');
  const pg = new PGlite();
  await siapkanPg(pg, { sqlStub: stub, sqlSkema: skema });
  await isiDataContoh(pg);
  await pg.query('update public.profiles set wajib_ganti_pin = false');
  const q = async (sql, p = []) => (await pg.query(sql, p)).rows;
  const masuk = async (username, pin) => { const a = buatApi(buatKlienFake(pg)); const r = await a.masuk(username, pin); return { a, id: r.id }; };
  const pembina = await masuk('pembina', PIN_DEMO.pembina), admin = await masuk('admin', PIN_DEMO.admin), ahmad = await masuk('10231', PIN_DEMO.penegak);

  let r = await pembina.a.tambahSiaga([{ nama: 'Anak Satu', kelas: '4A' }, { nama: 'Anak Dua', kelas: '5' }]);
  ok(r.ok, 'dua anak Siaga tanpa akun dibuat ' + (r.pesan ?? ''));
  const id = Object.fromEntries((await q('select id, nama from public.profiles where tanpa_akun')).map((x) => [x.nama, x.id]));
  const simpan = (a, jenis, extra = {}) => a.a.simpanAgenda({ id: null, tahunAjaran: '2026/2027', jenis, judul: labelJenisAgenda(jenis), tanggal: '2026-09-20', keterangan: '', pesertaTerkait: [id['Anak Satu']], lewatiBatas: false, ...extra });

  for (const jenis of JENIS_SIAGA) {
    r = await simpan(pembina, jenis);
    ok(r.ok, `Pembina menyimpan kegiatan ${jenis} dengan anak tanpa akun ` + (r.pesan ?? ''));
  }
  r = await simpan(admin, 'persari');
  ok(r.ok, 'Admin Gudep juga dapat menyimpan kegiatan Siaga');
  r = await simpan(ahmad, 'persari');
  ok(!r.ok && /Pembina dan Admin/.test(r.pesan), 'Penegak biasa ditolak: ' + r.pesan);
  r = await simpan(pembina, 'jenis_ngawur');
  ok(!r.ok && /Jenis kegiatan tidak dikenal/.test(r.pesan), 'jenis tak dikenal tetap ditolak');
  const rows = await q("select jenis, peserta_terkait from public.agenda where jenis in ('pesta_siaga','persari','pertemuan_siaga','pelantikan_siaga')");
  ok(rows.length === 5 && rows.every((x) => x.peserta_terkait.includes(id['Anak Satu'])), 'lima kegiatan tersimpan dengan anak yang ikut');
  const dibaca = await pembina.a.muatAgenda();
  ok(dibaca.ok && dibaca.data.filter((x) => x.jenis === 'persari').length === 2, 'muatAgenda memuat jenis Siaga');
  const kasar = await q("select conname from pg_constraint where conname = 'agenda_jenis_check'");
  ok(kasar.length === 1, 'kendala jenis ada');
  const dbJenis = (await q("select pg_get_constraintdef(oid) d from pg_constraint where conname = 'agenda_jenis_check'"))[0].d;
  ok(JENIS_AGENDA.every((j) => dbJenis.includes(`'${j.id}'`)), 'setiap jenis klien ada di kendala basis data (paritas)');
  const cad = await admin.a.unduhCadangan();
  ok(cad.ok && JSON.stringify(cad.data).includes('"pelantikan_siaga"'), 'cadangan memuat kegiatan Siaga');

  console.log('\n--- Server: pengingat anak tanpa akun ---');
  const hari = (await q('select sigarda.hari_ini()::text d'))[0].d;
  const mundur = (n) => { const d = new Date(hari + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  // Sesi data contoh (tanggalnya bergantung hari uji) dapat menyela atau memutus runtun Alpa: kosongkan agar uji deterministik.
  await q('delete from public.absensi_hadir');
  await q('delete from public.absensi_sesi');
  for (const n of [20, 13, 6]) {
    await q('insert into public.absensi_sesi (tanggal) values ($1) on conflict do nothing', [mundur(n)]);
    await q("insert into public.absensi_hadir (tanggal, peserta_id, status) values ($1, $2, 'A') on conflict (tanggal, peserta_id) do update set status = 'A'", [mundur(n), id['Anak Satu']]);
    await q("insert into public.absensi_hadir (tanggal, peserta_id, status) values ($1, $2, 'H') on conflict (tanggal, peserta_id) do update set status = 'H'", [mundur(n), id['Anak Dua']]);
  }
  await q('delete from public.notifikasi');
  await q('select sigarda.eskalasi_proses()');
  const kunciSatu = '%' + id['Anak Satu'] + '%';
  ok((await q("select count(*)::int n from public.notifikasi where jenis = 'eskalasi' and penerima_id = $1", [id['Anak Satu']]))[0].n === 0, 'anak tanpa akun sendiri tidak diberi notifikasi');
  const keP = await q("select penerima_id, judul, kunci from public.notifikasi where jenis = 'eskalasi' and kunci like $1", [kunciSatu]);
  ok(keP.length > 0 && keP.every((x) => /^eskalasi-p:absensi:/.test(x.kunci) && /Perlu tindak lanjut: Anak Satu/.test(x.judul)), 'pengurus diberi tahu (hanya kejadian absensi): ' + keP.length + ' notifikasi');
  ok(keP.some((x) => x.penerima_id === pembina.id), 'Pembina termasuk penerima');
  ok((await q("select count(*)::int n from public.notifikasi where jenis = 'eskalasi' and kunci like $1", ['%' + id['Anak Dua'] + '%']))[0].n === 0, 'anak yang hadir tidak memicu apa pun');
  const jumlah = (await q('select count(*)::int n from public.notifikasi'))[0].n;
  await q('select sigarda.eskalasi_proses()');
  ok((await q('select count(*)::int n from public.notifikasi'))[0].n === jumlah, 'dijalankan lagi pada hari yang sama: tidak ada notifikasi ganda');
  const d = await pembina.a.muatEskalasi();
  const baris = d.data.filter((x) => x.pesertaId === id['Anak Satu']);
  ok(d.ok && baris.length === 1 && baris[0].jenis === 'absensi' && baris[0].tanpaAkun === true && baris[0].hari >= 8, 'Tindak Lanjut memuat anak itu: satu baris absensi bertanda tanpaAkun');
  ok(!d.data.some((x) => x.pesertaId === id['Anak Dua']), 'anak yang hadir tidak ada di Tindak Lanjut');
  ok(d.data.filter((x) => x.pesertaId !== id['Anak Satu']).every((x) => x.tanpaAkun === false), 'baris Penegak berakun bertanda tanpaAkun false');
  // Kontrol: anak tanpa akun tidak pernah masuk jenis sku/iuran walau tanpa catatan.
  await q("update public.profiles set dibuat = now() - interval '40 days' where id = $1", [id['Anak Dua']]);
  await q('select sigarda.eskalasi_proses()');
  ok(!(await pembina.a.muatEskalasi()).data.some((x) => x.pesertaId === id['Anak Dua']), 'SKU diam atau iuran kosong tidak menandai anak tanpa akun');
  // Kalimat pengingat Penegak berakun tidak lagi menyebut "Jumat".
  const isi = (await q("select sigarda.eskalasi_isi('absensi', 1, current_date) a, sigarda.eskalasi_isi('iuran', 1, current_date) b"))[0];
  ok(!/Jumat/.test(isi.a + isi.b), 'kalimat eskalasi tidak menyebut Jumat: ' + isi.a + ' / ' + isi.b);
  r = await ahmad.a.muatEskalasi();
  ok(!r.ok, 'Penegak biasa tetap tidak dapat membuka Tindak Lanjut');
}

console.log(`\nRINGKASAN KEGIATAN SIAGA: ${l} lulus, ${g} GAGAL`);
process.exit(g ? 1 : 0);
