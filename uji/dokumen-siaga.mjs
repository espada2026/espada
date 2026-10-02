// Pramuka Siaga, Fase 9: dasbor Admin, footer, laporan, kartu SKU, Surat Tanda Lulus, dan piagam pelantikan untuk anggota Siaga.
// Murni di klien (render sisi server dengan konteks palsu); sisi server (token QR surat Siaga) diuji di uji/migrasi-dokumen-siaga.mjs.
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import '../src/data/skuSiaga.js';
import { daftarPoin } from '../src/lib/skuLogic.js';
import { rekapPerBarung, rekapSiaga, ringkasRekapSiaga } from '../src/lib/rekapSiagaLogic.js';
import { rekapKeanggotaanSiaga, rekapPencapaianSiaga, tahapSiaga } from '../src/lib/laporanLogic.js';
import { susunLaporanTahunanXlsx } from '../src/lib/exportLaporanTahunan.js';
import { KonteksApp } from '../src/context/AppContext.jsx';
import { KartuSku, SuratTandaLulus, tingkatSiagaSku } from '../src/components/DokumenSku.jsx';
import PiagamPelantikanSiaga from '../src/components/PiagamPelantikanSiaga.jsx';
import CetakLaporanTahunan from '../src/components/CetakLaporanTahunan.jsx';
import Footer from '../src/components/Footer.jsx';

let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };
const akar = process.cwd().replace(/\\/g, '/');
const sumber = (j) => readFileSync(`${akar}/${j}`, 'utf8');

const anak = (id, nama, kelas, extra = {}) => ({ id, nama, kelas, nis: `9${id}`, role: 'peserta', status: 'aktif', agama: 'Islam', jenisKelamin: 'L', ...extra });
const users = [
  anak('a', 'Anak A', '4A', { perindukan: 'Melati', barung: 'Kenari', jenisKelamin: 'L' }),
  anak('b', 'Anak B', '4B', { perindukan: 'Melati', barung: 'Kenari', jenisKelamin: 'P' }),
  anak('c', 'Anak C', '5', { perindukan: 'Melati', barung: 'Nuri', tanpaAkun: true, jenisKelamin: 'P' }),
  anak('d', 'Anak D', '6A', { status: 'nonaktif' }),
  anak('e', 'Anak E', '3'),
  { id: 'p', nama: 'Penegak P', kelas: 'X-01', role: 'peserta', status: 'aktif', agama: 'Islam', jenisKelamin: 'L' },
  { id: 'pb', nama: 'Pak Pembina', role: 'penguji', jabatan: 'Pembina', status: 'aktif' },
];
const lulusSemua = (id, tingkat, tgl) => Object.fromEntries(daftarPoin(tingkat, 'Islam').map((u) => [u.id, { status: 'lulus', tanggalUji: tgl, pengujiId: 'pb', verifikasi: 'VRF-0000001' }]));
const progress = {
  a: { ...lulusSemua('a', 'Mula', '2026-08-10') }, // selesai Mula
  b: { ...lulusSemua('b', 'Mula', '2026-07-05'), ...lulusSemua('b', 'Bantu', '2026-09-20'), ...lulusSemua('b', 'Tata', '2026-09-28') }, // selesai Tata
  c: { [daftarPoin('Mula', 'Islam')[0].id]: { status: 'lulus', tanggalUji: '2026-09-01' } }, // sebagian
};

console.log('--- rekapSiaga (dasbor Admin) ---');
{
  const rekap = rekapSiaga(progress, users);
  ok(rekap.map((r) => r.user.nama).sort().join() === 'Anak A,Anak B,Anak C,Anak E', 'hanya anggota Siaga aktif (Penegak dan nonaktif tidak)');
  const ra = rekap.find((r) => r.user.id === 'a');
  ok(ra.mula.persen === 100 && ra.bantu.persen === 0 && ra.tglMula === '2026-08-10', 'anak A: Mula selesai (tanggal lulus), Bantu belum');
  const ringkas = ringkasRekapSiaga(rekap);
  ok(ringkas.jumlah === 4 && ringkas.mula === 2 && ringkas.bantu === 1 && ringkas.tata === 1, `ringkasan: 4 anak, Mula 2, Bantu 1, Tata 1 (${JSON.stringify(ringkas)})`);
  const barung = rekapPerBarung(rekap);
  ok(barung.map((g) => g.barung).join('|') === 'Kenari (Melati)|Nuri (Melati)|Belum berbarung', 'barung diurutkan nama dan "Belum berbarung" paling akhir: ' + barung.map((g) => g.barung).join('|'));
  const kenari = barung[0];
  ok(kenari.jumlah === 2 && kenari.mulaLulus === 2 && kenari.bantuLulus === 1 && kenari.tataLulus === 1, 'angka barung Kenari benar');
  ok(ringkasRekapSiaga([]).jumlah === 0 && ringkasRekapSiaga([]).rataMula === 0, 'rekap kosong tidak galat');
}

console.log('\n--- Laporan tahunan Siaga ---');
{
  ok(tahapSiaga(progress, users[0]) === 'menempuhBantu' && tahapSiaga(progress, users[1]) === 'selesaiTata' && tahapSiaga(progress, users[2]) === 'menempuhMula', 'tahap SKU anak');
  const kel = rekapKeanggotaanSiaga(users, progress);
  const total = kel.find((r) => r.tingkat === 'Total');
  ok(total.total === 4 && total.lakiLaki === 2 && total.perempuan === 2, 'keanggotaan: 4 anak aktif (2 putra, 2 putri); Penegak dan nonaktif tidak ikut');
  ok(kel.find((r) => r.tingkat === 'Kelas 4').total === 2 && kel.find((r) => r.tingkat === 'Kelas 6').total === 0 && !kel.some((r) => r.tingkat === 'Lainnya'), 'per kelas: kelas 4 dua anak, kelas 6 nol (nonaktif), tanpa baris Lainnya');
  ok(total.menempuhMula + total.menempuhBantu + total.menempuhTata + total.selesaiTata === total.total, 'tahap menjumlah ke total');
  const sku = rekapPencapaianSiaga(users, progress, '2026-07-01', '2027-06-30');
  ok(sku.mulaLulus === 2 && sku.bantuLulus === 1 && sku.tataLulus === 1, `pencapaian periode: ${JSON.stringify(sku)}`);
  const sempit = rekapPencapaianSiaga(users, progress, '2026-09-01', '2026-09-30');
  ok(sempit.mulaLulus === 0 && sempit.bantuLulus === 1 && sempit.tataLulus === 1, 'pencapaian dibatasi rentang tanggal (Mula b/a di luar rentang)');
  const data = { siaga: true, rentang: { mulai: '2026-07-01', akhir: '2027-06-30', label: 'Tahun Ajaran 2026/2027' }, keanggotaan: kel, pengurus: [], kegiatan: [], sku, kehadiran: { pertemuan: 3, rata: 80, baik: 2, rendah: 1 }, iuran: { total: 1000, totalSusulan: 0, kali: 4 } };
  const lembar = susunLaporanTahunanXlsx(data);
  ok(!lembar.some((l) => l.nama === 'Kepengurusan') && lembar.find((l) => l.nama === 'Pencapaian SKU').baris.some((b) => /SKU Mula/.test(b.u)), 'Excel Siaga: tanpa lembar Dewan, pencapaian Mula/Bantu/Tata');
  ok(lembar.find((l) => l.nama === 'Rekap Keanggotaan').kolom[0].header === 'Kelas', 'Excel Siaga: keanggotaan per kelas');
  const html = renderToStaticMarkup(h(CetakLaporanTahunan, data));
  ok(html.includes('Rekap Keanggotaan Siaga') && html.includes('Kelas 4') && html.includes('SKU Mula') && html.includes('Latihan Perindukan') && !html.includes('Dewan Ambalan') && !html.includes('Bantara'), 'cetak Siaga: istilah Siaga, tanpa Dewan Ambalan dan Bantara');
}

console.log('\n--- Kartu SKU, Surat Tanda Lulus, Piagam ---');
{
  const peserta = users[1];
  const konteks = { users, progress, notify: () => {} };
  const tampil = (el) => renderToStaticMarkup(h(KonteksApp.Provider, { value: konteks }, el));
  ok(tingkatSiagaSku('Mula') && tingkatSiagaSku('Tata') && !tingkatSiagaSku('Bantara'), 'tingkatSiagaSku');
  const kartu = tampil(h(KartuSku, { peserta, tingkat: 'Tata' }));
  ok(kartu.includes('KARTU KEMAJUAN SKU SIAGA TATA') && kartu.includes('Kenari (Melati)') && !kartu.includes('Sangga') && kartu.includes('VRF-0000001'), 'kartu SKU Siaga: judul tingkat, barung, kode verifikasi, tanpa sangga/peran Penegak');
  const kartuPenegak = tampil(h(KartuSku, { peserta: { ...users[5], sangga: 'Elang', peran: 'calon-bantara' }, tingkat: 'Bantara' }));
  ok(kartuPenegak.includes('SKU PENEGAK BANTARA') && kartuPenegak.includes('Sangga') && kartuPenegak.includes('Elang'), 'kartu SKU Penegak tetap seperti semula');
  const stl = tampil(h(SuratTandaLulus, { peserta, tingkat: 'Tata', token: 'a'.repeat(32) }));
  ok(stl.includes('Surat Tanda Lulus') && stl.includes('Siaga Tata') && stl.includes('diuji oleh Pembina') && !stl.includes('Dewan Ambalan') && stl.includes('Pindai untuk memeriksa keaslian'), 'STL Siaga: tingkat Siaga Tata, Pembina saja, QR');
  const stlTanpaQr = tampil(h(SuratTandaLulus, { peserta, tingkat: 'Tata' }));
  ok(!stlTanpaQr.includes('Pindai untuk memeriksa keaslian') && stlTanpaQr.includes('Kenari'), 'STL Siaga tanpa token: tercetak tanpa QR');
  const piagam = tampil(h(PiagamPelantikanSiaga, { peserta, pelantikan: { tingkat: 'bantu', tanggal: '2026-09-21', tempat: 'Lapangan SD', catatan: '' } }));
  ok(piagam.includes('Piagam Pelantikan') && piagam.includes('Tingkat Bantu') && piagam.includes('Anak B') && piagam.includes('Lapangan SD') && piagam.includes('barung Kenari') && piagam.includes('DILANTIK'), 'piagam pelantikan: tingkat, nama, tempat, barung');
}

console.log('\n--- Footer dan rute halaman ---');
{
  const footer = renderToStaticMarkup(h(Footer, {}));
  ok(footer.includes('SKU Mula') && footer.includes('SKU Bantu') && footer.includes('SKU Tata') && footer.includes('Siaga Garuda') && !footer.includes('Bantara') && !footer.includes('Portofolio'), 'footer memuat jalur Siaga, tanpa Bantara dan Portofolio');
  const src = sumber('src/components/Footer.jsx');
  ok(!/data\/skuData|portofolioData/.test(src), 'footer tidak mengimpor katalog SKU (menjaga JS awal)');
  const dasbor = sumber('src/pages/AdminDashboard.jsx');
  ok(!/Bantara|Laksana|sangga/i.test(dasbor) && /rekapSiaga/.test(dasbor), 'dasbor Admin tidak lagi menyebut Bantara, Laksana, sangga');
  ok(!/Garuda|portofolio|Jumat/.test(sumber('src/components/RingkasanGudep.jsx').replace(/Siaga Garuda/g, '')), 'ringkasan gudep tanpa portofolio Garuda dan "Jumat"');
  ok(!/'raport'/.test(sumber('src/App.jsx')), 'menu Raport (instrumen Penegak) sudah dihapus dari aplikasi');
  const cetak = sumber('src/pages/CetakDokumen.jsx');
  ok(/PiagamPelantikanSiaga/.test(cetak) && /DAFTAR_TINGKAT_SIAGA/.test(cetak), 'halaman Cetak memuat piagam dan tingkat Siaga');
}

console.log(`\nRINGKASAN DOKUMEN-SIAGA: ${lulus} lulus, ${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
