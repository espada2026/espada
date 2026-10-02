/**
 * Membuat public/og-gudep.png (1200 x 630): gambar pratinjau tautan (WhatsApp, Facebook, mesin pencari). Ilustrasi perkemahan senja yang sama dengan hero halaman
 * muka (src/landing/ilustrasi.jsx), digambar sendiri tanpa pustaka gambar: poligon dan lingkaran dengan anti-alias 3x3, lalu PNG ditulis dengan zlib.
 * Sementara tanpa teks (teks pratinjau datang dari og:title); diganti foto asli lewat menu Kelola Beranda pada fase berikutnya.
 *   node scripts/buat-og.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const akar = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 1200, H = 630, S = 3; // ukuran akhir dan faktor anti-alias
const w = W * S, h = H * S;
const px = new Float32Array(w * h * 3);

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const campur = (i, [r, g, b], a) => { px[i] = px[i] * (1 - a) + r * a; px[i + 1] = px[i + 1] * (1 - a) + g * a; px[i + 2] = px[i + 2] * (1 - a) + b * a; };

/** Langit: gradasi vertikal antar-titik warna. */
function langit(titik) {
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    let k = 0;
    while (k < titik.length - 2 && t > titik[k + 1][0]) k++;
    const [t0, c0] = titik[k], [t1, c1] = titik[k + 1];
    const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const a = hex(c0), b = hex(c1);
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 3; for (let c = 0; c < 3; c++) px[i + c] = a[c] * (1 - u) + b[c] * u; }
  }
}

/** Poligon terisi (aturan genap-ganjil) dengan titik dalam koordinat kanvas 1200x630. */
function poligon(titik, warna, alfa = 1) {
  const c = hex(warna), p = titik.map(([x, y]) => [x * S, y * S]);
  let y0 = Infinity, y1 = -Infinity;
  for (const [, y] of p) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(h - 1, Math.ceil(y1)); y++) {
    const sy = y + 0.5, xs = [];
    for (let i = 0; i < p.length; i++) {
      const [xa, ya] = p[i], [xb, yb] = p[(i + 1) % p.length];
      if ((ya <= sy && yb > sy) || (yb <= sy && ya > sy)) xs.push(xa + ((sy - ya) / (yb - ya)) * (xb - xa));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(w - 1, Math.floor(xs[k + 1] - 0.5)); x++) campur((y * w + x) * 3, c, alfa);
    }
  }
}

/** Lingkaran dengan gradasi radial: dari `alfaPusat` di tengah sampai 0 di tepi (bila `lembut`) atau rata. */
function lingkaran(cx, cy, r, warna, alfa = 1, lembut = false) {
  const c = hex(warna), X = cx * S, Y = cy * S, R = r * S;
  for (let y = Math.max(0, Math.floor(Y - R)); y <= Math.min(h - 1, Math.ceil(Y + R)); y++) {
    for (let x = Math.max(0, Math.floor(X - R)); x <= Math.min(w - 1, Math.ceil(X + R)); x++) {
      const d = Math.hypot(x + 0.5 - X, y + 0.5 - Y);
      if (d > R) continue;
      campur((y * w + x) * 3, c, lembut ? alfa * (1 - d / R) : alfa);
    }
  }
}

/** Bagian dari lanskap SVG hero (viewBox 1200x330) diletakkan di dasar kanvas: y kanvas = y svg + (H - 330). */
const gy = (y) => y + (H - 330);
const pinus = (x, y, lebar, tinggi, warna) => {
  const sx = lebar / 60, sy = tinggi / 120, t = (px0, py0) => [x + px0 * sx, gy(y + py0 * sy)];
  poligon([[30, 0], [50, 34], [38, 34], [54, 64], [40, 64], [58, 98], [2, 98], [20, 64], [6, 64], [22, 34], [10, 34]].map(([a, b]) => t(a, b)), warna);
  poligon([[26, 96], [34, 96], [34, 120], [26, 120]].map(([a, b]) => t(a, b)), warna);
};
const bukit = (titik, warna, alfa = 1) => poligon([...titik.map(([x, y]) => [x, gy(y)]), [1200, H + 2], [0, H + 2]], warna, alfa);

langit([[0, '#081a38'], [0.38, '#0c2547'], [0.75, '#184f8a'], [1, '#1d64ae']]);
// bintang
for (const [x, y, r] of [[96, 60, 2], [230, 130, 2], [370, 44, 2.4], [530, 110, 2], [690, 40, 2.2], [790, 150, 2], [890, 70, 2.4], [1060, 120, 2], [1130, 46, 2.2], [40, 170, 2]]) lingkaran(x, y, r, '#fff1b8', 0.8);
lingkaran(880, gy(120), 150, '#ffd24d', 0.55, true);
lingkaran(880, gy(128), 46, '#ffd24d', 1);
bukit([[0, 200], [120, 150], [240, 190], [380, 120], [520, 185], [660, 130], [800, 188], [940, 140], [1080, 190], [1200, 150]], '#1d64ae', 0.75);
bukit([[0, 240], [100, 205], [230, 235], [360, 190], [500, 240], [640, 200], [780, 245], [930, 205], [1070, 240], [1200, 210]], '#184f8a');
for (const [x, y, lb, tg] of [[40, 176, 46, 92], [92, 196, 36, 72], [330, 184, 44, 88], [560, 190, 40, 80], [1010, 180, 48, 96], [1070, 200, 36, 72], [1130, 172, 52, 104]]) pinus(x, y, lb, tg, '#143c6b');
bukit([[0, 275], [140, 255], [300, 272], [470, 250], [640, 272], [820, 256], [1000, 274], [1200, 254]], '#0e2f5c');
for (const [x, y, lb, tg] of [[10, 200, 60, 120], [64, 224, 46, 92], [1120, 196, 64, 128], [1074, 226, 44, 88]]) pinus(x, y, lb, tg, '#0c2547');
// tenda besar (emas) dengan bendera
poligon([[180, 312], [250, 242], [320, 312]].map(([x, y]) => [x, gy(y - 236 + 236)]), '#f5b81c');
poligon([[250, 242], [320, 312], [250, 312]].map(([x, y]) => [x, gy(y)]), '#c98a00');
poligon([[232, 312], [250, 276], [268, 312]].map(([x, y]) => [x, gy(y)]), '#0c2547');
poligon([[249, 210], [251, 210], [251, 242], [249, 242]].map(([x, y]) => [x, gy(y)]), '#0c2547');
poligon([[251, 210], [277, 218], [251, 226]].map(([x, y]) => [x, gy(y)]), '#c92a2a');
// tenda kecil
poligon([[330, 312], [376, 266], [422, 312]].map(([x, y]) => [x, gy(y)]), '#bfdffc');
poligon([[376, 266], [422, 312], [376, 312]].map(([x, y]) => [x, gy(y)]), '#a9cdf0');
poligon([[364, 312], [376, 288], [388, 312]].map(([x, y]) => [x, gy(y)]), '#0c2547');
// api unggun
lingkaran(700, gy(282), 120, '#ffd966', 0.5, true);
poligon([[674, gy(302)], [726, gy(288)], [726, gy(292)], [674, gy(306)]], '#184f8a');
poligon([[674, gy(288)], [726, gy(302)], [726, gy(306)], [674, gy(292)]], '#184f8a');
poligon([[700, gy(290)], [688, gy(276)], [692, gy(262)], [699, gy(268)], [701, gy(250)], [716, gy(266)], [712, gy(282)]], '#e2803a');
poligon([[700, gy(290)], [694, gy(280)], [697, gy(272)], [701, gy(276)], [703, gy(264)], [710, gy(276)], [707, gy(288)]], '#ffd966');
bukit([[0, 300], [200, 290], [420, 304], [700, 292], [960, 306], [1200, 292]], '#0c2547');

// turunkan ke ukuran akhir (rata-rata blok S x S) dan susun RGBA
const mentah = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  mentah[y * (W * 4 + 1)] = 0; // filter: none
  for (let x = 0; x < W; x++) {
    const jumlah = [0, 0, 0];
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const i = ((y * S + dy) * w + x * S + dx) * 3; jumlah[0] += px[i]; jumlah[1] += px[i + 1]; jumlah[2] += px[i + 2]; }
    const o = y * (W * 4 + 1) + 1 + x * 4;
    for (let c = 0; c < 3; c++) mentah[o + c] = Math.round(jumlah[c] / (S * S));
    mentah[o + 3] = 255;
  }
}

const tabelCrc = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = tabelCrc[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const potong = (jenis, data) => {
  const isi = Buffer.concat([Buffer.from(jenis, 'ascii'), data]);
  const hasil = Buffer.alloc(isi.length + 8);
  hasil.writeUInt32BE(data.length, 0); isi.copy(hasil, 4); hasil.writeUInt32BE(crc(isi), isi.length + 4);
  return hasil;
};
const kepala = Buffer.alloc(13);
kepala.writeUInt32BE(W, 0); kepala.writeUInt32BE(H, 4); kepala[8] = 8; kepala[9] = 6; // 8 bit, RGBA
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), potong('IHDR', kepala), potong('IDAT', deflateSync(mentah, { level: 9 })), potong('IEND', Buffer.alloc(0))]);
const keluar = path.join(akar, 'public', 'og-gudep.png');
writeFileSync(keluar, png);
console.log(`ditulis public/og-gudep.png (${W}x${H}, ${(png.length / 1024).toFixed(0)} kB)`);
