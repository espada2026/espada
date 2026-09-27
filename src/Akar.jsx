import { lazy, useEffect, useState } from 'react';
import App from './App';
import BatasHalaman from './components/BatasHalaman';
import { parameterBerkasGaruda } from './lib/garudaLogic';
import { parameterVerifikasi } from './lib/verifikasiLogic';
import { pilihRute, ruteSesudahHash, sesiTersimpan } from './lib/ruteLogic';

// Halaman muka dan halaman publik dimuat malas: hanya diunduh bila dipilih. Aturan pemilihan ada di src/lib/ruteLogic.js.
const Landing = lazy(() => import('./landing/Landing'));
const HalamanVerifikasi = lazy(() => import('./components/HalamanVerifikasi'));
const HalamanBerkasGaruda = lazy(() => import('./components/HalamanBerkasGaruda'));

const LOKAL = import.meta.env.VITE_BACKEND === 'lokal';
// Judul halaman muka (dari index.html); aplikasi mengganti judul tab, jadi dikembalikan saat kembali ke halaman muka.
const JUDUL_BERANDA = document.title;

/** HTML halaman muka hasil prarender (dari index.html): tampil selagi berkas halaman muka diunduh, agar tidak ada layar kosong atau kedipan. */
function Prarender({ html }) {
  return html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : null;
}

/** Robots dan judul tab: hanya halaman muka yang boleh diindeks mesin pencari (dan berjudul gudep); aplikasi, verifikasi, dan tautan berbagi tidak. */
function useKepalaHalaman(rute) {
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (rute === 'landing') { meta?.remove(); document.title = JUDUL_BERANDA; return; }
    if (!meta) { meta = document.createElement('meta'); meta.name = 'robots'; document.head.appendChild(meta); }
    meta.content = 'noindex, nofollow';
  }, [rute]);
}

/**
 * Akar: memilih apa yang tampil sebelum data aplikasi dimuat. Halaman muka (landing) untuk pengunjung yang belum masuk, aplikasi untuk yang punya sesi
 * atau menekan "Masuk" (#masuk), serta halaman publik verifikasi QR dan tautan berbagi Berkas Garuda (tanpa login dan tanpa memuat data aplikasi).
 */
export default function Akar({ prarender = '' }) {
  const [rute, setRute] = useState(() => pilihRute({ search: window.location.search, hash: window.location.hash, sesi: sesiTersimpan(), lokal: LOKAL }));
  useEffect(() => {
    const berubah = () => {
      setRute((r) => {
        const baru = ruteSesudahHash(r, window.location.hash);
        if (baru !== r) window.scrollTo(0, 0);
        return baru;
      });
    };
    window.addEventListener('hashchange', berubah);
    return () => window.removeEventListener('hashchange', berubah);
  }, []);
  useKepalaHalaman(rute);

  if (rute === 'verifikasi') return <BatasHalaman><HalamanVerifikasi awal={parameterVerifikasi(window.location.search)} /></BatasHalaman>;
  if (rute === 'berkas') return <BatasHalaman><HalamanBerkasGaruda token={parameterBerkasGaruda(window.location.search)} /></BatasHalaman>;
  if (rute === 'landing') return <BatasHalaman fallback={<Prarender html={prarender} />}><Landing /></BatasHalaman>;
  return <App />;
}
