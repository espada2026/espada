// Fase 1 landing page: pemilihan tampilan awal (src/lib/ruteLogic.js) dan skrip kecil di index.html yang menyembunyikan halaman muka hasil prarender bagi yang akan masuk
// ke aplikasi. Keduanya harus memilih SAMA pada semua kombinasi alamat, hash, dan sesi.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pilihRute, ruteSesudahHash, sesiTersimpan } from '../src/lib/ruteLogic.js';

let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };
const P = process.cwd().replace(/\\/g, '/');

const penyimpan = (kunci) => ({ length: kunci.length, key: (i) => kunci[i] });

console.log('--- sesiTersimpan ---');
{
  ok(sesiTersimpan(penyimpan(['sb-abcdxyz-auth-token'])), 'kunci sesi Supabase terdeteksi');
  ok(sesiTersimpan(penyimpan(['x', 'sigarda_lokal_sesi'])), 'kunci sesi mode lokal terdeteksi');
  ok(!sesiTersimpan(penyimpan(['tema', 'sigarda_tampilan_x', 'sb-abcdxyz-lain'])), 'kunci lain tidak dianggap sesi');
  ok(!sesiTersimpan(penyimpan([])) && !sesiTersimpan(null) && !sesiTersimpan(undefined), 'kosong atau tanpa penyimpanan = belum masuk');
  ok(!sesiTersimpan({ get length() { throw new Error('diblokir'); }, key: () => null }), 'penyimpanan yang melempar galat = belum masuk (tidak pernah melempar)');
}

console.log('\n--- pilihRute: aturan ---');
{
  const A = { search: '', hash: '', sesi: false, lokal: false };
  ok(pilihRute(A) === 'landing', 'alamat dasar tanpa sesi = halaman muka');
  ok(pilihRute({ ...A, sesi: true }) === 'aplikasi', 'ada sesi tersimpan = aplikasi');
  ok(pilihRute({ ...A, hash: '#masuk' }) === 'aplikasi', '#masuk = aplikasi (halaman masuk)');
  ok(pilihRute({ ...A, hash: '#beranda', sesi: true }) === 'landing', '#beranda = halaman muka walau sudah masuk');
  ok(pilihRute({ ...A, hash: '#tentang', sesi: true }) === 'aplikasi' && pilihRute({ ...A, hash: '#tentang' }) === 'landing', 'jangkar biasa (#tentang) tidak mengubah pilihan awal');
  ok(pilihRute({ ...A, search: '?v=VRF-ABC' }) === 'verifikasi' && pilihRute({ ...A, search: '?v=' }) === 'verifikasi' && pilihRute({ ...A, search: '?v' }) === 'verifikasi', '?v= (juga kosong) = halaman verifikasi');
  ok(pilihRute({ ...A, search: '?berkas=abc', sesi: true }) === 'berkas', '?berkas= = tautan berbagi, walau ada sesi');
  ok(pilihRute({ ...A, search: '?v=x', hash: '#beranda' }) === 'verifikasi', 'halaman publik mengalahkan #beranda');
  for (const p of ['?masuk=pembina', '?data=penuh', '?ulang=1', '?buka=notifikasi', '?a=1&masuk=admin']) ok(pilihRute({ ...A, search: p }) === 'aplikasi', `${p} = aplikasi (mode uji dan klik notifikasi)`);
  ok(pilihRute({ ...A, search: '?utm_source=wa' }) === 'landing', 'parameter pelacak biasa tetap halaman muka');
  ok(pilihRute({ ...A, lokal: true }) === 'aplikasi' && pilihRute({ ...A, lokal: true, hash: '#beranda' }) === 'landing', 'mode lokal = aplikasi, kecuali #beranda');
}

console.log('\n--- ruteSesudahHash ---');
{
  ok(ruteSesudahHash('landing', '#masuk') === 'aplikasi' && ruteSesudahHash('aplikasi', '#beranda') === 'landing', '#masuk dan #beranda memindahkan');
  ok(ruteSesudahHash('landing', '#kontak') === 'landing' && ruteSesudahHash('aplikasi', '#tentang') === 'aplikasi' && ruteSesudahHash('landing', '') === 'landing', 'jangkar lain dan hash kosong tidak memindahkan');
  ok(ruteSesudahHash('verifikasi', '#masuk') === 'verifikasi' && ruteSesudahHash('berkas', '#beranda') === 'berkas', 'halaman publik tidak dipindahkan oleh hash');
}

console.log('\n--- Skrip di index.html = pilihRute ---');
{
  const html = readFileSync(`${P}/index.html`, 'utf8');
  const skrip = /<script id="pilih-rute">([\s\S]*?)<\/script>/.exec(html)?.[1];
  ok(!!skrip, 'index.html memuat skrip pilih-rute');
  const jalankan = ({ search, hash, kunci }) => {
    const dokumen = { documentElement: { className: '' } };
    const konteks = { location: { search, hash }, localStorage: penyimpan(kunci), document: dokumen };
    vm.runInNewContext(skrip, konteks);
    return dokumen.documentElement.className === 'app' ? 'app' : '';
  };
  const SEARCH = ['', '?v=VRF-1', '?v=', '?v', '?berkas=t', '?masuk=admin', '?data=penuh', '?ulang=1', '?buka=notifikasi', '?utm_source=wa', '?a=1&v=2', '?a=1&masuk=x', '?vv=1', '?xberkas=1', '?x=v'];
  const HASH = ['', '#masuk', '#beranda', '#tentang', '#kontak'];
  const KUNCI = [[], ['sb-abcdxyz-auth-token'], ['sigarda_lokal_sesi'], ['tema']];
  let n = 0;
  const beda = [];
  for (const search of SEARCH) for (const hash of HASH) for (const kunci of KUNCI) {
    const sesi = sesiTersimpan(penyimpan(kunci));
    const harapan = pilihRute({ search, hash, sesi, lokal: false }) === 'landing' ? '' : 'app';
    const hasil = jalankan({ search, hash, kunci });
    n++;
    if (hasil !== harapan) beda.push(`${search || '(kosong)'} ${hash || '(tanpa hash)'} ${JSON.stringify(kunci)}: skrip ${hasil || 'landing'}, pilihRute ${harapan || 'landing'}`);
  }
  ok(beda.length === 0, `${n} kombinasi: skrip index.html dan pilihRute memilih sama${beda.length ? ' | BEDA: ' + beda.slice(0, 5).join(' ; ') : ''}`);
  // penyimpanan diblokir: skrip tidak boleh melempar galat dan tetap mengikuti alamat
  const dokumen = { documentElement: { className: '' } };
  vm.runInNewContext(skrip, { location: { search: '?masuk=x', hash: '' }, get localStorage() { throw new Error('diblokir'); }, document: dokumen });
  ok(dokumen.documentElement.className === 'app', 'penyimpanan diblokir: skrip tetap berjalan dan mengikuti alamat');
}

console.log(`\nRINGKASAN RUTE: ${lulus} lulus, ${gagal} GAGAL.`);
if (gagal) process.exit(1);
