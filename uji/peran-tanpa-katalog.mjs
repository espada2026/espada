// Peran turunan anak Siaga dihitung di AppContext saat masuk, SEBELUM halaman Siaga (yang mendaftarkan katalog Mula/Bantu/Tata) dimuat.
// Tanpa katalog terdaftar, perhitungan tidak boleh melempar galat (layar putih di produksi: "Cannot read properties of undefined (reading 'butir')"),
// dan hasilnya benar sesudah katalog terdaftar. Berkas ini SENGAJA tidak mengimpor data/skuSiaga di awal.
import { SEMUA_TINGKAT } from '../src/data/skuData.js';
import { pesertaDenganPeran, peranPeserta } from '../src/lib/skuLogic.js';

let g = 0, l = 0;
const ok = (c, m) => { if (c) { l++; console.log('ok   :', m); } else { g++; console.log('GAGAL:', m); } };

ok(!SEMUA_TINGKAT.Mula && !SEMUA_TINGKAT.Bantu && !SEMUA_TINGKAT.Tata, 'prasyarat: katalog Siaga belum terdaftar');
const users = [
  { id: 'a1', role: 'peserta', kelas: '4', status: 'aktif' },
  { id: 'a2', role: 'peserta', kelas: '', tanpaAkun: true, status: 'aktif' },
  { id: 'p1', role: 'peserta', kelas: 'X-01', status: 'aktif' },
];
let hasil = null, galat = null;
try { hasil = pesertaDenganPeran({}, users); } catch (e) { galat = e.message; }
ok(!galat, 'pesertaDenganPeran tidak melempar galat tanpa katalog Siaga' + (galat ? ': ' + galat : ''));
ok(hasil?.[0]?.peran === 'siaga-mula' && hasil?.[1]?.peran === 'siaga-mula', 'anak Siaga: peran bawaan siaga-mula selama katalog belum ada');
ok(hasil?.[2]?.peran === 'calon-bantara', 'Penegak lama tidak terpengaruh');

console.log('\n--- Sesudah katalog Siaga terdaftar ---');
await import('../src/data/skuSiaga.js');
ok(!!SEMUA_TINGKAT.Mula, 'katalog Siaga terdaftar');
ok(peranPeserta({}, users[0]) === 'siaga-mula', 'tanpa progres tetap siaga-mula');
const semuaLulus = (tingkat) => Object.fromEntries(
  SEMUA_TINGKAT[tingkat].butir.flatMap((b) => (b.agama ? [] : [[b.id, { status: 'lulus', riwayat: [] }]])),
);
void semuaLulus;

console.log(`\nRINGKASAN PERAN-TANPA-KATALOG: ${l} lulus, ${g} gagal`);
process.exit(g ? 1 : 0);
