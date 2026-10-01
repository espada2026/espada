import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SEMUA_TINGKAT } from '../data/skuData';
import { DAFTAR_TINGKAT_SIAGA } from '../data/skuSiaga';
import { hitungProgres, prasyaratTerpenuhi } from '../lib/skuLogic';
import { tingkatSiagaAwal } from './SiagaSku';
import SkuChecklist from '../components/SkuChecklist';
import PanelLatihanTabungan from '../components/PanelLatihanTabungan';
import PanelTkkSiaga from '../components/PanelTkkSiaga';
import TingkatTabs from '../components/TingkatTabs';
import AjukanModal from '../components/AjukanModal';
import SumberPeraturan from '../components/SumberPeraturan';
import { Icon, ProgressBar } from '../components/ui';

/**
 * SKU Siaga untuk anak Siaga yang punya akun masuk (Pramuka Siaga, Fase 2b): butir Mula, Bantu, dan Tata (SK Kwarnas 119/2011). Anak mengajukan uji langsung ke
 * Pembina (tanpa pra-uji); Pembina menilai dan mencatat hasilnya dengan PIN-nya sendiri. Bantu terbuka sesudah Mula selesai, Tata sesudah Bantu selesai.
 */
export default function SiagaSkuSaya() {
  const { user, progress, batalkanAjuan, hanyaLihatSaya } = useApp();
  const [tingkat, setTingkat] = useState(() => tingkatSiagaAwal(progress, user));
  const [ajukanPoin, setAjukanPoin] = useState(null);

  const terkunci = DAFTAR_TINGKAT_SIAGA.filter((t) => !prasyaratTerpenuhi(progress, user, t).ok);
  const prasyarat = prasyaratTerpenuhi(progress, user, tingkat);
  const h = hitungProgres(progress, user, tingkat);
  const t = SEMUA_TINGKAT[tingkat];

  const renderAksi = (poin, entry) => {
    if (hanyaLihatSaya) return null; // nonaktif dan alumni hanya dapat melihat
    if (entry.status === 'diajukan') {
      return <button className="btn btn-outline btn-sm" onClick={() => batalkanAjuan(poin.id)}>Batalkan pengajuan</button>;
    }
    if (entry.status === 'belum' || entry.status === 'ulang') {
      return (
        <button
          className="btn btn-primary btn-sm"
          disabled={!prasyarat.ok}
          onClick={() => setAjukanPoin(poin)}
          title={prasyarat.ok ? undefined : `Selesaikan seluruh butir ${prasyarat.prasyarat} lebih dulu`}
        >
          <Icon nama="kalender" className="h-3.5 w-3.5" />
          {entry.status === 'ulang' ? 'Ajukan ulang' : 'Ajukan uji'}
        </button>
      );
    }
    return null;
  };

  return (
    <div className="animasi-naik">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{t.judul}</h1>
          <p className="text-sm text-pramuka-600">
            {t.butir.length} butir resmi Kwarnas. Butir 1 menyesuaikan agamamu ({user.agama || 'belum diisi'}).
          </p>
          <SumberPeraturan className="mt-1" rujukan="sku-siaga-2011" />
        </div>
        <TingkatTabs nilai={tingkat} onUbah={setTingkat} daftar={DAFTAR_TINGKAT_SIAGA} terkunci={terkunci} label="Tingkat SKU Siaga" />
      </div>

      <div className="panel mb-5 p-4">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="font-semibold">{h.lulus} dari {h.total} butir lulus</span>
          <span className="font-display text-lg font-bold text-pramuka-800">{h.persen}%</span>
        </div>
        <ProgressBar persen={h.persen} tinggi="h-3" label={`Progres ${tingkat}`} />
      </div>

      {!user.agama && !hanyaLihatSaya && (
        <p role="alert" className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Agamamu belum diisi, jadi butir agama belum tampil dan SKU belum dapat diajukan. Minta Pembina mengisinya, atau isi di menu <strong>Akun saya</strong>.
        </p>
      )}

      {!prasyarat.ok && (
        <p className="jahitan mb-5 flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm text-pramuka-700">
          <Icon nama="kunci" className="h-4 w-4 shrink-0" />
          Kamu bisa melihat butir {tingkat}, tetapi pengajuan baru dibuka setelah seluruh butir {prasyarat.prasyarat} lulus.
        </p>
      )}

      <PanelLatihanTabungan peserta={user} tingkat={tingkat} progressAnak={progress[user.id]} dapatMencatat={false} />
      <SkuChecklist tingkat={tingkat} peserta={user} renderAksi={renderAksi} />
      <div className="mt-5"><PanelTkkSiaga peserta={user} dapatMencatat={false} /></div>
      {ajukanPoin && <AjukanModal poin={ajukanPoin} onTutup={() => setAjukanPoin(null)} />}
    </div>
  );
}
