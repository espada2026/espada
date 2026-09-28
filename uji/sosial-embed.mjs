// Media sosial: pengenalan tautan Bagikan (analisisSosial), kartu beranda (gambar pratinjau + tombol putar, TANPA iframe atau skrip pihak ketiga saat dimuat), dan
// penyambungan di formulir Kelola Beranda. Pemutaran sungguhan (iframe dibuat saat diketuk) diperiksa manual di dev:lokal.
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { analisisSosial, galatTautanSosial } from '../src/lib/sosialLogic.js';
import { MediaSosial } from '../src/landing/bagian.jsx';

const P = process.cwd().replace(/\\/g, '/');
let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };
const teks = (el) => renderToStaticMarkup(el);

console.log('--- analisisSosial: YouTube ---');
{
  const id = 'dQw4w9WgXcQ';
  for (const t of [`https://www.youtube.com/watch?v=${id}`, `https://youtu.be/${id}?si=abc`, `https://m.youtube.com/watch?v=${id}&t=10`, `https://www.youtube.com/shorts/${id}`, `https://www.youtube.com/live/${id}`, `https://www.youtube.com/embed/${id}`]) {
    const a = analisisSosial(t);
    ok(a.jenis === 'postingan' && a.platform === 'youtube' && a.embedUrl === `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1` && a.thumbUrl === `https://i.ytimg.com/vi/${id}/hqdefault.jpg` && a.bentuk === 'video', `YouTube dikenali: ${t.slice(0, 55)}`);
  }
  for (const t of ['https://www.youtube.com/@gudepsmanbukateja', 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv', 'https://www.youtube.com/', 'https://www.youtube.com/playlist?list=PLabc', 'https://www.youtube.com/watch?v=pendek', 'https://youtu.be/']) {
    ok(analisisSosial(t).jenis === 'bukan-postingan' && analisisSosial(t).embedUrl === '', `bukan postingan (profil/beranda/playlist/ID rusak): ${t.slice(0, 55)}`);
  }
}

console.log('\n--- analisisSosial: Instagram, TikTok, Facebook ---');
{
  const ig = analisisSosial('https://www.instagram.com/reel/C8xYz12AbCd/?igsh=abc');
  ok(ig.jenis === 'postingan' && ig.platform === 'instagram' && ig.embedUrl === 'https://www.instagram.com/reel/C8xYz12AbCd/embed' && ig.bentuk === 'tegak' && ig.thumbUrl === '', 'Instagram reel: pemutar /embed, pratinjau harus dari pengurus');
  ok(analisisSosial('https://www.instagram.com/p/C8xYz12AbCd/').embedUrl === 'https://www.instagram.com/p/C8xYz12AbCd/embed' && analisisSosial('https://www.instagram.com/gudep/p/C8xYz12AbCd/').embedUrl === 'https://www.instagram.com/p/C8xYz12AbCd/embed' && analisisSosial('https://www.instagram.com/reels/C8xYz12AbCd/').embedUrl.includes('/reel/'), 'Instagram post (dengan atau tanpa nama akun di jalur) dan reels dikenali');
  ok(analisisSosial('https://www.instagram.com/share/reel/BAbCdEf/').jenis === 'postingan' && analisisSosial('https://www.instagram.com/share/reel/BAbCdEf/').embedUrl === '', 'tautan Bagikan baru Instagram: postingan tetapi tanpa pemutar (kodenya tidak dapat dibaca)');
  ok(analisisSosial('https://www.instagram.com/gudepsmanbukateja/').jenis === 'bukan-postingan' && analisisSosial('https://www.instagram.com/stories/gudep/123/').jenis === 'bukan-postingan', 'profil dan story Instagram: bukan postingan');

  const tt = analisisSosial('https://www.tiktok.com/@gudep.smanbukateja/video/7412345678901234567?lang=id');
  ok(tt.jenis === 'postingan' && tt.embedUrl === 'https://www.tiktok.com/player/v1/7412345678901234567?rel=0&autoplay=1' && tt.bentuk === 'tegak', 'TikTok video: pemutar player/v1 dari ID angka, rel=0 (video terkait dari pembuat yang sama) dan autoplay');
  ok(!analisisSosial('https://www.tiktok.com/@a/video/7412345678901234567').embedUrl.includes('embed/v2'), 'TikTok: tidak lagi memakai pemutar lama embed/v2 (terpotong di kotak kartu dan tanpa pengaturan video terkait)');
  ok(analisisSosial('https://vm.tiktok.com/ZSabc123/').jenis === 'postingan' && analisisSosial('https://vm.tiktok.com/ZSabc123/').embedUrl === '' && analisisSosial('https://www.tiktok.com/t/ZTabc123/').embedUrl === '', 'tautan pendek TikTok: postingan tanpa pemutar');
  ok(analisisSosial('https://www.tiktok.com/@gudep.smanbukateja').jenis === 'bukan-postingan', 'profil TikTok: bukan postingan');

  const fb = analisisSosial('https://www.facebook.com/gudep/videos/1234567890123/');
  ok(fb.jenis === 'postingan' && fb.embedUrl === `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent('https://www.facebook.com/gudep/videos/1234567890123/')}&show_text=false` && fb.bentuk === 'video', 'Facebook video: plugin video dengan href yang di-encode');
  ok(analisisSosial('https://www.facebook.com/reel/1234567890').embedUrl.includes('plugins/video.php') && analisisSosial('https://www.facebook.com/watch/?v=1234567890').embedUrl.includes('plugins/video.php'), 'Facebook reel dan watch?v= dikenali sebagai video');
  ok(analisisSosial('https://www.facebook.com/gudep/posts/pfbid02abc').embedUrl.includes('plugins/post.php') && analisisSosial('https://www.facebook.com/gudep/posts/pfbid02abc').bentuk === 'tegak', 'Facebook postingan: plugin post');
  ok(analisisSosial('https://fb.watch/abcDEF/').jenis === 'postingan' && analisisSosial('https://fb.watch/abcDEF/').embedUrl === '' && analisisSosial('https://www.facebook.com/share/v/1AbCdEf/').embedUrl === '', 'fb.watch dan tautan Bagikan Facebook: postingan tanpa pemutar');
  ok(analisisSosial('https://www.facebook.com/gudepsmanbukateja').jenis === 'bukan-postingan', 'halaman Facebook: bukan postingan');
}

console.log('\n--- analisisSosial: lain-lain dan keamanan ---');
{
  ok(analisisSosial('').jenis === 'kosong' && analisisSosial(null).jenis === 'kosong' && analisisSosial('bukan tautan').jenis === 'tidak-sah' && analisisSosial('javascript:alert(1)').jenis === 'tidak-sah' && analisisSosial('http://youtube.com/watch?v=dQw4w9WgXcQ').jenis === 'tidak-sah', 'kosong, bukan tautan, javascript:, dan http: tidak sah');
  ok(analisisSosial('https://contoh.com/watch?v=dQw4w9WgXcQ').jenis === 'tidak-dikenal' && analisisSosial('https://youtube.com.jahat.example/watch?v=dQw4w9WgXcQ').jenis === 'tidak-dikenal' && analisisSosial('https://x.com/gudep/status/1').jenis === 'tidak-dikenal', 'situs lain dan tiruan nama (youtube.com.jahat.example): tidak dikenal, tanpa pemutar');
  const semua = ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&x=%22%3E%3Cscript%3E', 'https://www.instagram.com/p/AbCdE12345/?a=%22onload%3Dx', 'https://www.tiktok.com/@a/video/7412345678901234567?x=%22', 'https://www.facebook.com/a/videos/1234567890/?x=%22%3E'];
  ok(semua.every((t) => { const e = analisisSosial(t).embedUrl; return /^https:\/\/(www\.youtube-nocookie\.com|www\.instagram\.com|www\.tiktok\.com|www\.facebook\.com)\//.test(e) && !/["<> ]/.test(e); }), 'alamat pemutar hanya ke host platform resmi dan tidak memuat tanda kutip atau kurung sudut dari tautan mentah');
  ok(galatTautanSosial('https://www.youtube.com/@gudep').includes('bukan sebuah postingan') && galatTautanSosial('https://contoh.com/x').includes('Instagram, YouTube, Facebook, atau TikTok') && galatTautanSosial('https://vm.tiktok.com/ZSabc/') === '' && galatTautanSosial('') === '', 'galatTautanSosial: profil dan situs lain ditolak formulir; tautan pendek dan kosong tidak');
}

console.log('\n--- Kartu di beranda: gambar pratinjau + tombol putar, tanpa iframe saat dimuat ---');
{
  const yt = { platform: 'youtube', tautan: 'https://youtu.be/dQw4w9WgXcQ', keterangan: 'Upacara pelantikan', gambarUrl: '' };
  const t1 = teks(h(MediaSosial, { sosial: [yt] }));
  ok(!t1.includes('<iframe') && !t1.includes('<script') && !t1.includes('youtube-nocookie'), 'saat dimuat TIDAK ada iframe, skrip, maupun alamat pemutar (halaman tetap ringan dan tanpa pihak ketiga)');
  ok(t1.includes('src="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"') && t1.includes('aspect-[4/5]') && t1.includes('object-contain'), 'YouTube: gambar pratinjau otomatis tanpa gambar dari pengurus; landscape utuh di kotak 4:5 (object-contain)');
  ok(t1.includes('aria-label="Putar postingan YouTube: Upacara pelantikan"') && t1.includes('Ketuk gambar untuk memutar') && /<button type="button"/.test(t1), 'tombol putar dapat diakses (label jelas) dan ada petunjuk "Ketuk gambar untuk memutar"');
  ok(t1.includes('>Buka di YouTube ↗<') && t1.includes('href="https://youtu.be/dQw4w9WgXcQ"'), 'tautan "Buka di YouTube" tetap ada (jalan keluar bila pemutar tidak dapat dimuat)');

  const ig = { platform: 'instagram', tautan: 'https://www.instagram.com/reel/C8xYz12AbCd/', keterangan: '', gambarUrl: 'https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456=w1000' };
  const t2 = teks(h(MediaSosial, { sosial: [ig] }));
  ok(t2.includes('googleusercontent.com/d/1AbCdEf') && t2.includes('aspect-[4/5]') && t2.includes('object-cover') && t2.includes('aria-label="Putar postingan Instagram"') && !t2.includes('<iframe'), 'Instagram: memakai gambar pratinjau dari pengurus (memenuhi kotak 4:5) dengan tombol putar, tanpa iframe');
  const t3 = teks(h(MediaSosial, { sosial: [{ platform: 'facebook', tautan: 'https://fb.watch/abcDEF/', keterangan: 'Kegiatan', gambarUrl: '' }, { platform: 'instagram', tautan: 'https://www.instagram.com/gudepsmanbukateja/', keterangan: 'Profil lama', gambarUrl: '' }] }));
  ok(!t3.includes('<button') && !t3.includes('Ketuk gambar') && (t3.match(/target="_blank"/g) ?? []).length === 4, 'tautan pendek dan data lama berupa profil: tetap kartu tautan (membuka platform), tanpa tombol putar');
  ok(teks(h(MediaSosial, { sosial: [] })) === '', 'tanpa kiriman: bagian tidak tampil sama sekali');
}

console.log('\n--- Penyambungan di formulir ---');
{
  const panel = readFileSync(`${P}/src/components/PanelSosial.jsx`, 'utf8');
  ok(panel.includes('gantiTautan(e.target.value)') && panel.includes('platform: a.platform || f.platform'), 'formulir: platform dikenali otomatis dari tautan');
  ok(panel.includes('galatTautanSosial(f.tautan)') && panel.includes('<InfoTautan nilai={form.tautan}'), 'formulir: tautan profil/situs lain ditolak sebelum disimpan dan hasil pengenalan ditampilkan di bawah kolom');
  ok(panel.includes('Tautan postingan (tautan Bagikan, dari akun mana pun)') && panel.includes('Bukan tautan profil'), 'label dan petunjuk: tautan Bagikan dari postingan, tidak harus akun gudep');
  const bagian = readFileSync(`${P}/src/landing/bagian.jsx`, 'utf8');
  ok(bagian.includes('sandbox="allow-scripts allow-same-origin allow-popups') && bagian.includes('referrerPolicy="strict-origin-when-cross-origin"') && !/<script/.test(bagian), 'iframe pemutar dibatasi sandbox dan tidak ada tag skrip pihak ketiga di kode beranda');
}

console.log(`\nRINGKASAN SOSIAL-EMBED: ${lulus} lulus, ${gagal} GAGAL.`);
if (gagal) process.exit(1);
