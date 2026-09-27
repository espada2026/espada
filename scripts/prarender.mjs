/**
 * Prarender halaman muka (landing page) saat build: src/landing/prarender.jsx dibundel dengan esbuild, dijalankan di Node, dan hasil HTML-nya disisipkan ke
 * index.html di dalam #root (pembungkus data-pra). Dipakai plugin sigarda-prarender di vite.config.js; dijaga uji/landing.mjs.
 */
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const akar = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Merender halaman muka menjadi teks HTML (tanpa data server). */
export async function renderBerandaKeHtml() {
  const hasil = await build({
    entryPoints: [path.join(akar, 'src', 'landing', 'prarender.jsx')], bundle: true, write: false, platform: 'node', format: 'esm',
    jsx: 'automatic', loader: { '.js': 'jsx' }, define: { 'import.meta.env': '{}' }, logLevel: 'silent', external: ['virtual:backend-lokal'], // dipakai hanya cabang mode lokal (import dinamis), tidak dijalankan saat prarender
    // Modul dijalankan dari alamat data:, jadi `require` (untuk modul bawaan Node yang dipakai react-dom/server) dibuat dari berkas proyek.
    banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(pathToFileURL(path.join(akar, 'package.json')).href)});` },
  });
  const modul = await import(`data:text/javascript;base64,${Buffer.from(hasil.outputFiles[0].text).toString('base64')}`);
  return modul.renderBeranda();
}

/** Menyisipkan HTML prarender ke dalam #root; galat bila penanda #root tidak ditemukan (index.html berubah bentuk). */
export function sisipkanPrarender(html, markup) {
  const penanda = '<div id="root"></div>';
  if (!html.includes(penanda)) throw new Error('index.html tidak memuat <div id="root"></div>: prarender tidak dapat disisipkan.');
  return html.replace(penanda, () => `<div id="root"><div data-pra>${markup}</div></div>`);
}
