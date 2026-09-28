/**
 * Halaman berita statis saat build: mengambil berita terbit (sg_berita_publik, tanpa login) dan membuat dist/berita/<id>-<slug>/index.html per berita serta
 * dist/sitemap.xml yang memuat halaman muka dan semua berita. Dipakai plugin sigarda-berita di vite.config.js, HANYA bila SIGARDA_BERITA_STATIS=1 (diset
 * alur deploy .github/workflows/deploy.yml). Kegagalan apa pun (jaringan, migrasi 2026-09-berita-publik.sql belum dijalankan, isi rusak) TIDAK menggagalkan
 * build: situs tetap terbit tanpa halaman berita dan dengan sitemap bawaan. Dijaga uji/berita-statis.mjs.
 */
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const akarBawaan = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Memanggil fungsi RPC publik (kunci anon). Mengembalikan { ok, data } atau { ok: false, pesan }; tidak pernah melempar galat. */
export async function panggilRpc({ url, kunci, nama, ambil = globalThis.fetch, batasMs = 15000 }) {
  try {
    const r = await ambil(`${String(url).trim().replace(/\/+$/, '')}/rest/v1/rpc/${nama}`, {
      method: 'POST', headers: { apikey: kunci, Authorization: `Bearer ${kunci}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(batasMs),
    });
    if (!r.ok) return { ok: false, pesan: `HTTP ${r.status}` };
    return { ok: true, data: await r.json() };
  } catch (e) {
    return { ok: false, pesan: String(e?.message ?? e).slice(0, 120) };
  }
}

/** Tag <link> gaya dan ikon dari index.html hasil build (halaman berita memakai CSS yang sama dengan halaman muka). */
export function kepalaDariIndex(html) {
  return [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]).filter((t) => /rel="(stylesheet|icon|apple-touch-icon)"/.test(t)).join('\n');
}

/** Alamat utama situs dari <link rel="canonical"> di index.html; null bila tidak ada. */
export function alamatDariIndex(html) {
  return /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1] ?? null;
}

async function muatModul(akar) {
  const hasil = await build({
    entryPoints: [path.join(akar, 'src', 'landing', 'prarenderBerita.jsx')], bundle: true, write: false, platform: 'node', format: 'esm',
    jsx: 'automatic', loader: { '.js': 'jsx' }, define: { 'import.meta.env': '{}' }, logLevel: 'silent', external: ['virtual:backend-lokal'],
    banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(pathToFileURL(path.join(akar, 'package.json')).href)});` },
  });
  return import(`data:text/javascript;base64,${Buffer.from(hasil.outputFiles[0].text).toString('base64')}`);
}

/**
 * Membuat halaman berita dan sitemap di folder hasil build `dist`. Mengembalikan { jumlah, pesan }: jumlah halaman yang dibuat (0 bila dilewati/gagal)
 * dan keterangan untuk log. `ambil` dan `akar` (folder proyek) dapat diganti untuk uji (uji dibundel, jadi import.meta.url bukan lokasi skrip ini).
 */
export async function bangunBeritaStatis({ dist, url, kunci, ambil = globalThis.fetch, akar = akarBawaan }) {
  if (!url || !kunci) return { jumlah: 0, pesan: 'Alamat atau kunci Supabase tidak tersedia: halaman berita dilewati.' };
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  const alamatSitus = alamatDariIndex(html);
  if (!alamatSitus) return { jumlah: 0, pesan: 'index.html tanpa canonical: halaman berita dilewati.' };

  const rb = await panggilRpc({ url, kunci, nama: 'sg_berita_publik', ambil });
  if (!rb.ok) return { jumlah: 0, pesan: `sg_berita_publik gagal (${rb.pesan}); bila migrasi 2026-09-berita-publik.sql belum dijalankan, jalankan di SQL Editor. Halaman berita dilewati.` };
  const modul = await muatModul(akar);
  const daftar = modul.susunBeritaArsip(rb.data);
  const rg = await panggilRpc({ url, kunci, nama: 'sg_gudep_publik', ambil });
  const gudep = { ...modul.GUDEP_BAWAAN, ...(rg.ok && rg.data && typeof rg.data === 'object' ? Object.fromEntries(Object.entries(rg.data).filter(([, v]) => typeof v === 'string' && v)) : {}) };

  const kepalaTambahan = kepalaDariIndex(html);
  const gambarCadangan = `${alamatSitus.replace(/\/+$/, '')}/og-gudep.png`;
  for (const b of daftar) {
    const folder = path.join(dist, ...modul.pathBerita(b).split('/').filter(Boolean));
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, 'index.html'), modul.renderHalamanBerita({ b, namaGudep: gudep.nama, alamatSitus, gambarCadangan, kepalaTambahan }));
  }
  if (daftar.length) await writeFile(path.join(dist, 'berita', 'index.json'), JSON.stringify(modul.indeksHalamanBerita(daftar))); // dibaca halaman muka agar hanya menaut ke halaman yang ada
  await writeFile(path.join(dist, 'sitemap.xml'), modul.susunSitemap(alamatSitus, daftar));
  return { jumlah: daftar.length, pesan: `${daftar.length} halaman berita dan sitemap dibuat.` };
}
