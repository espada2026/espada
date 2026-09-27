// Fase 1 landing page: isi beranda publik di server (PGlite): hak (pengurus), validasi, penyimpanan, dan fungsi publik tanpa login (isi yang boleh keluar, agenda mendatang,
// tidak ada data pribadi). Klien: uji/beranda-klien.mjs. Migrasi: uji/migrasi-beranda.mjs.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { siapkanPg, buatKlienFake, sqlSebagai } from '../src/lokal/klienFake.js';
import { isiDataContoh, isiStatusContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';
import { susunBerandaPublik, untukForm } from '../src/lib/berandaLogic.js';

const P = process.cwd().replace(/\\/g, '/');
let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };
const pg = new PGlite();
await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
await isiDataContoh(pg);
await isiStatusContoh(pg); // Nadia (10008) berjabatan Sekretaris
await pg.query('update public.profiles set wajib_ganti_pin = false');
const q = async (sql, p = []) => (await pg.query(sql, p)).rows;
const masuk = async (nama, pin) => { const k = buatKlienFake(pg); const a = buatApi(k); const r = await a.masuk(nama, pin); return { k, a, id: r.id }; };
const K = { admin: await masuk('admin', PIN_DEMO.admin), pembina: await masuk('pembina', PIN_DEMO.pembina), dewan: await masuk('dewan', PIN_DEMO.dewan) };
const N = { biasa: await masuk('10231', PIN_DEMO.penegak), berjabatan: await masuk('10008', PIN_DEMO.penegak) };
const sebagai = async (id, sql, args = []) => { try { return { ok: true, rows: (await sqlSebagai(pg, id, sql, args)).rows }; } catch (e) { return { ok: false, pesan: e.message }; } };
const cocok = (r, re) => !r.ok && re.test(r.pesan ?? '');
const simpan = (id, nilai) => sebagai(id, 'select public.sg_beranda_kontak_simpan($1::jsonb)', [JSON.stringify(nilai)]);
const publik = async () => (await sebagai(null, 'select public.sg_beranda_publik() as d')).rows[0].d;
const tersimpan = async () => (await q(`select nilai from public.pengaturan where kunci = 'beranda.kontak'`))[0]?.nilai;

const LENGKAP = {
  whatsapp: '0812 3456 7890', email: 'gudep@contoh.sch.id', telepon: '(0281) 123456', jadwal: 'Setiap Jumat sore di sekolah',
  instagram: 'https://instagram.com/gudep_contoh', youtube: 'https://youtube.com/@gudepcontoh', facebook: 'https://facebook.com/gudepcontoh', tiktok: 'https://tiktok.com/@gudepcontoh',
  peta: 'https://maps.app.goo.gl/abc123', sambutanPembina: 'Selamat datang.\n\nSemoga betah.', sambutanKepsek: 'Salam Pramuka.', cerita: 'Gudep berdiri sejak lama.',
};

console.log('--- Hak: hanya pengurus ---');
{
  let r = await simpan(N.biasa.id, LENGKAP);
  ok(cocok(r, /Hanya pengurus/), 'Penegak biasa tidak dapat mengubah isi beranda');
  r = await simpan(null, LENGKAP);
  ok(!r.ok, 'tanpa login (anon) tidak dapat mengubah isi beranda');
  ok((await tersimpan()) === undefined, 'isian yang ditolak tidak tersimpan');
  r = await simpan(N.berjabatan.id, { ...LENGKAP, jadwal: 'Jumat 15.30' });
  ok(r.ok, 'Penegak berjabatan Dewan (Sekretaris) dapat mengubah isi beranda ' + (r.pesan ?? ''));
  r = await simpan(K.dewan.id, { ...LENGKAP, jadwal: 'Jumat 16.00' });
  ok(r.ok, 'akun Dewan lama dapat mengubah isi beranda');
  r = await simpan(K.pembina.id, { ...LENGKAP, jadwal: 'Jumat 16.30' });
  ok(r.ok, 'Pembina dapat mengubah isi beranda');
  r = await simpan(K.admin.id, LENGKAP);
  ok(r.ok, 'Admin Gudep dapat mengubah isi beranda');
  const t = await tersimpan();
  ok(t.jadwal === 'Setiap Jumat sore di sekolah' && t.whatsapp === '0812 3456 7890', 'nilai terakhir tersimpan');
  ok((await q(`select diubah_oleh = $1 as o from public.pengaturan where kunci = 'beranda.kontak'`, [K.admin.id]))[0].o, 'pengubah terakhir tercatat');
}

console.log('\n--- Validasi isian ---');
{
  const tolak = async (nilai, re, m) => ok(cocok(await simpan(K.pembina.id, nilai), re), m);
  await tolak({ ...LENGKAP, kunciAsing: 'x' }, /tidak dikenal/, 'kunci asing ditolak');
  await tolak({ ...LENGKAP, email: 123 }, /harus berupa teks/, 'isian bukan teks ditolak');
  await tolak({ ...LENGKAP, whatsapp: 'abc' }, /WhatsApp/, 'WhatsApp berhuruf ditolak');
  await tolak({ ...LENGKAP, whatsapp: '0812' }, /WhatsApp/, 'WhatsApp terlalu pendek ditolak');
  await tolak({ ...LENGKAP, email: 'bukan-email' }, /email/i, 'email tanpa @ ditolak');
  await tolak({ ...LENGKAP, telepon: 'telp 123' }, /Telepon/, 'telepon berhuruf ditolak');
  await tolak({ ...LENGKAP, instagram: 'http://instagram.com/x' }, /https/, 'tautan http (bukan https) ditolak');
  await tolak({ ...LENGKAP, youtube: 'javascript:alert(1)' }, /https/, 'tautan javascript: ditolak');
  await tolak({ ...LENGKAP, facebook: 'https://tanpa-titik/abc' }, /https/, 'tautan tanpa nama host bertitik ditolak');
  await tolak({ ...LENGKAP, tiktok: 'https://tiktok.com/a b' }, /https/, 'tautan bercelah spasi ditolak');
  await tolak({ ...LENGKAP, peta: 'https://' + 'a'.repeat(300) + '.com' }, /maksimal 300/, 'tautan terlalu panjang ditolak');
  await tolak({ ...LENGKAP, jadwal: 'x'.repeat(121) }, /maksimal 120/, 'jadwal terlalu panjang ditolak');
  await tolak({ ...LENGKAP, sambutanPembina: 'x'.repeat(1501) }, /maksimal 1500/, 'sambutan terlalu panjang ditolak');
  await tolak({ ...LENGKAP, cerita: 'x'.repeat(2001) }, /maksimal 2000/, 'cerita terlalu panjang ditolak');
  const r = await sebagai(K.pembina.id, `select public.sg_beranda_kontak_simpan('[]'::jsonb)`);
  ok(cocok(r, /tidak sah/), 'bentuk bukan objek ditolak');
  ok((await tersimpan()).jadwal === 'Setiap Jumat sore di sekolah', 'isian yang ditolak tidak mengubah nilai tersimpan');
}

console.log('\n--- Penyimpanan dan perapian ---');
{
  const r = await simpan(K.pembina.id, { whatsapp: '  0812  3456 7890 ', sambutanPembina: 'Paragraf satu.\r\n\r\n\r\n\r\nParagraf   dua.  \r\n  Baris baru.' });
  ok(r.ok, 'isian sebagian diterima');
  const t = await tersimpan();
  ok(t.whatsapp === '0812 3456 7890', 'satu baris dirapikan (spasi ganda dan tepi)');
  ok(t.sambutanPembina === 'Paragraf satu.\n\nParagraf dua.\nBaris baru.', 'paragraf dirapikan: CRLF menjadi LF, baris kosong berlebih menjadi satu, spasi ganda dirapikan (' + JSON.stringify(t.sambutanPembina) + ')');
  ok(Object.keys(t).length === 12 && t.email === '' && t.cerita === '', 'kolom yang tidak dikirim tersimpan kosong (semua 12 kolom selalu ada)');
  ok((await simpan(K.pembina.id, {})).ok && Object.values(await tersimpan()).every((v) => v === ''), 'objek kosong = semua dikosongkan');
  ok((await simpan(K.pembina.id, { instagram: null, cerita: null })).ok, 'nilai null diperlakukan sebagai kosong');
}

console.log('\n--- Fungsi publik: tanpa login ---');
{
  ok(JSON.stringify(await publik()).length > 0 && Object.keys(await publik()).sort().join() === 'agenda,berita,faq,galeri,gudep,kamabigus,kontak,pembina,prestasi,sosial', 'anon dapat memanggil sg_beranda_publik; bentuk: agenda, berita, faq, galeri, gudep, kamabigus, kontak, pembina, prestasi, sosial (Fase 2: uji/beranda-konten.mjs menjaga isi kelima kunci baru)');
  const r = await sebagai(null, `select public.sg_beranda_kontak_simpan('{}'::jsonb)`);
  ok(!r.ok, 'anon tidak dapat memanggil sg_beranda_kontak_simpan');
  let d = await publik();
  ok(JSON.stringify(d.gudep) === '{}' && JSON.stringify(d.pembina) === '{}' && d.agenda.length === 0, 'belum ada Data Gudep dan agenda: objek dan larik kosong');
  ok(d.kontak.email === '' && d.kontak.telepon === '', 'email dan telepon kosong bila belum diisi di mana pun');

  const gudep = {
    nama: 'Gugus Depan Contoh', singkat: 'Ambalan Contoh', sekolah: 'SMA Contoh', alamat: 'Jl. Contoh No. 1', kota: 'Bukateja', nomorGudep: '10.701', kwarran: 'Kwarran Contoh', kwarcab: 'Kwarcab Contoh',
    telepon: '0281 999', email: 'gudep@sekolah.contoh',
    pembina: { jabatan: 'Pembina Gudep', nama: 'Bu Pembina Contoh', nta: '11.03.10.701.02365', nip: '198001012005012001' },
    kamabigus: { jabatan: 'Kepala Sekolah', nama: 'Pak Kepsek Contoh', nta: '99.99.99', nip: '197001011990011001' },
  };
  ok((await sebagai(K.admin.id, 'select public.sg_gudep_simpan($1::jsonb)', [JSON.stringify(gudep)])).ok, 'prasyarat: Admin mengisi Data Gudep');
  await simpan(K.pembina.id, { whatsapp: '0812 3456 7890', jadwal: 'Jumat sore' });
  d = await publik();
  ok(d.gudep.nama === 'Gugus Depan Contoh' && d.gudep.sekolah === 'SMA Contoh' && d.gudep.alamat === 'Jl. Contoh No. 1' && d.gudep.nomorGudep === '10.701' && d.gudep.kwarcab === 'Kwarcab Contoh', 'identitas gudep (termasuk alamat dan kwartir) keluar');
  ok(d.pembina.nama === 'Bu Pembina Contoh' && d.pembina.jabatan === 'Pembina Gudep' && d.kamabigus.nama === 'Pak Kepsek Contoh', 'nama dan jabatan Pembina dan Kepala Sekolah keluar');
  const teks = JSON.stringify(d);
  ok(!teks.includes('11.03.10.701.02365') && !teks.includes('198001012005012001') && !teks.includes('99.99.99') && !teks.includes('197001011990011001') && !/"nta"|"nip"/.test(teks), 'NTA dan NIP TIDAK keluar');
  ok(d.kontak.email === 'gudep@sekolah.contoh' && d.kontak.telepon === '0281 999', 'email dan telepon kosong dilengkapi dari Data Gudep');
  await simpan(K.pembina.id, { email: 'beranda@contoh.id', telepon: '0281 111' });
  d = await publik();
  ok(d.kontak.email === 'beranda@contoh.id' && d.kontak.telepon === '0281 111', 'email dan telepon beranda menang atas Data Gudep bila diisi');

  // Agenda: hanya yang mendatang, paling banyak 6, urut tanggal, hanya jenis + judul + tanggal
  const ta = (await q(`select sigarda.tahun_ajaran_kini() t`))[0].t;
  const ins = (n, jenis, judul, ket = '') => pg.query(`insert into public.agenda (tahun_ajaran, jenis, judul, tanggal, keterangan, peserta_terkait) values ($1, $2, $3, sigarda.hari_ini() + $4::int, $5, $6::uuid[])`, [ta, jenis, judul, n, ket, `{${N.biasa.id}}`]);
  await ins(-3, 'lainnya', 'Kemarin dulu', 'sudah lewat');
  await ins(0, 'lainnya', 'Hari ini', 'RAHASIA-KETERANGAN');
  for (const n of [40, 5, 12, 20, 30, 25, 60]) await ins(n, 'perkemahan', `Kegiatan ${n}`, 'RAHASIA-KETERANGAN');
  d = await publik();
  ok(d.agenda.length === 6, `paling banyak 6 agenda (${d.agenda.length})`);
  ok(d.agenda[0].judul === 'Hari ini', 'agenda hari ini ikut tampil (tanggal >= hari ini WIB)');
  ok(!d.agenda.some((a) => a.judul === 'Kemarin dulu'), 'agenda yang sudah lewat tidak tampil');
  ok(d.agenda.map((a) => a.tanggal).join() === [...d.agenda.map((a) => a.tanggal)].sort().join(), 'urut menurut tanggal');
  ok(d.agenda.map((a) => a.judul).join() === 'Hari ini,Kegiatan 5,Kegiatan 12,Kegiatan 20,Kegiatan 25,Kegiatan 30', 'enam terdekat, yang terjauh terpotong');
  ok(d.agenda.every((a) => Object.keys(a).sort().join() === 'jenis,judul,tanggal'), 'setiap agenda hanya berisi jenis, judul, tanggal');
  ok(!JSON.stringify(d).includes('RAHASIA-KETERANGAN') && !JSON.stringify(d).includes(N.biasa.id), 'keterangan dan peserta_terkait TIDAK keluar');

  const semua = JSON.stringify(await publik());
  const namaPengguna = (await q(`select username from public.profiles where role = 'peserta' and username ~ '^[0-9]{5}$' limit 5`)).map((x) => x.username);
  ok(namaPengguna.every((u) => !semua.includes(`"${u}"`)) && !/hash_pin|whatsapp":"0[0-9]{3} ?[0-9]{4}/.test(semua.replace(/"kontak":\{[^}]*\}/, '')), 'tidak ada data anggota di jawaban publik');
}

console.log('\n--- Klien: bentuk dan pemetaan ---');
{
  await simpan(K.pembina.id, LENGKAP);
  const r = await K.pembina.a.muatBerandaKontak();
  ok(r.ok && JSON.stringify(r.data) === JSON.stringify(untukForm(LENGKAP)), 'api().muatBerandaKontak mengembalikan isian lengkap yang tersimpan');
  const s = await N.berjabatan.a.simpanBerandaKontak({ ...LENGKAP, jadwal: 'Jumat pagi' });
  ok(s.ok && (await tersimpan()).jadwal === 'Jumat pagi', 'api().simpanBerandaKontak (Penegak berjabatan) tersimpan');
  const t = await N.biasa.a.simpanBerandaKontak(LENGKAP);
  ok(!t.ok && /Hanya pengurus/.test(t.pesan), 'api().simpanBerandaKontak: Penegak biasa ditolak dengan pesan yang jelas');
  const susun = susunBerandaPublik(await publik());
  ok(susun.agenda.length === 6 && susun.pembina.nama === 'Bu Pembina Contoh' && susun.kontak.whatsapp === LENGKAP.whatsapp && susun.gudep.sekolah === 'SMA Contoh', 'susunBerandaPublik memetakan jawaban server');
  ok(susunBerandaPublik(null).agenda.length === 0 && susunBerandaPublik('rusak').kontak.email === '' && susunBerandaPublik({ agenda: 'x', kontak: 5 }).agenda.length === 0, 'susunBerandaPublik aman untuk jawaban rusak');
}

console.log('\n--- Cadangan ---');
{
  const c = (await sebagai(K.admin.id, 'select public.sg_cadangan_admin() as d')).rows[0].d;
  ok(c.tabel?.pengaturan?.some?.((p) => p.kunci === 'beranda.kontak') || JSON.stringify(c).includes('beranda.kontak'), 'cadangan data memuat pengaturan beranda.kontak');
}

console.log(`\nRINGKASAN BERANDA: ${lulus} lulus, ${gagal} GAGAL.`);
await pg.close();
if (gagal) process.exit(1);
