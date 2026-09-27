import { useState } from 'react';
import { useGudep } from '../lib/gudepStore';
import { sesiTersimpan } from '../lib/ruteLogic';
import { Berita, CekDokumen, Galeri, Hero, Kaki, KabarAgenda, Kontak, MediaSosial, NavBeranda, Perjalanan, Prestasi, Program, Tentang, TanyaJawab } from './bagian';
import useBerandaPublik from './useBerandaPublik';

/**
 * Halaman muka (landing page) gudep: yang pertama dilihat pengunjung sebelum halaman masuk. Bagian tetap ada di landingData.js; kontak, sambutan, cerita, dan
 * agenda diatur pengurus dan dimuat tanpa login (useBerandaPublik). Komponen ini juga dirender ke HTML saat build (src/landing/prarender.jsx), jadi tidak boleh
 * menyentuh window/document saat dirender.
 */
export default function Landing({ panggil }) {
  const G = useGudep();
  const beranda = useBerandaPublik(panggil);
  const [sesi] = useState(() => sesiTersimpan()); // false saat prarender (tanpa localStorage)
  return (
    <div className="bg-pramuka-50 text-pramuka-900">
      <NavBeranda G={G} sesi={sesi} />
      <main>
        <Hero G={G} agendaTerdekat={beranda.agenda[0] ?? null} />
        <Tentang G={G} kontak={beranda.kontak} pembina={beranda.pembina} kamabigus={beranda.kamabigus} />
        <Program />
        <Perjalanan />
        <Berita berita={beranda.berita} memuat={beranda.memuat} />
        <Prestasi prestasi={beranda.prestasi} memuat={beranda.memuat} />
        <Galeri galeri={beranda.galeri} memuat={beranda.memuat} />
        <KabarAgenda agenda={beranda.agenda} memuat={beranda.memuat} />
        <MediaSosial sosial={beranda.sosial} />
        <TanyaJawab faq={beranda.faq} />
        <Kontak G={G} kontak={beranda.kontak} />
        <CekDokumen />
      </main>
      <Kaki G={G} />
    </div>
  );
}
