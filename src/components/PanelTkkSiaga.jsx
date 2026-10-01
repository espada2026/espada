import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import useTkkSiaga from '../hooks/useTkkSiaga';
import { tingkatSelesai } from '../lib/skuLogic';
import { BIDANG_TKK, INDEKS_TKK } from '../data/tkkData';
import { periksaTkkSiaga, pilihanTkkSiaga, ringkasTkkSiaga } from '../lib/tkkSiagaLogic';
import { fmtHariTanggal, hariIni } from '../lib/format';
import SumberPeraturan from './SumberPeraturan';

/**
 * Tanda Kecakapan Khusus (TKK) satu anak Siaga (Pramuka Siaga, Fase 5): SATU tingkat saja, dikenakan sesudah Siaga Bantu (SK Kwarnas 134/1976 dan 132/1979).
 * Pembina atau Admin mencatat TKK yang sudah lulus diuji; anak dan orang tua hanya melihat. `dapatMencatat` = Pembina atau Admin dan anaknya aktif.
 * Hanya catatan: syarat tiap SKK diuji Pembina di luar aplikasi (isi SK tidak disalin).
 */
export default function PanelTkkSiaga({ peserta, dapatMencatat }) {
  const { progress, api, notify } = useApp();
  const hari = hariIni();
  const tkk = useTkkSiaga(peserta.id);
  const bantuSelesai = tingkatSelesai(progress, peserta, 'Bantu');
  const ringkas = useMemo(() => ringkasTkkSiaga(tkk.baris), [tkk.baris]);
  const pilihan = useMemo(() => pilihanTkkSiaga(peserta.agama, tkk.baris), [peserta.agama, tkk.baris]);

  const [tkkId, setTkkId] = useState('');
  const [tanggal, setTanggal] = useState(hari);
  const [penguji, setPenguji] = useState('');
  const [bukti, setBukti] = useState('');
  const [catatan, setCatatan] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const catat = async (e) => {
    e.preventDefault();
    const p = periksaTkkSiaga({ tkkId, tanggal, penguji, buktiUrl: bukti, catatan, agama: peserta.agama }, hari);
    if (!p.ok) { setGalat(p.pesan); return; }
    setGalat('');
    setSibuk(true);
    const r = await api().catatTkkSiaga({ pesertaId: peserta.id, ...p.nilai });
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan); return; }
    notify('TKK dicatat.');
    setTkkId('');
    setBukti('');
    setCatatan('');
    tkk.muat();
  };
  const hapus = async (b) => {
    if (!window.confirm(`Hapus catatan TKK ${INDEKS_TKK[b.tkkId]?.nama ?? b.tkkId}?`)) return;
    const r = await api().hapusTkkSiaga(b.id);
    if (!r.ok) { notify(r.pesan, 'err'); return; }
    notify('Catatan TKK dihapus.');
    tkk.muat();
  };

  return (
    <section className="panel mb-5 min-w-0 p-4" aria-label="Tanda Kecakapan Khusus">
      <h2 className="text-base font-bold">Tanda Kecakapan Khusus (TKK)</h2>
      <p className="text-xs text-pramuka-600">
        TKK Siaga hanya satu tingkat dan dikenakan sesudah Siaga Bantu. Pembina menguji syaratnya; di sini hanya dicatat yang sudah lulus.
      </p>
      <SumberPeraturan rujukan="skk-132-1979" className="mt-1" />
      {tkk.galat ? (
        <p role="alert" className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-950">{tkk.galat}</p>
      ) : tkk.memuat ? (
        <p role="status" className="mt-2 text-sm text-pramuka-600">Memuat TKK...</p>
      ) : (
        <>
          <p className="mt-2 text-sm font-semibold text-pramuka-800">
            {ringkas.total === 0 ? 'Belum ada TKK tercatat.' : `${ringkas.total} TKK`}
            {ringkas.total > 0 && (
              <span className="font-normal text-pramuka-500"> ({Object.entries(BIDANG_TKK).map(([no, b]) => `${b.singkat} ${ringkas.perBidang[no]}`).join(', ')})</span>
            )}
          </p>
          {tkk.baris.length > 0 && (
            <ul className="mt-2 max-h-48 divide-y divide-pramuka-100 overflow-y-auto rounded-md border border-pramuka-100 text-sm">
              {tkk.baris.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
                  <span className="min-w-0 font-semibold text-pramuka-800 [overflow-wrap:anywhere]">{INDEKS_TKK[b.tkkId]?.nama ?? b.tkkId}</span>
                  <span className="text-xs text-pramuka-600">{fmtHariTanggal(b.tanggal)} · penguji {b.penguji}</span>
                  {b.catatan && <span className="min-w-0 text-xs text-pramuka-500 [overflow-wrap:anywhere]">{b.catatan}</span>}
                  {b.buktiUrl && <a className="text-xs font-semibold text-pramuka-700 underline" href={b.buktiUrl} target="_blank" rel="noopener noreferrer">Bukti</a>}
                  {dapatMencatat && <button type="button" className="ml-auto text-xs font-semibold text-red-700 hover:underline" onClick={() => hapus(b)}>Hapus</button>}
                </li>
              ))}
            </ul>
          )}
          {dapatMencatat && !bantuSelesai && (
            <p className="mt-3 text-xs font-medium text-pramuka-600">TKK baru dapat dicatat sesudah seluruh butir Bantu lulus.</p>
          )}
          {dapatMencatat && bantuSelesai && !peserta.agama && (
            <p className="mt-3 text-xs font-medium text-amber-800">Isi agama anak lebih dulu (menu Anggota Siaga) sebelum mencatat TKK.</p>
          )}
          {dapatMencatat && bantuSelesai && peserta.agama && (
            <form onSubmit={catat} className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Catat TKK">
              <label className="min-w-0 text-xs font-semibold text-pramuka-700 sm:col-span-2" htmlFor="tkks-tkk">TKK yang lulus
                <select id="tkks-tkk" className="input mt-0.5 w-full" value={tkkId} onChange={(e) => setTkkId(e.target.value)}>
                  <option value="">Pilih TKK...</option>
                  {pilihan.map((g) => (
                    <optgroup key={g.bidang} label={g.singkat}>
                      {g.daftar.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-xs font-semibold text-pramuka-700" htmlFor="tkks-tanggal">Tanggal lulus
                <input id="tkks-tanggal" type="date" className="input mt-0.5 w-full" value={tanggal} max={hari} onChange={(e) => setTanggal(e.target.value)} />
              </label>
              <label className="min-w-0 text-xs font-semibold text-pramuka-700" htmlFor="tkks-penguji">Nama penguji
                <input id="tkks-penguji" className="input mt-0.5 w-full" maxLength={80} value={penguji} onChange={(e) => setPenguji(e.target.value)} />
              </label>
              <label className="min-w-0 text-xs font-semibold text-pramuka-700" htmlFor="tkks-bukti">Tautan bukti (opsional)
                <input id="tkks-bukti" className="input mt-0.5 w-full" maxLength={500} value={bukti} onChange={(e) => setBukti(e.target.value)} placeholder="https://..." />
              </label>
              <label className="min-w-0 text-xs font-semibold text-pramuka-700" htmlFor="tkks-catatan">Catatan (opsional)
                <input id="tkks-catatan" className="input mt-0.5 w-full" maxLength={200} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
              </label>
              {galat && <p role="alert" className="text-xs font-semibold text-red-700 sm:col-span-2">{galat}</p>}
              <div className="sm:col-span-2"><button className="btn btn-primary btn-sm" disabled={sibuk}>{sibuk ? 'Menyimpan...' : 'Catat TKK'}</button></div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
