import { renderToStaticMarkup } from 'react-dom/server';
import Landing from './Landing';

/**
 * Dipakai SAAT BUILD (plugin sigarda-prarender di vite.config.js): merender halaman muka menjadi HTML biasa yang disisipkan ke index.html, supaya isinya terbaca
 * mesin pencari dan pratinjau tautan serta tampil seketika sebelum JavaScript selesai dimuat. Tanpa data server (tidak ada panggilan jaringan): hanya bagian tetap.
 */
export function renderBeranda() {
  return renderToStaticMarkup(<Landing panggil={async () => ({ ok: false })} />);
}
