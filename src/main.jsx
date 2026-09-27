import React from 'react';
import ReactDOM from 'react-dom/client';
import Akar from './Akar.jsx';
import './index.css';
import { daftarkanSW } from './lib/pushClient';

// index.html memuat halaman muka hasil prarender di dalam #root (data-pra): dipakai sebagai tampilan sementara selagi halaman muka dimuat (lihat src/Akar.jsx).
const akar = document.getElementById('root');
const prarender = akar.querySelector('[data-pra]')?.innerHTML ?? '';

ReactDOM.createRoot(akar).render(
  <React.StrictMode>
    <Akar prarender={prarender} />
  </React.StrictMode>
);

// Service worker (notifikasi push dan aplikasi terpasang). Hanya pada build terbit: dev dan mode lokal tidak memakainya.
if (import.meta.env.PROD) window.addEventListener('load', () => daftarkanSW(import.meta.env.BASE_URL));
