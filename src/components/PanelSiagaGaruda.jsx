import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import useSiagaGaruda from '../hooks/useSiagaGaruda';
import useTkkSiaga from '../hooks/useTkkSiaga';
import usePelantikanSaka from '../hooks/usePelantikanSaka';
import { tingkatSelesai } from '../lib/skuLogic';
import { hitungSiagaGaruda, periksaSiagaGaruda, ringkasSiagaGaruda, STATUS_SIAGA_GARUDA } from '../lib/siagaGarudaLogic';
import { fmtTanggal, hariIni } from '../lib/format';
import SumberPeraturan from './SumberPeraturan';

/**
 * Syarat Siaga Garuda satu anak (Pramuka Siaga, Fase 6): enam butir Jukran Kwarnas 038/2017. Butir 1 (SKU Tata + 2 bulan sesudah dilantik), 2 (TKK), 4 dan 5 (ikut pertemuan Siaga/Persari di Agenda) diberi SARAN dari data
 * aplikasi; Pembina atau Admin menetapkan tiap butir (menang atas saran). Anak dan orang tua hanya melihat. `dapatMencatat` = Pembina atau Admin dan anaknya aktif.
 * Hanya catatan: isi rubrik penilaian tidak ada di aplikasi.
 */
export default function PanelSiagaGaruda({ peserta, dapatMencatat }) {
  const { progress, api, notify } = useApp();
  const hari = hariIni();
  const sg = useSiagaGaruda(peserta.id);
  const tkk = useTkkSiaga(peserta.id);
  const pl = usePelantikanSaka();
  const [agenda, setAgenda] = useState([]);
  useEffect(() => { let batal = false; api().muatAgenda().then((r) => { if (!batal && r.ok) setAgenda(r.data); }); return () => { batal = true; }; }, [api]);
  const tataSelesai = tingkatSelesai(progress, peserta, 'Tata');
  const butir = useMemo(
    () => hitungSiagaGaruda({ peserta, progress, pelantikan: pl.pelantikan, tkk: tkk.baris, agenda, penetapan: sg.baris, hari }),
    [peserta, progress, pl.pelantikan, tkk.baris, agenda, sg.baris, hari],
  );
  const ringkas = ringkasSiagaGaruda(butir);

  const [buka, setBuka] = useState(null);
  const [nilai, setNilai] = useState('100');
  const [tanggal, setTanggal] = useState(hari);
  const [catatan, setCatatan] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const bukaForm = (b) => {
    setBuka(b.no);
    setNilai(String(b.penetapan?.nilai ?? 100));
    setTanggal(b.penetapan?.tanggal ?? hari);
    setCatatan(b.penetapan?.catatan ?? '');
    setGalat('');
  };
  const simpan = async (e) => {
    e.preventDefault();
    const p = periksaSiagaGaruda({ butir: buka, nilai: Number(nilai), tanggal, catatan }, hari);
    if (!p.ok) { setGalat(p.pesan); return; }
    setGalat('');
    setSibuk(true);
    const r = await api().catatSiagaGaruda({ pesertaId: peserta.id, ...p.nilai });
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan); return; }
    notify('Penetapan disimpan.');
    setBuka(null);
    sg.muat();
  };
  const hapus = async (b) => {
    if (!window.confirm(`Hapus penetapan butir ${b.no}?`)) return;
    const r = await api().hapusSiagaGaruda(peserta.id, b.no);
    if (!r.ok) { notify(r.pesan, 'err'); return; }
    notify('Penetapan dihapus.');
    sg.muat();
  };

  return (
    <section className="panel mb-5 min-w-0 p-4" aria-label="Syarat Siaga Garuda">
      <h2 className="text-base font-bold">Syarat Siaga Garuda</h2>
      <p className="text-xs text-pramuka-600">
        Enam butir, dinilai perseorangan oleh Pembina. Butir 1, 2, 4, dan 5 diberi saran dari data aplikasi (SKU, pelantikan, TKK, dan kegiatan Agenda yang diikuti); penetapan Pembina yang menentukan.
      </p>
      <SumberPeraturan rujukan="garuda-038-2017" className="mt-1" />
      {sg.galat ? (
        <p role="alert" className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-950">{sg.galat}</p>
      ) : sg.memuat ? (
        <p role="status" className="mt-2 text-sm text-pramuka-600">Memuat syarat...</p>
      ) : (
        <>
          <p className="mt-2 text-sm font-semibold text-pramuka-800">
            {ringkas.terpenuhi} dari {ringkas.total} butir terpenuhi{ringkas.siap ? ' (siap diusulkan Siaga Garuda)' : ''}
          </p>
          <ul className="mt-2 divide-y divide-pramuka-100 rounded-md border border-pramuka-100 text-sm">
            {butir.map((b) => (
              <li key={b.no} className="px-3 py-2">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-pramuka-800 [overflow-wrap:anywhere]">{b.no}. {b.judul}</span>
                    <span className="block text-xs text-pramuka-600 [overflow-wrap:anywhere]">{b.uraian}</span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_SIAGA_GARUDA[b.status].kelas}`}>
                    {STATUS_SIAGA_GARUDA[b.status].label}{b.sumber === 'otomatis' ? ' (saran)' : ''}
                  </span>
                </div>
                {b.saran.teks && <p className="mt-1 text-xs text-pramuka-500 [overflow-wrap:anywhere]">Saran aplikasi: {b.saran.teks}</p>}
                {b.penetapan && (
                  <p className="mt-1 text-xs text-pramuka-600 [overflow-wrap:anywhere]">
                    Ditetapkan Pembina {fmtTanggal(b.penetapan.tanggal)}{b.penetapan.catatan ? ` · ${b.penetapan.catatan}` : ''}
                  </p>
                )}
                {dapatMencatat && tataSelesai && buka !== b.no && (
                  <div className="mt-1 flex gap-3 text-xs font-semibold">
                    <button type="button" className="text-pramuka-700 hover:underline" onClick={() => bukaForm(b)}>{b.penetapan ? 'Ubah penetapan' : 'Tetapkan'}</button>
                    {b.penetapan && <button type="button" className="text-red-700 hover:underline" onClick={() => hapus(b)}>Hapus</button>}
                  </div>
                )}
                {buka === b.no && (
                  <form onSubmit={simpan} className="mt-2 grid gap-2 sm:grid-cols-2" aria-label={`Tetapkan butir ${b.no}`}>
                    <label className="min-w-0 text-xs font-semibold text-pramuka-700" htmlFor={`sg-nilai-${b.no}`}>Hasil
                      <select id={`sg-nilai-${b.no}`} className="input mt-0.5 w-full" value={nilai} onChange={(e) => setNilai(e.target.value)}>
                        <option value="100">Memenuhi</option>
                        <option value="0">Belum memenuhi</option>
                      </select>
                    </label>
                    <label className="min-w-0 text-xs font-semibold text-pramuka-700" htmlFor={`sg-tgl-${b.no}`}>Tanggal pengujian
                      <input id={`sg-tgl-${b.no}`} type="date" className="input mt-0.5 w-full" value={tanggal} max={hari} onChange={(e) => setTanggal(e.target.value)} />
                    </label>
                    <label className="min-w-0 text-xs font-semibold text-pramuka-700 sm:col-span-2" htmlFor={`sg-cat-${b.no}`}>Catatan (opsional)
                      <input id={`sg-cat-${b.no}`} className="input mt-0.5 w-full" maxLength={200} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
                    </label>
                    {galat && <p role="alert" className="text-xs font-semibold text-red-700 sm:col-span-2">{galat}</p>}
                    <div className="flex gap-2 sm:col-span-2">
                      <button className="btn btn-primary btn-sm" disabled={sibuk}>{sibuk ? 'Menyimpan...' : 'Simpan'}</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setBuka(null)}>Batal</button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {dapatMencatat && !tataSelesai && <p className="mt-3 text-xs font-medium text-pramuka-600">Syarat baru dapat ditetapkan sesudah seluruh butir SKU Tata lulus.</p>}
        </>
      )}
    </section>
  );
}
