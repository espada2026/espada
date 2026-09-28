// Pensil sunting di halaman muka (hanya untuk pengurus yang sedang masuk) dan tombol bagikan WhatsApp pada berita dan galeri.
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { Berita, Galeri, Kontak, MediaSosial, Prestasi, Tentang, TanyaJawab } from '../src/landing/bagian.jsx';
import { ALAMAT_SITUS } from '../src/landing/landingData.js';
import { renderBeranda } from '../src/landing/prarender.jsx';
import { untukForm, tautanBagikanWa } from '../src/lib/berandaLogic.js';
import { GUDEP_BAWAAN } from '../src/config.js';
import { KUNCI_PETUNJUK, TAB_KELOLA, bacaPetunjuk, bolehSunting, parameterKelola, petunjukDari, simpanPetunjuk, tautanSunting } from '../src/lib/suntingLogic.js';

let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };
const P = process.cwd().replace(/\\/g, '/');
const teks = (el) => renderToStaticMarkup(el);
const G = GUDEP_BAWAAN;
const kosong = untukForm(null);
const penyimpanPalsu = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };

console.log('--- Logika petunjuk sunting (murni) ---');
{
  ok(petunjukDari({ role: 'admin' }) === 'pembina' && petunjukDari({ role: 'penguji', jabatan: 'Pembina' }) === 'pembina', 'Admin dan Pembina: petunjuk "pembina"');
  ok(petunjukDari({ role: 'penguji', jabatan: 'Dewan Ambalan' }) === 'pengurus' && petunjukDari({ role: 'peserta', jabatanDewan: 'Sekretaris' }) === 'pengurus', 'Dewan Ambalan (akun lama dan Penegak berjabatan): petunjuk "pengurus"');
  ok(petunjukDari({ role: 'peserta' }) === '' && petunjukDari(null) === '' && petunjukDari({ role: 'peserta', jabatanDewan: 'Sekretaris', status: 'alumni' }) === '', 'Penegak biasa, tanpa pengguna, dan Penegak berjabatan yang sudah alumni: tanpa petunjuk');
  ok(TAB_KELOLA.every((t) => bolehSunting('pembina', t)) && bolehSunting('pengurus', 'berita') && !bolehSunting('pengurus', 'faq'), 'Pembina boleh semua tab; Dewan tidak boleh FAQ (sama dengan KelolaBeranda.jsx)');
  ok(!bolehSunting('', 'berita') && !bolehSunting('pembina', 'entah') && !bolehSunting('sembarang', 'berita'), 'tanpa petunjuk, tab tak dikenal, dan petunjuk tak dikenal: tidak boleh');
  ok(tautanSunting('berita') === './?buka=kelolaberanda&tab=berita', 'tautan sunting relatif ke tab');
  ok(parameterKelola('?buka=kelolaberanda&tab=galeri') === 'galeri' && parameterKelola('?buka=kelolaberanda&tab=entah') === 'kontak' && parameterKelola('?buka=kelolaberanda') === 'kontak', 'parameterKelola: tab tak dikenal atau kosong menjadi kontak');
  ok(parameterKelola('?buka=notifikasi') === null && parameterKelola('') === null && parameterKelola('?tab=berita') === null, 'parameterKelola: null bila bukan permintaan Kelola Beranda');
  const s = penyimpanPalsu();
  simpanPetunjuk('pembina', s);
  ok(s._m.get(KUNCI_PETUNJUK) === 'pembina' && bacaPetunjuk(true, s) === 'pembina', 'petunjuk disimpan dan dibaca');
  ok(bacaPetunjuk(false, s) === '', 'tanpa sesi tersimpan petunjuk diabaikan (keluar = pensil hilang)');
  simpanPetunjuk('', s);
  ok(!s._m.has(KUNCI_PETUNJUK) && bacaPetunjuk(true, s) === '', 'petunjuk kosong menghapus kunci');
  s.setItem(KUNCI_PETUNJUK, '<script>');
  ok(bacaPetunjuk(true, s) === '', 'nilai yang bukan petunjuk sah dianggap kosong');
  const rusak = { getItem() { throw new Error('diblokir'); }, setItem() { throw new Error('diblokir'); }, removeItem() { throw new Error('diblokir'); } };
  let galat = false;
  try { simpanPetunjuk('pembina', rusak); ok(bacaPetunjuk(true, rusak) === '', 'penyimpanan diblokir: tanpa pensil dan tanpa galat'); } catch { galat = true; }
  ok(!galat, 'penyimpanan diblokir tidak melempar galat');
}

console.log('\n--- Pensil sunting di bagian halaman muka ---');
{
  const berita = [{ kategori: 'kegiatan', judul: 'Berita A', ringkasan: '', isi: '', sampulUrl: '', terbitPada: '2026-09-20' }];
  const kartu = { Berita: h(Berita, { berita, sunting: 'pembina' }), Prestasi: h(Prestasi, { prestasi: [], sunting: 'pembina' }), Galeri: h(Galeri, { galeri: [], sunting: 'pembina' }),
    Tentang: h(Tentang, { G, kontak: kosong, pembina: {}, kamabigus: {}, sunting: 'pembina' }), Kontak: h(Kontak, { G, kontak: kosong, sunting: 'pembina' }),
    TanyaJawab: h(TanyaJawab, { sunting: 'pembina' }), MediaSosial: h(MediaSosial, { sosial: [{ platform: 'instagram', tautan: 'https://instagram.com/x', keterangan: '', gambarUrl: '' }], sunting: 'pembina' }) };
  const tabDari = { Berita: 'berita', Prestasi: 'prestasi', Galeri: 'galeri', Tentang: 'kontak', Kontak: 'kontak', TanyaJawab: 'faq', MediaSosial: 'sosial' };
  for (const [nama, el] of Object.entries(kartu)) {
    const t = teks(el);
    ok(t.includes(`href="./?buka=kelolaberanda&amp;tab=${tabDari[nama]}"`) && t.includes('aria-label="Sunting'), `${nama}: pensil menuju tab ${tabDari[nama]} untuk Pembina/Admin`);
  }
  const dewan = teks(h(TanyaJawab, { sunting: 'pengurus' }));
  ok(!dewan.includes('buka=kelolaberanda') && teks(h(Berita, { berita, sunting: 'pengurus' })).includes('tab=berita'), 'Dewan: pensil Berita ada, pensil Pertanyaan Umum (khusus Pembina/Admin) tidak');
  for (const [nama, el] of Object.entries({ Berita: h(Berita, { berita }), Kontak: h(Kontak, { G, kontak: kosong }), TanyaJawab: h(TanyaJawab, {}) })) {
    ok(!teks(el).includes('kelolaberanda'), `${nama}: tanpa petunjuk tidak ada pensil`);
  }
  ok(!renderBeranda().includes('kelolaberanda'), 'HTML prarender (dibaca mesin pencari) tidak memuat pensil sunting');
}

console.log('\n--- Tombol bagikan WhatsApp ---');
{
  const html = readFileSync(`${P}/index.html`, 'utf8');
  ok(html.includes(`<link rel="canonical" href="${ALAMAT_SITUS}" />`), 'ALAMAT_SITUS sama dengan canonical di index.html');
  const dekode = (href) => decodeURIComponent(/https:\/\/wa\.me\/\?text=([^"&]*)/.exec(href)[1]);
  const b = teks(h(Berita, { berita: [{ kategori: 'kegiatan', judul: 'Perkemahan <b>Jumat</b> & seru', ringkasan: '', isi: '', sampulUrl: '', terbitPada: '2026-09-20' }] }));
  const hrefB = /href="(https:\/\/wa\.me\/[^"]+)"/.exec(b)?.[1].replace(/&amp;/g, '&');
  ok(!!hrefB && dekode(hrefB) === `Perkemahan <b>Jumat</b> & seru\n${ALAMAT_SITUS}#berita` && /Bagikan lewat WhatsApp/.test(b), 'berita: pesan = judul + alamat situs#berita, tercantum benar walau berisi tanda khusus');
  ok(/rel="noopener noreferrer"/.test(b.slice(b.indexOf('wa.me') - 60, b.indexOf('wa.me') + 300)), 'tautan bagikan berita memakai rel="noopener noreferrer"');
  const g = teks(h(Galeri, { galeri: [{ judul: 'Perkemahan 2026', tautan: 'https://drive.google.com/x?a=1&b=2', sampulUrl: '', kelompok: 'perkemahan' }] }));
  const hrefG = /href="(https:\/\/wa\.me\/[^"]+)"/.exec(g)?.[1].replace(/&amp;/g, '&');
  ok(!!hrefG && dekode(hrefG) === 'Perkemahan 2026\nhttps://drive.google.com/x?a=1&b=2', 'galeri: pesan = judul + tautan album');
  ok(!/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/.test(g), 'kartu galeri tidak memuat tautan di dalam tautan (HTML tidak sah)');
  ok(g.includes('href="https://drive.google.com/x?a=1&amp;b=2"') && g.includes('Buka album'), 'tautan buka album tetap ada');
  ok(tautanBagikanWa('  a   b ', 'https://x.id/').endsWith(encodeURIComponent('a b\nhttps://x.id/')), 'teks dirapikan sebelum dibagikan');
}

console.log('\n--- Penyambungan di aplikasi (pembacaan sumber) ---');
{
  const app = readFileSync(`${P}/src/App.jsx`, 'utf8');
  const konteks = readFileSync(`${P}/src/context/AppContext.jsx`, 'utf8');
  const kelola = readFileSync(`${P}/src/pages/KelolaBeranda.jsx`, 'utf8');
  const landing = readFileSync(`${P}/src/landing/Landing.jsx`, 'utf8');
  ok(/simpanPetunjuk\(petunjukDari\(user\)\)/.test(app), 'Shell menulis petunjuk dari pengguna menurut tampilan');
  ok(/parameterKelola\(window\.location\.search\)/.test(app) && /user\.role !== 'peserta'/.test(app.slice(app.indexOf('parameterKelola(window'), app.indexOf('parameterKelola(window') + 400)), 'alamat ?buka=kelolaberanda membuka Kelola Beranda hanya bila bukan tampilan Penegak');
  ok(/<KelolaBeranda tabAwal=\{tabKelolaBeranda\} \/>/.test(app) && /tabAwal = null/.test(kelola) && /useState\(tabAwal \?\? 'kontak'\)/.test(kelola), 'tab awal diteruskan ke Kelola Beranda');
  ok(/simpanPetunjuk\(''\)/.test(konteks), 'keluar dan sesi berakhir menghapus petunjuk');
  ok(/bacaPetunjuk\(sesi\)/.test(landing) && (landing.match(/sunting=\{sunting\}/g) ?? []).length === 7, 'Landing membaca petunjuk hanya bila ada sesi dan meneruskannya ke tujuh bagian');
  ok(!/klienRingan|createClient|api\.js/.test(landing), 'Landing tidak memuat klien basis data (pengunjung umum tetap ringan)');
}

console.log(`\nRINGKASAN SUNTING: ${lulus} lulus, ${gagal} GAGAL.`);
if (gagal) process.exit(1);
