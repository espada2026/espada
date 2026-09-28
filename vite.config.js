import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderBerandaKeHtml, sisipkanPrarender } from './scripts/prarender.mjs';
import { bangunBeritaStatis } from './scripts/berita-statis.mjs';

const BOOT_LOKAL = fileURLToPath(new URL('./src/lokal/bootLokal.js', import.meta.url));

/**
 * Modul virtual `virtual:backend-lokal`.
 *  - mode "lokal" (`npm run dev:lokal`) : memuat src/lokal/bootLokal.js (Postgres di browser, PGlite).
 *  - mode lain, termasuk build produksi : diganti stub kosong. Ini mencegah PGlite (belasan MB) ikut ke hasil build;
 *    tanpa ini Rollup tetap menelusuri import() pada cabang yang mati dan menyalin berkas .wasm-nya ke dist.
 */
const backendLokal = (aktif) => ({
  name: 'sigarda-backend-lokal',
  enforce: 'pre',
  resolveId(id) {
    if (id === 'virtual:backend-lokal') return aktif ? BOOT_LOKAL : '\0virtual:backend-lokal';
    return null;
  },
  load(id) {
    if (id === '\0virtual:backend-lokal') {
      return 'export const bootLokal = () => { throw new Error("Backend lokal tidak tersedia pada build ini."); };';
    }
    return null;
  },
});

/**
 * Versi terbit: tiap build punya ID unik (juga tertanam di kode sebagai __BUILD_ID__) dan menerbitkan version.json berisi ID itu. Aplikasi yang
 * masih terbuka memeriksanya berkala dan menawarkan "Muat ulang" (lihat src/lib/versi.js). Hanya untuk build produksi.
 */
const ID_BUILD = (process.env.GITHUB_SHA || '').slice(0, 8) + Date.now().toString(36);
const versiTerbit = (aktif) => ({
  name: 'sigarda-versi',
  generateBundle() {
    if (aktif) this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: ID_BUILD }) });
  },
});

/**
 * Prarender halaman muka: HTML landing page disisipkan ke index.html saat build (bukan saat dev), supaya isinya terbaca mesin pencari dan tampil seketika
 * sebelum JavaScript dimuat. Lihat scripts/prarender.mjs dan src/Akar.jsx.
 */
const prarenderBeranda = () => ({
  name: 'sigarda-prarender',
  apply: 'build',
  async transformIndexHtml(html) {
    return sisipkanPrarender(html, await renderBerandaKeHtml());
  },
});

/**
 * Halaman berita statis (satu HTML per berita terbit) dan sitemap, dibuat SESUDAH build dari data publik (sg_berita_publik). Hanya bila SIGARDA_BERITA_STATIS=1
 * (diset alur deploy); build lain (uji, profil, lokal) tidak menyentuh jaringan. Gagal apa pun = peringatan, bukan galat build. Lihat scripts/berita-statis.mjs.
 */
const beritaStatis = (aktif, url, kunci) => {
  let dist = 'dist';
  return {
    name: 'sigarda-berita',
    apply: 'build',
    configResolved(c) { dist = path.resolve(c.root, c.build.outDir); },
    async closeBundle() {
      if (!aktif) return;
      let pesan;
      let jumlah = 0;
      try { ({ jumlah, pesan } = await bangunBeritaStatis({ dist, url, kunci })); } catch (e) { pesan = `galat tak terduga: ${String(e?.message ?? e).slice(0, 200)}`; }
      console.log(`${jumlah || !process.env.GITHUB_ACTIONS ? '' : '::warning::'}[berita-statis] ${pesan}`);
    },
  };
};

// VITE_BASE dipakai saat deploy ke GitHub Pages, mis. VITE_BASE=/sigarda/
export default defineConfig(({ mode, command }) => {
  // Hanya mode "lokal" yang memakai backend lokal. Variabel lingkungan VITE_BACKEND=lokal yang tersisa di shell (mis. sesi pengembangan) membuat
  // build produksi membuang klien Supabase (`import.meta.env.VITE_BACKEND` selalu menang atas `define`), sehingga ukuran JS awal terukur
  // jauh lebih kecil dari yang terbit (penyebab lain: VITE_SUPABASE_URL/ANON_KEY kosong; itu dijaga scripts/profil). Dibuang di sini, sebelum Vite
  // membaca lingkungan (dijaga uji/mode-uji.mjs).
  if (mode !== 'lokal') delete process.env.VITE_BACKEND;
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: process.env.VITE_BASE || '/',
    plugins: [backendLokal(mode === 'lokal'), versiTerbit(command === 'build' && mode !== 'lokal'), prarenderBeranda(), beritaStatis(command === 'build' && mode !== 'lokal' && process.env.SIGARDA_BERITA_STATIS === '1', env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY), react()],
    define: { __BUILD_ID__: JSON.stringify(command === 'build' && mode !== 'lokal' ? ID_BUILD : '') },
    // Edge Function memakai alamat gaya Deno ("npm:..."); di sini dialihkan ke paket yang terpasang (mode lokal).
    resolve: { alias: { 'npm:@supabase/supabase-js@2': '@supabase/supabase-js' } },
    // PGlite memuat berkas .wasm sendiri; jangan diproses ulang oleh pra-bundel Vite.
    optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  };
});
