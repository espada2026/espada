import { useState } from 'react';
import { useGudep } from '../lib/gudepStore';
import { sesiTersimpan } from '../lib/ruteLogic';
import { bacaPetunjuk } from '../lib/suntingLogic';
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
  const [sunting] = useState(() => bacaPetunjuk(sesi)); // pensil sunting hanya bagi pengurus yang sedang masuk (lihat suntingLogic.js); kosong saat prarender
  return (
    <div className="bg-pramuka-50 text-pramuka-900">
      <NavBeranda G={G} sesi={sesi} />
      <main>
        <Hero G={G} agendaTerdekat={beranda.agenda[0] ?? null} />
        <Tentang G={G} kontak={beranda.kontak} pembina={beranda.pembina} kamabigus={beranda.kamabigus} sunting={sunting} />
        <Program />
        <Perjalanan />
        <Berita berita={beranda.berita} memuat={beranda.memuat} sunting={sunting} halaman={beranda.halaman} adaLagi={beranda.adaLagi} memuatLagi={beranda.memuatLagi} galatLagi={beranda.galatLagi} onMuatLagi={beranda.muatLagi} />
        <Prestasi prestasi={beranda.prestasi} memuat={beranda.memuat} sunting={sunting} />
        <Galeri galeri={beranda.galeri} memuat={beranda.memuat} sunting={sunting} />
        <KabarAgenda agenda={beranda.agenda} memuat={beranda.memuat} />
        <MediaSosial sosial={beranda.sosial} sunting={sunting} />
        <TanyaJawab faq={beranda.faq} sunting={sunting} />
        <Kontak G={G} kontak={beranda.kontak} sunting={sunting} />
        <CekDokumen />
      </main>
      <Kaki G={G} />
    </div>
  );
}
