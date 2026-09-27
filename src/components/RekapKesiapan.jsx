import { useApp } from '../context/AppContext';
import { hitungPortofolio, jurnalTerbaru } from '../lib/portofolioLogic';
import { fmtWaktu } from '../lib/format';
import { ProgressBar } from './ui';

/** Ringkasan kesiapan: progress bar, jumlah siap dan belum siap, persentase. Peta 26 dokumen (kotak-kotak yang dapat diklik) ada di PortofolioChecklist. */
export default function RekapKesiapan({ pesertaId }) {
  const { portofolio } = useApp();
  const h = hitungPortofolio(portofolio, pesertaId);

  return (
    <section className="panel p-4" aria-label="Rekap kesiapan portofolio">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          {h.siap} dari {h.total} dokumen siap
        </p>
        <p className="font-display text-2xl font-bold text-pramuka-800">{h.persen}%</p>
      </div>
      <div className="mt-2"><ProgressBar persen={h.persen} tinggi="h-3.5" label="Kesiapan portofolio" /></div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-emerald-50 px-2 py-2.5">
          <dt className="text-xs font-semibold text-emerald-800">Siap</dt>
          <dd className="font-display text-2xl font-bold text-emerald-800">{h.siap}</dd>
        </div>
        <div className="rounded-lg bg-amber-50 px-2 py-2.5">
          <dt className="text-xs font-semibold text-amber-900">Sedang disiapkan</dt>
          <dd className="font-display text-2xl font-bold text-amber-900">{h.proses}</dd>
        </div>
        <div className="rounded-lg bg-pramuka-100 px-2 py-2.5">
          <dt className="text-xs font-semibold text-pramuka-700">Belum ada</dt>
          <dd className="font-display text-2xl font-bold text-pramuka-800">{h.belum}</dd>
        </div>
      </dl>
      <p className="mt-2 text-center text-xs text-pramuka-500">
        Belum siap seluruhnya: {h.belumSiap} dokumen ({100 - h.persen}%)
      </p>
    </section>
  );
}

/** Jurnal kesiapan: aktivitas terbaru lintas dokumen. */
export function JurnalTerbaru({ pesertaId, batas = 6 }) {
  const { portofolio, users } = useApp();
  const daftar = jurnalTerbaru(portofolio, pesertaId, batas);
  const namaOrang = (id) => users.find((u) => u.id === id)?.nama ?? '-';

  return (
    <section className="panel p-4" aria-label="Jurnal kesiapan terbaru">
      <h2 className="mb-2 text-lg font-bold">Jurnal terbaru</h2>
      {daftar.length === 0 ? (
        <p className="text-sm text-pramuka-600">Belum ada aktivitas. Ubah status dokumen pada cek list untuk mulai mencatat jurnal.</p>
      ) : (
        <ol className="space-y-2 border-l-2 border-emas/60 pl-3">
          {daftar.map((r, i) => (
            <li key={i} className="text-sm">
              <p className="font-semibold text-pramuka-900">{r.item.no}. {r.item.jenis}</p>
              <p className="text-xs text-pramuka-600">
                {fmtWaktu(r.waktu)}, {r.teks}
                {r.oleh && <> (oleh {namaOrang(r.oleh)})</>}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
