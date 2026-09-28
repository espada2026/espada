import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ringkasTerbitUlang } from '../lib/terbitUlangLogic';

const KELAS = {
  belum: 'border-pramuka-200 bg-pramuka-50 text-pramuka-800',
  baru: 'border-pramuka-200 bg-pramuka-50 text-pramuka-800',
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  menunggu: 'border-amber-200 bg-amber-50 text-amber-900',
  gagal: 'border-amber-300 bg-amber-50 text-amber-900',
  menyerah: 'border-red-200 bg-red-50 text-red-900',
};

/** Keadaan penerbitan ulang halaman berita statis (Pembina dan Admin Gudep saja; server menolak yang lain). Ditampilkan di atas daftar berita. */
export default function PanelTerbitUlang() {
  const { api, notify } = useApp();
  const [keadaan, setKeadaan] = useState(null);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    const r = await api().statusTerbitUlang();
    if (r.ok) { setKeadaan(r.data); setGalat(''); } else setGalat(r.pesan);
  }, [api]);
  useEffect(() => { muat(); }, [muat]);

  const minta = async () => {
    setSibuk(true);
    const r = await api().mintaTerbitUlang();
    setSibuk(false);
    if (!r.ok) { notify(r.pesan, 'err'); muat(); return; }
    setKeadaan(r.data);
    notify('Permintaan terbit ulang dikirim. Halaman berita muncul dalam beberapa menit.');
  };

  if (galat) return null; // gagal memuat keadaan (mis. basis data belum dimigrasi): jangan mengganggu pengelolaan berita
  if (!keadaan) return null;
  const r = ringkasTerbitUlang(keadaan);
  return (
    <div className={`mb-4 rounded-xl border p-3 text-sm ${KELAS[r.tingkat]}`} role="status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{r.judul}</p>
        {r.bolehMinta && (
          <button type="button" className="btn btn-outline btn-sm" disabled={sibuk} onClick={minta}>
            {sibuk ? 'Mengirim...' : 'Terbitkan ulang halaman berita sekarang'}
          </button>
        )}
      </div>
      {r.rincian && <p className="mt-1">{r.rincian}</p>}
    </div>
  );
}
