// Pramuka Siaga, Fase 1: anggota Siaga tanpa akun, kelas SD (angka + paralel), perindukan/barung. Server (PGlite), cermin validasi klien (kisi masukan dibandingkan
// langsung dengan sigarda.siaga_periksa dan sigarda.rombel_sah), pengelompokan, dan render halaman.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { siapkanPg, buatKlienFake, sqlSebagai } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';
import { petaProfil } from '../src/lib/mapDb.js';
import { KonteksApp } from '../src/context/AppContext.jsx';
import Siaga from '../src/pages/Siaga.jsx';
import { normalisasiRombel, rombelSah } from '../src/lib/rombelLogic.js';
import { anggotaTanpaJk } from '../src/lib/jenisKelaminLogic.js';
import { bacaTempelanSiaga, penyamaKelompok, periksaBanyakSiaga, periksaSiaga, susunKelompok } from '../src/lib/siagaLogic.js';

const P = process.cwd().replace(/\\/g, '/');
let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };

const pg = new PGlite();
await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
await isiDataContoh(pg);
await pg.query('update public.profiles set wajib_ganti_pin = false');
const q = async (sql, p = []) => (await pg.query(sql, p)).rows;
const masuk = async (nama, pin) => { const k = buatKlienFake(pg); const a = buatApi(k); const r = await a.masuk(nama, pin); return { k, a, id: r.id }; };
const pembina = await masuk('pembina', PIN_DEMO.pembina);
const admin = await masuk('admin', PIN_DEMO.admin);
const ahmad = await masuk('10231', PIN_DEMO.penegak);
const kanon = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))));
const sebagai = async (id, sql, args = []) => { try { return { ok: true, rows: (await sqlSebagai(pg, id, sql, args)).rows }; } catch (e) { return { ok: false, pesan: e.message }; } };

console.log('--- Kelas SD: rombel_sah (server) = rombelSah/normalisasiRombel (klien) ---');
{
  const kisi = ['1', '4A', '6B', '7', '0', '1AB', 'a', '4a', 'X-01', 'XI-10', 'XII-05', 'X-11', 'X', 'XIII-01', '', ' 4A', '4-A'];
  let beda = 0;
  for (const k of kisi) {
    const s = (await q('select sigarda.rombel_sah($1) v', [k]))[0].v;
    if (s !== rombelSah(k)) { beda++; console.log('   beda rombel_sah:', JSON.stringify(k), 'server', s, 'klien', rombelSah(k)); }
  }
  ok(beda === 0, `${kisi.length} kelas: rombel_sah klien sama dengan server (SMA dan SD)`);
  const norm = ['4 a', '5b', '1', '7', '0', '4-A', 'xi 3', 'x-1', 'X', '1AB'].map(normalisasiRombel).join();
  ok(norm === '4A,5B,1,,,4A,XI-03,X-01,,', 'normalisasiRombel menerima kelas SD dan tetap membakukan rombel SMA: ' + norm);
}

console.log('\n--- Cermin validasi = sigarda.siaga_periksa (kisi masukan) ---');
{
  // anggota contoh agar pemeriksaan NIS kembar dan penyamaan penulisan ikut teruji
  await sebagai(pembina.id, 'select public.sg_siaga_tambah($1::jsonb)', [JSON.stringify([{ nama: 'Awal Satu', kelas: '4A', nis: 'N-100', perindukan: 'Perindukan Melati', barung: 'Barung Kancil' }])]);
  const users = (await q('select * from public.profiles')).map(petaProfil);
  const ada = penyamaKelompok(users);
  const nis0 = (await q("select nis from public.profiles where role = 'peserta' and not tanpa_akun limit 1"))[0].nis;
  const dasar = { nama: 'Budi', kelas: '4A' };
  const kisi = [
    {}, null, [], 'x', { nama: '', kelas: '4' }, { nama: '   ', kelas: '4' }, { nama: 'x'.repeat(121), kelas: '4' }, { nama: 'x'.repeat(120), kelas: '4' },
    { nama: 'Ani', kelas: '' }, { nama: 'Ani', kelas: '7' }, { nama: 'Ani', kelas: '0' }, { nama: 'Ani', kelas: 'X-01' }, { nama: 'Ani', kelas: '4 a' }, { nama: 'Ani', kelas: '4ab' }, { nama: 'Ani', kelas: '6' },
    { ...dasar, jk: 'l' }, { ...dasar, jk: 'P' }, { ...dasar, jk: 'X' }, { ...dasar, jk: '' },
    { ...dasar, agama: 'Islam' }, { ...dasar, agama: 'Khonghucu' }, { ...dasar, agama: 'Kristen' }, { ...dasar, agama: '' },
    { ...dasar, nis: '12' }, { ...dasar, nis: '123' }, { ...dasar, nis: 'a b c' }, { ...dasar, nis: 'N-100' }, { ...dasar, nis: nis0 }, { ...dasar, nis: 'x'.repeat(21) }, { ...dasar, nis: '1234567890123456789A' },
    { ...dasar, barung: 'Barung Kancil' }, { ...dasar, perindukan: 'Perindukan Melati', barung: 'barung kancil' }, { ...dasar, perindukan: 'perindukan melati' }, { ...dasar, perindukan: 'Baru', barung: 'Elang' },
    { ...dasar, perindukan: 'x'.repeat(41) }, { ...dasar, perindukan: 'a<b' }, { ...dasar, perindukan: 'P', barung: 'b>' }, { ...dasar, perindukan: '  Rapi   Sekali ' },
    { nama: '  Ani   Budi ', kelas: ' 5b ', jk: ' p ', agama: ' Hindu ', nis: ' 555 ' },
  ];
  let beda = 0;
  for (const d of kisi) {
    const klien = periksaSiaga(d, ada);
    const r = await sebagai(pembina.id, 'select sigarda.siaga_periksa($1::jsonb) v', [JSON.stringify(d)]);
    const samaOk = klien.ok === r.ok;
    const sama = samaOk && (klien.ok ? kanon(klien.nilai) === kanon(r.rows[0].v) : r.pesan.includes(klien.pesan));
    if (!sama) { beda++; console.log('   beda:', JSON.stringify(d), 'klien:', JSON.stringify(klien), 'server:', r.ok ? JSON.stringify(r.rows[0].v) : r.pesan); }
  }
  ok(beda === 0, `${kisi.length} kombinasi: klien menerima atau menolak sama dengan server, dengan nilai dan pesan yang sama`);
}

console.log('\n--- Aksi server: tambah, ubah, kelompok, hapus ---');
let ids = [];
{
  let r = await ahmad.a.tambahSiaga([{ nama: 'Siswa', kelas: '4A' }]);
  ok(!r.ok && /Hanya Pembina dan Admin/.test(r.pesan), 'Penegak biasa tidak dapat menambah anggota Siaga');
  r = await pembina.a.tambahSiaga([]);
  ok(!r.ok && /Tidak ada data/.test(r.pesan), 'daftar kosong ditolak');
  const sebelum = Number((await q('select count(*)::int n from public.profiles'))[0].n);
  r = await pembina.a.tambahSiaga([{ nama: 'Sah Satu', kelas: '4' }, { nama: 'Salah', kelas: '9' }]);
  ok(!r.ok && /^Baris 2:/.test(r.pesan) && /Kelas harus angka/.test(r.pesan), 'baris salah menolak seluruh kiriman dengan nomor barisnya: ' + r.pesan);
  ok(Number((await q('select count(*)::int n from public.profiles'))[0].n) === sebelum, 'semua atau tidak sama sekali: tidak ada yang tersimpan');
  r = await pembina.a.tambahSiaga([
    { nama: 'Andi Saputra', kelas: '4A', jk: 'L', agama: 'Islam', perindukan: 'Perindukan Melati', barung: 'Barung Kancil' },
    { nama: 'Bunga Lestari', kelas: '4B', jk: 'P', agama: 'Katolik', perindukan: 'perindukan melati', barung: 'barung kancil' },
    { nama: 'Candra', kelas: '5', nis: 'S-1' },
  ]);
  ok(r.ok && r.data === 3, 'Pembina menambah 3 anggota sekaligus');
  r = await admin.a.tambahSiaga([{ nama: 'Dini', kelas: '6' }]);
  ok(r.ok, 'Admin Gudep juga dapat menambah');
  r = await pembina.a.tambahSiaga([{ nama: 'Kembar', kelas: '5', nis: 'S-1' }]);
  ok(!r.ok && /sudah dipakai/.test(r.pesan), 'NIS kembar ditolak');
  r = await pembina.a.tambahSiaga([{ nama: 'K1', kelas: '5', nis: 'S-7' }, { nama: 'K2', kelas: '5', nis: 'S-7' }]);
  ok(!r.ok && /^Baris 2:/.test(r.pesan), 'NIS kembar di dalam satu kiriman ditolak');

  const rows = await q("select * from public.profiles where tanpa_akun order by nama");
  ok(rows.length === 5, 'anggota Siaga tersimpan (termasuk satu dari uji cermin): ' + rows.map((x) => x.nama).join(', '));
  ok(rows.every((x) => x.role === 'peserta' && x.tanpa_akun && x.status === 'aktif' && /^siaga[0-9a-f]{12}$/.test(x.username)), 'role peserta, tanpa_akun, aktif, nama pengguna dibuat otomatis');
  ok((await q('select count(*)::int n from auth.users u join public.profiles p on p.id = u.id where p.tanpa_akun'))[0].n === 0, 'anggota Siaga TIDAK punya baris di auth.users');
  const bunga = rows.find((x) => x.nama === 'Bunga Lestari');
  ok(bunga.perindukan === 'Perindukan Melati' && bunga.barung === 'Barung Kancil', 'penulisan perindukan/barung disamakan dengan yang sudah ada: ' + bunga.perindukan + ' / ' + bunga.barung);
  ids = rows.filter((x) => x.nama !== 'Awal Satu').map((x) => x.id);

  const andi = rows.find((x) => x.nama === 'Andi Saputra');
  r = await pembina.a.ubahSiaga(andi.id, { nama: 'Andi S.', kelas: '5A', jk: 'L', agama: 'Islam', nis: '', perindukan: 'Perindukan Melati', barung: 'Barung Kancil' });
  ok(r.ok && (await q('select nama, kelas from public.profiles where id = $1', [andi.id]))[0].kelas === '5A', 'Pembina mengubah data anggota');
  r = await pembina.a.ubahSiaga(ahmad.id, { nama: 'Ahmad', kelas: '4' });
  ok(!r.ok && /Anggota Siaga tidak ditemukan/.test(r.pesan), 'akun Penegak biasa tidak dapat diubah lewat jalur Siaga');
  r = await ahmad.a.ubahSiaga(andi.id, { nama: 'x', kelas: '4' });
  ok(!r.ok && /Hanya Pembina dan Admin/.test(r.pesan), 'Penegak biasa tidak dapat mengubah anggota Siaga');

  r = await pembina.a.aturBarung([ids[0], ids[1]], 'Perindukan Mawar', 'Barung Elang');
  ok(r.ok && r.data === 2 && (await q("select count(*)::int n from public.profiles where barung = 'Barung Elang' and perindukan = 'Perindukan Mawar'"))[0].n === 2, 'menempatkan banyak anggota ke perindukan dan barung');
  r = await pembina.a.aturBarung([ids[0]], '', 'Barung Elang');
  ok(!r.ok && /Barung harus berada di sebuah perindukan/.test(r.pesan), 'barung tanpa perindukan ditolak');
  r = await pembina.a.aturBarung([ids[0], ahmad.id], 'Perindukan Mawar', 'Barung Elang');
  ok(!r.ok && /bukan anggota Siaga/.test(r.pesan), 'akun Penegak biasa tidak dapat ditempatkan');
  r = await pembina.a.aturBarung([ids[0]], '', '');
  ok(r.ok && (await q('select perindukan, barung from public.profiles where id = $1', [ids[0]]))[0].barung === null, 'perindukan kosong mengeluarkan dari kelompok');
  r = await ahmad.a.aturBarung([ids[0]], 'P', 'B');
  ok(!r.ok && /Hanya Pembina dan Admin/.test(r.pesan), 'Penegak biasa tidak dapat mengatur barung');

  console.log('\n--- Hapus dan status ---');
  const candra = rows.find((x) => x.nama === 'Candra');
  await q("insert into public.absensi_sesi (tanggal) values ('2026-09-25') on conflict do nothing");
  await q("insert into public.absensi_hadir (tanggal, peserta_id, status) values ('2026-09-25', $1, 'H')", [candra.id]);
  r = await pembina.a.hapusSiaga(candra.id);
  ok(!r.ok && /sudah punya catatan/.test(r.pesan), 'anggota yang sudah punya catatan tidak dapat dihapus');
  r = await pembina.a.hapusSiaga(ids[ids.length - 1]);
  ok(r.ok && (await q('select count(*)::int n from public.profiles where id = $1', [ids[ids.length - 1]]))[0].n === 0, 'anggota tanpa catatan dapat dihapus');
  r = await pembina.a.hapusSiaga(ahmad.id);
  ok(!r.ok && /tidak ditemukan/.test(r.pesan), 'akun Penegak biasa tidak dapat dihapus lewat jalur Siaga');
  r = await pembina.a.aturStatusAnggota(candra.id, 'nonaktif');
  ok(r.ok && (await q('select status from public.profiles where id = $1', [candra.id]))[0].status === 'nonaktif', 'status nonaktif memakai fungsi status yang ada');
  r = await pembina.a.aturStatusAnggota(candra.id, 'aktif', '5');
  ok(r.ok && (await q('select status, kelas from public.profiles where id = $1', [candra.id]))[0].kelas === '5', 'mengaktifkan kembali dengan kelas SD diterima');
}

console.log('\n--- Hak baca, Periksa Data, dan pemicu hapus akun ---');
{
  const r = await pembina.a.muatPemeriksaanData();
  const d = r.data;
  const idSiaga = new Set((await q('select id from public.profiles where tanpa_akun')).map((x) => x.id));
  const dalam = (daftar) => (daftar ?? []).filter((x) => idSiaga.has(x.id)).length;
  ok(r.ok && dalam(d.dataDiriBelum) === 0, 'Periksa Data: data diri belum lengkap tidak menandai anak Siaga (tanpa isian mandiri)');
  ok(dalam(d.belumPernahMasuk) === 0, 'Periksa Data: belum pernah masuk tidak menandai anak Siaga (tanpa akun)');
  ok(dalam(d.kelasLama) === 0, 'Periksa Data: kelas SD tidak dianggap format lama');
  const lihat = await sebagai(ahmad.id, 'select count(*)::int n from public.profiles where tanpa_akun');
  ok(lihat.ok && lihat.rows[0].n === 0, 'Penegak biasa tidak dapat membaca profil anggota Siaga (RLS)');
  const lihatP = await sebagai(pembina.id, 'select count(*)::int n from public.profiles where tanpa_akun');
  ok(lihatP.ok && lihatP.rows[0].n > 0, 'Pembina membaca profil anggota Siaga');
  ok(anggotaTanpaJk([{ id: 'a', tanpaAkun: true }, { id: 'b' }]).length === 1, 'anak Siaga tanpa jenis kelamin tidak masuk ajakan "Lengkapi jenis kelamin" Admin');

  // menghapus akun login tetap menghapus profilnya (pengganti FK on delete cascade)
  const akun = (await q("select id from public.profiles where username = '10232'"))[0].id;
  await q('delete from auth.users where id = $1', [akun]);
  ok((await q('select count(*)::int n from public.profiles where id = $1', [akun]))[0].n === 0, 'hapus auth.users menghapus profilnya lewat pemicu');
  ok((await q('select count(*)::int n from public.profiles where tanpa_akun'))[0].n > 0, 'menghapus akun lain tidak menyentuh anggota Siaga');
  // kendala
  const gagalTanpa = await sebagai('service', "insert into public.profiles (username, role, nama, kelas, tanpa_akun) values ('x-uji-1', 'peserta', 'X', '4', false)");
  ok(!gagalTanpa.ok, 'Penegak BERAKUN tetap wajib punya NIS (kendala profil_peserta)');
  const gagalPenguji = await sebagai('service', "insert into public.profiles (username, role, nama, jabatan, tanpa_akun) values ('x-uji-2', 'penguji', 'X', 'Pembina', true)");
  ok(!gagalPenguji.ok, 'tanpa_akun hanya untuk peran peserta (kendala profil_tanpa_akun)');
}

console.log('\n--- Kelompok dan tempelan ---');
{
  const mk = (n, per, bar, extra = {}) => ({ id: n, nama: n, role: 'peserta', tanpaAkun: true, status: 'aktif', perindukan: per, barung: bar, ...extra });
  const users = [
    ...['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((n) => mk(n, 'Melati', 'Kancil', { jenisKelamin: 'L' })),
    ...['b1', 'b2'].map((n) => mk(n, 'Melati', 'Elang', { jenisKelamin: 'P' })),
    mk('c1', 'Melati', undefined), mk('d1', undefined, undefined), mk('e1', 'Mawar', 'Rusa', { status: 'nonaktif' }),
    { id: 'p', nama: 'Penegak', role: 'peserta' },
  ];
  const s = susunKelompok(users);
  ok(s.perindukan.length === 1 && s.perindukan[0].perindukan === 'Melati' && s.perindukan[0].jumlah === 9, 'satu perindukan aktif (nonaktif dan Penegak berakun tidak dihitung)');
  const m = s.perindukan[0];
  ok(m.putra === 6 && m.putri === 2, 'hitung putra dan putri');
  ok(m.barung.find((b) => b.nama === 'Kancil').peringatan === '' && /baru 2 anak/.test(m.barung.find((b) => b.nama === 'Elang').peringatan), 'peringatan ukuran barung hanya di luar anjuran 6-8');
  ok(/belum masuk barung/i.test(m.barung.find((b) => b.nama === '').peringatan) && /Baru 2 barung/.test(m.peringatan), 'peringatan barung belum ada dan jumlah barung kurang dari 3');
  ok(s.tanpaKelompok.length === 1 && s.tanpaKelompok[0].id === 'd1', 'yang belum ditempatkan terpisah');
  const t = bacaTempelanSiaga('Andi\t4A\tL\tIslam\t\tMelati\tKancil\n\nBunga;5\nCandra,6,p');
  ok(t.length === 3 && t[0].barung === 'Kancil' && t[1].kelas === '5' && t[2].jk === 'p', 'tempelan dibaca: tab, titik koma, koma; baris kosong dilewati');
  const b = periksaBanyakSiaga([{ nama: 'A', kelas: '4', nis: '777', perindukan: 'Baru' }, { nama: 'B', kelas: '4', nis: '777', perindukan: 'baru', barung: 'x' }, { nama: 'C', kelas: '9' }], []);
  ok(b.galat === 2 && /sudah dipakai/.test(b.baris[1].pesan) && /Kelas harus/.test(b.baris[2].pesan), 'banyak baris: NIS kembar dalam daftar dan kelas salah ditandai');
}

console.log('\n--- Render halaman ---');
{
  const users = (await q('select * from public.profiles')).map(petaProfil);
  const ctx = (user) => ({ user, users, progress: {}, notify: () => {}, tambahSiaga: async () => ({ ok: true }), ubahSiaga: async () => ({ ok: true }), hapusSiaga: async () => ({ ok: true }), aturBarung: async () => ({ ok: true }), aturStatusAnggota: async () => ({ ok: true }) });
  const html = renderToStaticMarkup(h(KonteksApp.Provider, { value: ctx({ id: 'p', role: 'penguji', jabatan: 'Pembina', status: 'aktif' }) }, h(Siaga))).replace(/<!-- -->/g, '');
  ok(html.includes('Anggota Siaga') && html.includes('Tambah anak') && html.includes('Tempel daftar banyak anak') && html.includes('Andi S.') && html.includes('Kelas 5A'), 'halaman dirender: judul, tombol tambah/tempel, daftar dengan kelas SD');
  ok(html.includes('Perindukan dan barung'), 'tab Perindukan dan barung tersedia');
}

console.log(`\nRINGKASAN SIAGA: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
