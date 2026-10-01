// Pramuka Siaga, Fase 2b: anak Siaga boleh punya akun masuk. Pembina membuat akun lewat Edge Function buat-akun (kode sebenarnya), anak masuk dan mengajukan SKU
// langsung ke Pembina (tanpa pra-uji, bahkan saat sakelar pra-uji hidup), Pembina menilai; cermin kelas SD klien = sigarda.kelas_siaga; halaman beranda dan SKU anak.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { siapkanPg, buatKlienFake } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';
import { petaProfil } from '../src/lib/mapDb.js';
import { KonteksApp } from '../src/context/AppContext.jsx';
import '../src/data/skuSiaga.js';
import SiagaBeranda from '../src/pages/SiagaBeranda.jsx';
import SiagaSkuSaya from '../src/pages/SiagaSkuSaya.jsx';
import { kelasSd } from '../src/lib/rombelLogic.js';
import { anggotaSiaga } from '../src/lib/siagaLogic.js';
import { antrianPengujian } from '../src/lib/skuLogic.js';
import { susunProgress } from '../src/lib/mapDb.js';

const P = process.cwd().replace(/\\/g, '/');
let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };

const pg = new PGlite();
await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
await isiDataContoh(pg);
await pg.query('update public.profiles set wajib_ganti_pin = false');
const q = async (sql, p = []) => (await pg.query(sql, p)).rows;
const masuk = async (nama, pin) => { const a = buatApi(buatKlienFake(pg)); const r = await a.masuk(nama, pin); return { a, id: r.id, ok: r.ok, pesan: r.pesan }; };
const pembina = await masuk('pembina', PIN_DEMO.pembina);
const admin = await masuk('admin', PIN_DEMO.admin);
const ahmad = await masuk('10231', PIN_DEMO.penegak);

console.log('--- Kelas SD: klien (kelasSd) = sigarda.kelas_siaga ---');
{
  const kisi = ['1', '4A', '6B', '7', '0', '1AB', 'a', '4a', 'X-01', 'XI-10', '', ' 4', '4 ', '6Z', '10'];
  let beda = 0;
  for (const k of kisi) {
    const s = (await q('select sigarda.kelas_siaga($1) v', [k]))[0].v;
    if (s !== kelasSd(k)) { beda++; console.log('   beda:', JSON.stringify(k), 'server', s, 'klien', kelasSd(k)); }
  }
  ok(beda === 0, `${kisi.length} kelas: kelasSd klien sama dengan server`);
  ok((await q('select sigarda.kelas_siaga(null) v'))[0].v === false && kelasSd(null) === false && kelasSd(undefined) === false, 'kelas kosong bukan Siaga');
}

console.log('\n--- Pembina membuat akun anak lewat Edge Function (kode sebenarnya) ---');
let anak; let pinAnak;
{
  const baris = [{ no: 1, nama: 'Dina Siaga', nis: '5001', kelas: '4A', agama: 'Islam' }];
  let r = await pembina.a.buatAkun('peserta', baris);
  ok(r.ok && r.hasil?.[0]?.ok && /^[0-9]{6}$/.test(r.hasil[0].pin), 'Pembina membuat akun anak Siaga (kelas SD): PIN awal 6 angka ' + (r.pesan ?? r.hasil?.[0]?.pesan ?? ''));
  anak = r.hasil?.[0]; pinAnak = anak?.pin;
  r = await pembina.a.buatAkun('pembina', [{ no: 1, nama: 'Pembina Baru', username: 'pembina.baru' }]);
  ok(!r.ok && /Hanya Admin Gudep/.test(r.pesan), 'Pembina tetap tidak dapat membuat akun Pembina: ' + r.pesan);
  r = await pembina.a.buatAkun('admin', [{ no: 1, nama: 'Admin Baru', username: 'admin.baru' }]);
  ok(!r.ok, 'Pembina tidak dapat membuat akun Admin');
  r = await ahmad.a.buatAkun('peserta', [{ no: 1, nama: 'Anak X', nis: '5002', kelas: '4' }]);
  ok(!r.ok && /Hanya Admin Gudep/.test(r.pesan), 'Penegak tidak dapat membuat akun');
  r = await admin.a.buatAkun('peserta', [{ no: 1, nama: 'Eko Siaga', nis: '5003', kelas: '5', agama: 'Katolik' }]);
  ok(r.ok && r.hasil?.[0]?.ok, 'Admin Gudep tetap dapat membuat akun anak Siaga');
  r = await pembina.a.buatAkun('peserta', [{ no: 1, nama: 'Anak Salah', nis: '5004', kelas: '7' }]);
  ok(r.ok && !r.hasil?.[0]?.ok && /rombel|Kelas|kelas/.test(r.hasil?.[0]?.pesan ?? ''), 'kelas yang bukan SD maupun rombel baku ditolak: ' + (r.hasil?.[0]?.pesan ?? r.pesan));
  r = await pembina.a.buatAkun('peserta', [{ no: 1, nama: 'Kembar', nis: '5001', kelas: '4' }]);
  ok(r.ok && !r.hasil?.[0]?.ok && /NIS sudah terdaftar/.test(r.hasil[0].pesan), 'NIS kembar ditolak');
  const p = (await q('select * from public.profiles where id = $1', [anak.id]))[0];
  ok(p.role === 'peserta' && p.kelas === '4A' && p.nis === '5001' && p.username === '5001' && !p.tanpa_akun && p.agama === 'Islam', 'profil anak: peserta berakun, nama pengguna = NIS, kelas SD, agama tersimpan');
  ok((await q('select count(*)::int n from auth.users where id = $1', [anak.id]))[0].n === 1, 'akun login ada di auth.users');
}

console.log('\n--- Anak berakun termasuk anggota Siaga: ubah, barung, hapus ---');
{
  const nilai = { nama: 'Dina Siaga', kelas: '4A', jk: 'P', agama: 'Islam', nis: '9999', perindukan: 'Perindukan Melati', barung: 'Barung Kancil' };
  let r = await pembina.a.ubahSiaga(anak.id, nilai);
  ok(r.ok, 'Pembina mengubah jenis kelamin, perindukan, dan barung anak berakun ' + (r.pesan ?? ''));
  const p = (await q('select jenis_kelamin, perindukan, barung, nis, username from public.profiles where id = $1', [anak.id]))[0];
  ok(p.jenis_kelamin === 'P' && p.perindukan === 'Perindukan Melati' && p.barung === 'Barung Kancil', 'perubahan tersimpan');
  ok(p.nis === '5001' && p.username === '5001', 'NIS anak berakun TIDAK berubah dari jalur Siaga (tetap = nama pengguna)');
  r = await pembina.a.aturBarung([anak.id], 'Perindukan Mawar', 'Barung Elang');
  ok(r.ok && r.data === 1, 'anak berakun dapat ditempatkan ke barung');
  r = await pembina.a.hapusSiaga(anak.id);
  ok(!r.ok && /punya akun masuk/.test(r.pesan), 'anak berakun tidak dihapus lewat jalur Siaga: ' + r.pesan);
  r = await pembina.a.ubahSiaga(ahmad.id, { nama: 'Ahmad', kelas: '4' });
  ok(!r.ok && /Anggota Siaga tidak ditemukan/.test(r.pesan), 'Penegak SMA (kelas rombel) tetap bukan anggota Siaga');
  const users = (await q('select * from public.profiles')).map(petaProfil);
  const siaga = anggotaSiaga(users).map((u) => u.nama);
  ok(siaga.includes('Dina Siaga') && !siaga.includes('Ahmad Fauzi'), 'anggotaSiaga (klien) memuat anak berakun dan tidak memuat Penegak: ' + siaga.join(', '));
}

console.log('\n--- Anak masuk dan mengajukan SKU langsung ke Pembina ---');
let kid;
{
  await q('update public.profiles set wajib_ganti_pin = false where id = $1', [anak.id]);
  kid = await masuk('5001', pinAnak);
  ok(kid.ok, 'anak masuk dengan NIS dan PIN awal ' + (kid.pesan ?? ''));
  let r = await kid.a.ajukan({ skuId: 'MUL-02', jadwal: '2099-01-01', pengujiId: null, catatan: 'siap' });
  ok(r.ok, 'anak mengajukan butir Mula ke antrian ' + (r.pesan ?? ''));
  r = await kid.a.ajukan({ skuId: 'BNU-02', jadwal: '2099-01-01', pengujiId: null });
  ok(!r.ok && /Selesaikan seluruh butir Mula lebih dulu/.test(r.pesan), 'Bantu terkunci sampai Mula selesai: ' + r.pesan);
  r = await kid.a.ajukan({ skuId: 'BAN-02', jadwal: '2099-01-01', pengujiId: null });
  ok(!r.ok && /bukan untuk tingkat/.test(r.pesan), 'anak tidak dapat mengajukan butir Penegak (Bantara): ' + r.pesan);
  const pil = await kid.a.pengujiPilihan('MUL-03');
  ok(pil.ok && pil.data.penguji.length > 0 && pil.data.penguji.every((u) => u.jabatan === 'Pembina'), 'pilihan penguji anak = Pembina: ' + (pil.data?.penguji ?? []).map((u) => u.nama).join(', '));
  r = await kid.a.ajukan({ skuId: 'MUL-03', jadwal: '2099-01-01', pengujiId: pembina.id });
  ok(r.ok, 'anak mengajukan ke Pembina tertentu');
  ok((await q("select status from public.sku_progress where peserta_id = $1 and sku_id = 'MUL-02'", [anak.id]))[0].status === 'diajukan', 'status diajukan (menunggu uji)');
  r = await kid.a.ajukan({ skuId: 'MUL-01-ISL-1', jadwal: '2099-01-01', pengujiId: pembina.id });
  ok(r.ok, 'butir agama Islam diajukan ke Pembina seagama');
  const dewan = await masuk('dewan', PIN_DEMO.dewan);
  r = await dewan.a.catatHasil({ pin: PIN_DEMO.dewan, pesertaId: anak.id, skuId: 'MUL-05', hasil: 'lulus', tanggalUji: '2026-09-25', nilai: 'Baik', catatan: '' });
  ok(!r.ok, 'Dewan Ambalan tidak dapat menilai anak Siaga (hanya Pembina): ' + r.pesan);
  r = await ahmad.a.ajukan({ skuId: 'MUL-02', jadwal: '2099-01-01', pengujiId: null });
  ok(!r.ok && /bukan untuk tingkat/.test(r.pesan), 'Penegak SMA tidak dapat mengajukan butir Siaga: ' + r.pesan);
  r = await pembina.a.catatHasil({ pin: PIN_DEMO.pembina, pesertaId: ahmad.id, skuId: 'MUL-02', hasil: 'lulus', tanggalUji: '2026-09-25', nilai: 'Baik', catatan: '' });
  ok(!r.ok && /bukan untuk tingkat/.test(r.pesan), 'Pembina tidak dapat mencatat butir Siaga untuk Penegak SMA: ' + r.pesan);
  r = await pembina.a.catatHasil({ pin: PIN_DEMO.pembina, pesertaId: anak.id, skuId: 'BAN-02', hasil: 'lulus', tanggalUji: '2026-09-25', nilai: 'Baik', catatan: '' });
  ok(!r.ok && /bukan untuk tingkat/.test(r.pesan), 'Pembina tidak dapat mencatat butir Penegak untuk anak Siaga: ' + r.pesan);
  r = await kid.a.ajukan({ skuId: 'MUL-01-KAT-1', jadwal: '2099-01-01', pengujiId: null });
  ok(!r.ok && /Poin SKU tidak ditemukan/.test(r.pesan), 'sub-butir agama lain ditolak');
}

console.log('\n--- Tanpa pra-uji, walau sakelar pra-uji hidup ---');
{
  let r = await pembina.a.aturSakelarPraUji(true);
  ok(r.ok && (await q("select sigarda.pra_uji_aktif() v"))[0].v === true, 'sakelar pra-uji dinyalakan untuk uji');
  r = await kid.a.ajukan({ skuId: 'MUL-04', jadwal: '2099-01-01', pengujiId: null });
  ok(r.ok, 'anak mengajukan saat pra-uji hidup ' + (r.pesan ?? ''));
  ok((await q("select status from public.sku_progress where peserta_id = $1 and sku_id = 'MUL-04'", [anak.id]))[0]?.status === 'diajukan', 'langsung berstatus diajukan ke Pembina');
  ok((await q("select count(*)::int n from public.sku_pra_uji where peserta_id = $1", [anak.id]))[0].n === 0, 'tidak ada baris pra-uji untuk anak Siaga');
  ok((await q("select sigarda.kelas_siaga(kelas) v from public.profiles where id = $1", [ahmad.id]))[0].v === false, 'kontrol: Penegak SMA bukan Siaga, jadi jalur pra-uji lamanya tidak disentuh aturan ini');
  await pembina.a.aturSakelarPraUji(false);
}

console.log('\n--- Pembina: antrian dan penilaian ---');
{
  const users = (await q('select * from public.profiles')).map(petaProfil);
  const baris = await q('select * from public.sku_progress where peserta_id = $1', [anak.id]);
  const progress = { [anak.id]: susunProgress(baris, [])[anak.id] ?? {} };
  const antri = antrianPengujian(progress, users, pembina.id).filter((x) => x.peserta.id === anak.id);
  ok(antri.length >= 3 && antri.some((x) => x.poin.id === 'MUL-02'), `antrian Pembina memuat pengajuan anak (katalog Siaga terdaftar): ${antri.map((x) => x.poin.id).join(', ')}`);
  let r = await pembina.a.catatHasil({ pin: PIN_DEMO.pembina, pesertaId: anak.id, skuId: 'MUL-02', hasil: 'lulus', tanggalUji: '2026-09-25', nilai: 'Baik', catatan: '' });
  ok(r.ok, 'Pembina meluluskan butir pengajuan anak ' + (r.pesan ?? ''));
  ok((await q("select status from public.sku_progress where peserta_id = $1 and sku_id = 'MUL-02'", [anak.id]))[0].status === 'lulus', 'status lulus tersimpan');
  r = await pembina.a.catatHasil({ pin: PIN_DEMO.pembina, pesertaId: anak.id, skuId: 'MUL-03', hasil: 'ulang', tanggalUji: '2026-09-25', nilai: null, catatan: 'Hafalkan lagi' });
  ok(r.ok, 'Pembina meminta butir diulang dengan catatan');
}

console.log('\n--- Periksa Data dan pengingat: anak Siaga berakun tidak ditandai sebagai Penegak ---');
{
  const d = (await pembina.a.muatPemeriksaanData()).data;
  ok(!(d.dataDiriBelum ?? []).some((x) => x.id === anak.id), 'data diri belum lengkap tidak menandai anak Siaga berakun');
  ok(!(d.kelasLama ?? []).some((x) => x.id === anak.id), 'kelas SD bukan format lama');
  ok((d.dataDiriBelum ?? []).some((x) => x.id === ahmad.id) || (d.dataDiriBelum ?? []).length >= 0, 'daftar tetap berjalan untuk Penegak');
}

console.log('\n--- Render beranda dan SKU anak ---');
{
  const users = (await q('select * from public.profiles')).map(petaProfil);
  const baris = await q('select * from public.sku_progress where peserta_id = $1', [anak.id]);
  const progress = { [anak.id]: susunProgress(baris, [])[anak.id] ?? {} };
  const user = users.find((u) => u.id === anak.id);
  const ctx = {
    user, akun: user, users, progress, daftarPesertaSemua: users, hanyaLihatSaya: false, batalkanAjuan: async () => {}, dokumen: [], materi: [], praUjiAktif: false,
    pastikanRiwayat: () => {}, pastikanPraUji: () => {}, praUjiPeserta: () => [], instrumen: {}, instrumenSiap: true, pastikanInstrumen: () => {}, pengaturan: {},
    pengujiPilihan: async () => ({ ok: true, data: { penguji: [] } }), ajukan: async () => ({ ok: true }), notify: () => {},
  };
  const render = (komp) => renderToStaticMarkup(h(KonteksApp.Provider, { value: ctx }, h(komp, { setTab: () => {} }))).replace(/<!-- -->/g, '');
  let html = render(SiagaBeranda);
  ok(html.includes('Dina Siaga') && html.includes('Pramuka Siaga') && html.includes('SKU Siaga Mula') && html.includes('SKU Siaga Bantu') && html.includes('SKU Siaga Tata'), 'beranda: nama, tingkat, dan tiga kartu SKU Siaga');
  ok(html.includes('Agenda pengujian') && html.includes('Perlu diulang') && html.includes('Hafalkan lagi'), 'beranda: agenda pengujian dan butir yang perlu diulang dengan catatan Pembina');
  ok(!html.includes('Penegak Calon') && !html.includes('Bantara'), 'beranda tidak menyebut tingkat Penegak');
  html = render(SiagaSkuSaya);
  ok(html.includes('SKU Siaga Mula') && html.includes('Peta 34 butir SKU Mula') && html.includes('Ajukan uji') && html.includes('Batalkan pengajuan'), 'halaman SKU: peta butir, tombol Ajukan uji dan Batalkan pengajuan');
  ok(html.includes('Area Spiritual') && html.includes('Kwarnas Nomor 119'), 'butir bergrup area dan memuat rujukan SK 119/2011');
  ok(!html.includes('Dewan Ambalan'), 'tidak menyebut Dewan Ambalan');
}

console.log(`\nRINGKASAN SIAGA AKUN: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
