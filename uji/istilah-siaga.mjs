// Istilah Pramuka Siaga pada layar bersama (bukan istilah Penegak) dan peran turunan anggota Siaga.
import { readFileSync } from 'node:fs';
import { PERAN, URUTAN_PERAN, peranPeserta } from '../src/lib/skuLogic.js';
import '../src/data/skuSiaga.js';

const P = process.cwd().replace(/\\/g, '/');
let g = 0, l = 0;
const ok = (c, m) => { if (c) { l++; console.log('ok   :', m); } else { g++; console.log('GAGAL:', m); } };

console.log('--- Peran turunan anggota Siaga ---');
const anak = { id: 'a1', kelas: '4', role: 'peserta' };
ok(peranPeserta([], anak) === 'siaga-mula', 'anak kelas SD tanpa progres = menempuh Mula (bukan Calon Bantara)');
ok(peranPeserta([], { ...anak, kelas: '', tanpaAkun: true }) === 'siaga-mula', 'anak tanpa akun juga memakai peran Siaga');
ok(peranPeserta([], { id: 'p1', kelas: 'X-01', role: 'peserta' }) === 'calon-bantara', 'Penegak lama tetap Calon Bantara');
for (const k of ['siaga-mula', 'siaga-bantu', 'siaga-tata', 'siaga-garuda']) ok(PERAN[k] && URUTAN_PERAN.includes(k) && /Siaga/.test(PERAN[k].label), `peran ${k} berlabel Siaga`);

console.log('\n--- Layar bersama tanpa istilah Penegak/Dewan Ambalan ---');
const BERSIH = ['pages/Absensi.jsx', 'pages/Iuran.jsx', 'pages/TindakLanjut.jsx', 'pages/ResetPin.jsx', 'pages/Materi.jsx', 'components/KasIuran.jsx', 'components/LembarIuran.jsx',
  'components/RekapIuran.jsx', 'components/KartuIuran.jsx', 'components/FormWhatsapp.jsx', 'components/Login.jsx', 'components/PanelFaq.jsx', 'components/KartuPelantikanSaya.jsx', 'pages/KelolaMateri.jsx'];
for (const f of BERSIH) {
  const baris = readFileSync(`${P}/src/${f}`, 'utf8').split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b) && !/id: 'sku-penegak-2011'|id: 'admin-satuan-041-1995'|^\s*'Dewan Ambalan':/.test(b));
  const sisa = baris.filter((b) => /Penegak|Dewan Ambalan|Bantara|Laksana|latihan Jumat/.test(b));
  ok(sisa.length === 0, `${f}: tanpa istilah Penegak${sisa.length ? ' -> ' + sisa[0].trim().slice(0, 80) : ''}`);
}

console.log(`\nRINGKASAN ISTILAH-SIAGA: ${l} lulus, ${g} gagal`);
process.exit(g ? 1 : 0);
