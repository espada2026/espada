import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import useAbsensiPeriode from '../hooks/useAbsensiPeriode';
import usePelantikanSaka from '../hooks/usePelantikanSaka';
import useTabungan from '../hooks/useTabungan';
import { tahunAjaranDari } from '../lib/absensiLogic';
import { awalTingkat, ringkasLatihan, TARGET_LATIHAN } from '../lib/latihanSiagaLogic';
import { periksaTabungan, ringkasTabungan, TARGET_MINGGU } from '../lib/tabunganLogic';
import { rupiah } from '../lib/iuranLogic';
import { fmtHariTanggal, hariIni } from '../lib/format';
import { ProgressBar } from './ui';

const persen = (n, target) => Math.min(100, Math.round((n / target) * 100));

/**
 * Latihan perindukan dan tabungan satu anak Siaga untuk membantu Pembina menilai butir latihan (butir 11) dan tabungan (butir 4) tiap tingkat.
 * Latihan dibaca dari absensi (hadir; hari latihan bebas); tabungan dicatat Pembina dari pemeriksaan buku tabungan anak (uang tetap di buku anak).
 * `dapatMencatat` = Pembina atau Admin dan anaknya aktif. Hanya bantuan tampilan: nilai butir tetap keputusan Pembina.
 */
export default function PanelLatihanTabungan({ peserta, tingkat, progressAnak, dapatMencatat }) {
  const { absensi, api, notify } = useApp();
  const hari = hariIni();
  const taIni = tahunAjaranDari(hari);
  const taLalu = `${Number(taIni.slice(0, 4)) - 1}/${Number(taIni.slice(0, 4))}`;
  const lalu = useAbsensiPeriode(taLalu, 'setahun'); // latihan dua tahun ajaran terakhir cukup untuk satu tingkat
  const kini = useAbsensiPeriode(taIni, 'setahun');
  const tab = useTabungan(peserta.id);
  const { pelantikan } = usePelantikanSaka();
  const pelantikanAnak = useMemo(() => pelantikan.filter((p) => p.pesertaId === peserta.id), [pelantikan, peserta.id]);

  const sejak = awalTingkat(progressAnak, tingkat, pelantikanAnak);
  const latihan = useMemo(() => ringkasLatihan(absensi, peserta.id, { sejak, hari }), [absensi, peserta.id, sejak, hari]);
  const menabung = useMemo(() => ringkasTabungan(tab.baris, { sejak, hari }), [tab.baris, sejak, hari]);
  const targetL = TARGET_LATIHAN[tingkat];
  const targetT = TARGET_MINGGU[tingkat];

  const [tanggal, setTanggal] = useState(hari);
  const [jumlah, setJumlah] = useState('');
  const [catatan, setCatatan] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const catat = async (e) => {
    e.preventDefault();
    const p = periksaTabungan({ tanggal, jumlah, catatan });
    if (!p.ok) { setGalat(p.pesan); return; }
    setGalat('');
    setSibuk(true);
    const r = await api().catatTabungan({ pesertaId: peserta.id, ...p.nilai });
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan); return; }
    notify('Pemeriksaan tabungan dicatat.');
    setJumlah('');
    setCatatan('');
    tab.muat();
  };
  const hapus = async (t) => {
    if (!window.confirm(`Hapus catatan pemeriksaan tabungan ${fmtHariTanggal(t)}?`)) return;
    const r = await api().hapusTabungan(peserta.id, t);
    if (!r.ok) { notify(r.pesan, 'err'); return; }
    notify('Catatan tabungan dihapus.');
    tab.muat();
  };

  const rentang = sejak ? `sejak ${fmtHariTanggal(sejak)} (selesai tingkat sebelumnya)` : 'sejak awal tercatat';
  return (
    <section className="panel mb-5 grid min-w-0 gap-5 p-4 md:grid-cols-2" aria-label={`Latihan dan tabungan, tingkat ${tingkat}`}>
      <div className="min-w-0">
        <h2 className="text-base font-bold">Latihan perindukan</h2>
        <p className="text-xs text-pramuka-600">Butir latihan tingkat {tingkat}: sedikitnya {targetL} kali. Dihitung dari absensi, {rentang}.</p>
        {!(lalu.siap && kini.siap) ? (
          <p role="status" className="mt-2 text-sm text-pramuka-600">Memuat absensi...</p>
        ) : (
          <>
            <p className="mt-2 text-sm font-semibold text-pramuka-800">
              Hadir {latihan.hadir} dari {latihan.tercatat} latihan tercatat
              {latihan.sesi > latihan.tercatat && <span className="font-normal text-pramuka-500"> ({latihan.sesi - latihan.tercatat} latihan belum dicatat untuk anak ini)</span>}
            </p>
            <div className="mt-1"><ProgressBar persen={persen(latihan.hadir, targetL)} tinggi="h-2.5" label={`Hadir ${latihan.hadir} dari target ${targetL} latihan`} /></div>
            <p className="mt-1 text-xs text-pramuka-600">
              {latihan.hadir >= targetL ? `Sudah mencapai ${targetL} kali latihan.` : `Kurang ${targetL - latihan.hadir} kali latihan lagi.`} Hadir berturut-turut terakhir: {latihan.beruntun} kali.
            </p>
          </>
        )}
      </div>

      <div className="min-w-0">
        <h2 className="text-base font-bold">Tabungan</h2>
        <p className="text-xs text-pramuka-600">Butir tabungan tingkat {tingkat}: menabung teratur sedikitnya {targetT} minggu, {rentang}. Uang tetap di buku anak.</p>
        {tab.galat ? (
          <p role="alert" className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-950">{tab.galat}</p>
        ) : tab.memuat ? (
          <p role="status" className="mt-2 text-sm text-pramuka-600">Memuat tabungan...</p>
        ) : (
          <>
            <p className="mt-2 text-sm font-semibold text-pramuka-800">
              {menabung.minggu} minggu menabung ({menabung.beruntun} berturut-turut){menabung.pemeriksaan > 0 && <span className="font-normal text-pramuka-500">, total setoran {rupiah(menabung.total)}</span>}
            </p>
            <div className="mt-1"><ProgressBar persen={persen(menabung.minggu, targetT)} tinggi="h-2.5" label={`${menabung.minggu} dari target ${targetT} minggu menabung`} /></div>
            {menabung.terputus && <p className="mt-1 text-xs font-semibold text-amber-800">Pemeriksaan terakhir {fmtHariTanggal(menabung.terakhir)}: sudah lebih dari seminggu tanpa setoran tercatat.</p>}
            {tab.baris.length > 0 && (
              <ul className="mt-2 max-h-40 divide-y divide-pramuka-100 overflow-y-auto rounded-md border border-pramuka-100 text-sm">
                {tab.baris.slice(0, 20).map((b) => (
                  <li key={b.tanggal} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
                    <span className="font-semibold text-pramuka-800">{fmtHariTanggal(b.tanggal)}</span>
                    <span>{rupiah(b.jumlah)}</span>
                    {b.catatan && <span className="min-w-0 text-xs text-pramuka-500 [overflow-wrap:anywhere]">{b.catatan}</span>}
                    {dapatMencatat && <button type="button" className="ml-auto text-xs font-semibold text-red-700 hover:underline" onClick={() => hapus(b.tanggal)}>Hapus</button>}
                  </li>
                ))}
              </ul>
            )}
            {dapatMencatat && (
              <form onSubmit={catat} className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr]" aria-label="Catat pemeriksaan tabungan">
                <label className="min-w-0 text-xs font-semibold text-pramuka-700" htmlFor="tab-tanggal">Tanggal periksa
                  <input id="tab-tanggal" type="date" className="input mt-0.5 w-full" value={tanggal} max={hari} onChange={(e) => setTanggal(e.target.value)} />
                </label>
                <label className="min-w-0 text-xs font-semibold text-pramuka-700" htmlFor="tab-jumlah">Setoran minggu itu (Rp)
                  <input id="tab-jumlah" type="number" inputMode="numeric" min="1" className="input mt-0.5 w-full" value={jumlah} onChange={(e) => setJumlah(e.target.value)} />
                </label>
                <label className="min-w-0 text-xs font-semibold text-pramuka-700 sm:col-span-2" htmlFor="tab-catatan">Catatan (opsional)
                  <input id="tab-catatan" type="text" maxLength={200} className="input mt-0.5 w-full" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Mis. dari uang saku sendiri" />
                </label>
                {galat && <p role="alert" className="text-xs font-semibold text-red-700 sm:col-span-2">{galat}</p>}
                <div className="sm:col-span-2"><button className="btn btn-primary btn-sm" disabled={sibuk}>{sibuk ? 'Menyimpan...' : 'Catat pemeriksaan'}</button></div>
              </form>
            )}
          </>
        )}
      </div>
    </section>
  );
}
