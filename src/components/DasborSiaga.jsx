import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import '../data/skuSiaga'; // mendaftarkan katalog SKU Siaga supaya hitungan tingkat Mula/Bantu/Tata bekerja
import { DAFTAR_TINGKAT_SIAGA } from '../data/skuSiaga';
import { tingkatSelesai } from '../lib/skuLogic';
import { anggotaSiaga } from '../lib/siagaLogic';
import { Icon } from './ui';

/** Pintasan menu yang paling sering dipakai Pembina Siaga. */
const PINTASAN = [
  { id: 'siaga', label: 'Anggota Siaga', ikon: 'anggota', teks: 'Data anak, perindukan, barung, dan SKU' },
  { id: 'pelantikan', label: 'Pelantikan', ikon: 'lencana', teks: 'Catat kenaikan tingkat sesudah upacara' },
  { id: 'absensi', label: 'Absensi', ikon: 'absensi', teks: 'Kehadiran latihan perindukan' },
  { id: 'iuran', label: 'Iuran', ikon: 'iuran', teks: 'Iuran dan pemeriksaan buku tabungan' },
  { id: 'tkk', label: 'TKK', ikon: 'bintang', teks: 'Tanda Kecakapan Khusus Siaga' },
  { id: 'agenda', label: 'Agenda', ikon: 'kalender', teks: 'Jadwal kegiatan gugus depan' },
];

/** Ringkasan gugus depan Siaga untuk dasbor Pembina: jumlah anak, sebaran tingkat, barung, dan pintasan menu (hanya membaca data yang sudah dimuat). */
export default function DasborSiaga({ onNav, menu }) {
  const { users, progress } = useApp();
  const ada = (id) => !menu || menu.includes(id);

  const ringkas = useMemo(() => {
    const aktif = anggotaSiaga(users).filter((u) => (u.status ?? 'aktif') === 'aktif');
    const barung = new Set(aktif.filter((u) => u.perindukan && u.barung).map((u) => `${u.perindukan.toLowerCase()}|${u.barung.toLowerCase()}`));
    const belumBarung = aktif.filter((u) => !u.barung).length;
    const selesai = Object.fromEntries(DAFTAR_TINGKAT_SIAGA.map((t) => [t, aktif.filter((u) => tingkatSelesai(progress, u, t)).length]));
    const berakun = aktif.filter((u) => !u.tanpaAkun).length;
    return { jumlah: aktif.length, barung: barung.size, belumBarung, selesai, berakun };
  }, [users, progress]);

  return (
    <div>
      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Ringkasan gugus depan Siaga">
        <div className="jahitan rounded-lg bg-white p-4">
          <p className="text-xs text-pramuka-600">Anggota Siaga aktif</p>
          <p className="text-2xl font-bold text-pramuka-900">{ringkas.jumlah}</p>
          <p className="text-xs text-pramuka-500">{ringkas.berakun} punya akun masuk</p>
        </div>
        <div className="jahitan rounded-lg bg-white p-4">
          <p className="text-xs text-pramuka-600">Barung terbentuk</p>
          <p className="text-2xl font-bold text-pramuka-900">{ringkas.barung}</p>
          <p className="text-xs text-pramuka-500">{ringkas.belumBarung > 0 ? `${ringkas.belumBarung} anak belum berbarung` : 'semua anak sudah berbarung'}</p>
        </div>
        {DAFTAR_TINGKAT_SIAGA.slice(0, 2).map((t) => (
          <div key={t} className="jahitan rounded-lg bg-white p-4">
            <p className="text-xs text-pramuka-600">Selesai SKU {t}</p>
            <p className="text-2xl font-bold text-pramuka-900">{ringkas.selesai[t]}</p>
            <p className="text-xs text-pramuka-500">dari {ringkas.jumlah} anak</p>
          </div>
        ))}
      </section>
      <p className="mb-5 text-sm text-pramuka-600">Selesai SKU Tata: <span className="font-semibold">{ringkas.selesai.Tata ?? 0}</span> anak (syarat awal Siaga Garuda).</p>

      <section aria-label="Pintasan menu" className="mb-5">
        <h2 className="mb-2 text-lg font-bold">Pintasan</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PINTASAN.filter((p) => ada(p.id)).map((p) => (
            <li key={p.id}>
              <button onClick={() => onNav(p.id)} className="jahitan flex w-full items-center gap-3 rounded-lg bg-white p-4 text-left hover:bg-pramuka-50">
                <Icon nama={p.ikon} className="h-6 w-6 shrink-0 text-pramuka-700" />
                <span className="min-w-0">
                  <span className="block font-semibold text-pramuka-900">{p.label}</span>
                  <span className="block text-xs text-pramuka-600">{p.teks}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
