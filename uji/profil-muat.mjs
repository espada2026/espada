// Tahap L2-A: alat pemodelan kinerja (scripts/profil/jaringan.mjs) — hanya model murni, tanpa PGlite, jadi cepat dan tak menyentuh Supabase.
import { simulasi, perkirakanSiap, ringkasRantai, PROFIL_JARINGAN, RTT_SERVER_MS } from '../scripts/profil/jaringan.mjs';
import { berkasAwalDariHtml, memuatKlienProduksi } from '../scripts/profil/berkasAwal.mjs';

let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };

console.log('--- simulasi (jaringan) ---');
{
  const t1 = simulasi([[{ byte: 1000 }]], { kbps: 8000, rttMs: 100 });
  ok(t1 > 100, `satu permintaan paga sekurangnya satu bolak-balik (${t1.toFixed(0)} md)`);
  const rantaiTunggal = [[{ byte: 1000 }, { byte: 1000 }]];
  const rantaiParalel = [[{ byte: 1000 }], [{ byte: 1000 }]];
  const tBerurutan = simulasi(rantaiTunggal, { kbps: 8000, rttMs: 100 });
  const tParalel = simulasi(rantaiParalel, { kbps: 8000, rttMs: 100 });
  ok(tBerurutan > tParalel, `dua permintaan BERURUTAN (satu rantai) lebih lama daripada dua rantai PARALEL (${tBerurutan.toFixed(0)} vs ${tParalel.toFixed(0)} md)`);
  const banyakByte = simulasi([[{ byte: 5_000_000 }]], { kbps: 8000, rttMs: 100 });
  const sedikitByte = simulasi([[{ byte: 1000 }]], { kbps: 8000, rttMs: 100 });
  ok(banyakByte > sedikitByte * 5, `permintaan lebih besar makan waktu lebih lama (${banyakByte.toFixed(0)} vs ${sedikitByte.toFixed(0)} md)`);
  const lambat = simulasi([[{ byte: 100000 }]], { kbps: 400, rttMs: 400 });
  const cepat = simulasi([[{ byte: 100000 }]], { kbps: 20000, rttMs: 0 });
  ok(lambat > cepat, `Slow 3G lebih lambat daripada Wi-Fi untuk data yang sama (${lambat.toFixed(0)} vs ${cepat.toFixed(0)} md)`);
  const dua = simulasi([[{ byte: 1_000_000 }], [{ byte: 1_000_000 }]], { kbps: 8000, rttMs: 0 });
  const satuBesar = simulasi([[{ byte: 2_000_000 }]], { kbps: 8000, rttMs: 0 });
  ok(Math.abs(dua - satuBesar) < 5, `pita lebar dibagi rata: dua rantai paralel selesai sama cepat dengan satu rantai dua kali lebih besar (${dua.toFixed(0)} vs ${satuBesar.toFixed(0)} md)`);
  ok(simulasi([[]], { kbps: 8000, rttMs: 100 }) === 0, 'rantai kosong = 0 md, tidak macet');
}

console.log('\n--- ringkasRantai ---');
{
  const r = ringkasRantai([[{ byte: 100 }, { byte: 200 }], [{ byte: 50 }]]);
  ok(r.permintaan === 3 && r.byte === 350 && r.rantaiTerpanjang === 2, `menghitung permintaan, byte, dan rantai terpanjang dengan benar (${JSON.stringify(r)})`);
}

console.log('\n--- perkirakanSiap ---');
{
  const rantai = [[{ byte: 20000 }]];
  const dingin = perkirakanSiap({ rantai, aplikasi: { html: 600, js: 200000, css: 8000 }, jaringan: PROFIL_JARINGAN.find((j) => j.kunci === 'fast3g') });
  const hangat = perkirakanSiap({ rantai, aplikasi: null, jaringan: PROFIL_JARINGAN.find((j) => j.kunci === 'fast3g') });
  ok(dingin.totalMs > hangat.totalMs, `kunjungan pertama lebih lama daripada kunjungan ulang (${dingin.totalMs.toFixed(0)} vs ${hangat.totalMs.toFixed(0)} md)`);
  ok(dingin.appMs > 0 && hangat.appMs >= 0, 'komponen appMs masuk akal untuk kedua kasus');
  const cpuBiasa = perkirakanSiap({ rantai, aplikasi: null, jaringan: PROFIL_JARINGAN.find((j) => j.kunci === 'wifi'), cpu: 1 });
  const cpuLambat = perkirakanSiap({ rantai, aplikasi: null, jaringan: PROFIL_JARINGAN.find((j) => j.kunci === 'wifi'), cpu: 6 });
  ok(cpuLambat.jsMs > cpuBiasa.jsMs && cpuLambat.totalMs > cpuBiasa.totalMs, `HP lebih lambat (cpu 6x) menambah waktu (${cpuBiasa.totalMs.toFixed(0)} vs ${cpuLambat.totalMs.toFixed(0)} md)`);
  const banyakData = perkirakanSiap({ rantai: [[{ byte: 20000 }]], aplikasi: null, jaringan: PROFIL_JARINGAN.find((j) => j.kunci === 'slow3g'), rawByte: 20_000_000 });
  const sedikitData = perkirakanSiap({ rantai: [[{ byte: 20000 }]], aplikasi: null, jaringan: PROFIL_JARINGAN.find((j) => j.kunci === 'slow3g'), rawByte: 200_000 });
  ok(banyakData.prosesMs > sedikitData.prosesMs, `mengolah JSON mentah yang besar (mis. Pembina) lebih lambat daripada yang kecil (${banyakData.prosesMs.toFixed(0)} vs ${sedikitData.prosesMs.toFixed(0)} md)`);
}

console.log('\n--- berkas awal (dibaca dari index.html) ---');
{
  const html = '<head><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Baloo+2" rel="stylesheet">' +
    '<script type="module" crossorigin src="/assets/index-AAA.js"></script><link rel="modulepreload" crossorigin href="/assets/vendor-BBB.js"><link rel="stylesheet" crossorigin href="/assets/index-CCC.css"></head>';
  const h = berkasAwalDariHtml(html);
  ok(h.js.join() === 'assets/index-AAA.js,assets/vendor-BBB.js', `skrip modul + modulepreload dihitung sebagai JS awal (${h.js.join()})`);
  ok(h.css.join() === 'assets/index-CCC.css', `hanya stylesheet di assets (font Google tidak dihitung): ${h.css.join()}`);
  ok(berkasAwalDariHtml(html.replace('/assets/', '/sigarda/assets/'), '/sigarda/').js.length === 2, 'alamat dengan base (/sigarda/) dibaca benar');
  ok(berkasAwalDariHtml('<html></html>').js.length === 0, 'index.html tanpa skrip = tidak ada berkas awal');
  ok(!berkasAwalDariHtml(html).js.includes('assets/index-lazy.js'), 'potongan malas yang kebetulan bernama index-* tidak ikut terhitung (tidak ada di index.html)');
}

console.log('\n--- pagar ukuran: hanya build produksi yang sah ---');
{
  ok(memuatKlienProduksi('a("rest/v1");b("auth/v1");c("functions/v1")'), 'build dengan klien Supabase dianggap produksi');
  ok(!memuatKlienProduksi('const LOKAL=true;render()'), 'build tanpa klien Supabase (mis. VITE_BACKEND=lokal) DITOLAK sebagai dasar ukuran');
  ok(!memuatKlienProduksi('rest/v1 saja'), 'klien setengah (hanya REST) ditolak');
}

ok(RTT_SERVER_MS > 0 && RTT_SERVER_MS < 500, `RTT_SERVER_MS masuk akal untuk Tokyo (${RTT_SERVER_MS} md; perbarui bila wilayah proyek Supabase berubah)`);

console.log(`\nRINGKASAN: ${lulus} lulus, ${gagal} GAGAL.`);
if (gagal) process.exit(1);
