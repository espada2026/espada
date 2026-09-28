import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { pembinaAtauAdmin } from '../lib/hakLogic';
import { SKEMA_BERITA, SKEMA_PRESTASI, SKEMA_GALERI } from '../lib/berandaKontenSkema';
import PanelKontakBeranda from '../components/PanelKontakBeranda';
import PanelKontenTinjau from '../components/PanelKontenTinjau';
import PanelSosial from '../components/PanelSosial';
import PanelFaq from '../components/PanelFaq';

/**
 * Kelola Beranda (Pembina, Admin Gudep, dan Dewan Ambalan): isi halaman muka publik yang dapat dilihat siapa saja tanpa masuk. Berita,
 * Prestasi, dan Galeri berbagi alur yang sama (Dewan mengajukan, Pembina/Admin meninjau atau menerbitkan langsung; lihat PanelKontenTinjau).
 * Media sosial tanpa alur (langsung tampil); Pertanyaan umum (FAQ) hanya untuk Pembina dan Admin Gudep. Hak ditegakkan server; tampilan ini
 * hanya menyembunyikan tombol dan tab yang akan ditolak.
 */
export default function KelolaBeranda({ tabAwal = null }) {
  const { user } = useApp();
  const bolehTerbit = pembinaAtauAdmin(user);
  const TAB = [
    { id: 'kontak', label: 'Kontak' },
    { id: 'berita', label: 'Berita' },
    { id: 'prestasi', label: 'Prestasi' },
    { id: 'galeri', label: 'Galeri' },
    { id: 'sosial', label: 'Media Sosial' },
    ...(bolehTerbit ? [{ id: 'faq', label: 'Pertanyaan Umum' }] : []),
  ];
  const [tab, setTab] = useState(tabAwal ?? 'kontak');
  const tabAktif = TAB.some((t) => t.id === tab) ? tab : 'kontak';

  return (
    <div className="animasi-naik space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Kelola Beranda</h1>
        <p className="mt-1 max-w-2xl text-sm text-pramuka-600">Isi di sini tampil di halaman muka gudep yang dapat dilihat siapa saja tanpa masuk.</p>
        <p className="mt-2 text-sm"><a className="font-semibold text-pramuka-800 underline" href="#beranda">Lihat beranda publik</a></p>
      </div>

      <div role="tablist" aria-label="Bagian Kelola Beranda" className="flex flex-wrap gap-1 border-b border-pramuka-200 pb-px">
        {TAB.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tabAktif === t.id}
            className={`rounded-t-lg px-3.5 py-2 text-sm font-semibold ${tabAktif === t.id ? 'border border-b-white bg-white text-pramuka-900' : 'text-pramuka-600 hover:bg-pramuka-100'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel p-4">
        {tabAktif === 'kontak' && <PanelKontakBeranda />}
        {tabAktif === 'berita' && <PanelKontenTinjau skema={SKEMA_BERITA} />}
        {tabAktif === 'prestasi' && <PanelKontenTinjau skema={SKEMA_PRESTASI} />}
        {tabAktif === 'galeri' && <PanelKontenTinjau skema={SKEMA_GALERI} />}
        {tabAktif === 'sosial' && <PanelSosial />}
        {tabAktif === 'faq' && bolehTerbit && <PanelFaq />}
      </div>
    </div>
  );
}
