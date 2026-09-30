import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useKonteksMenilai } from '../hooks/useRombelSaya';
import { SEMUA_TINGKAT } from '../data/skuData';
import { DAFTAR_TINGKAT_SIAGA } from '../data/skuSiaga';
import { bolehMenilaiPoin, hitungProgres, prasyaratTerpenuhi, tingkatSelesai } from '../lib/skuLogic';
import { suratAgamaAktif } from '../lib/dokumenLogic';
import { anggotaAktif, statusAnggota } from '../lib/naikKelasLogic';
import { labelJenisKelamin } from '../lib/jenisKelaminLogic';
import SkuChecklist from '../components/SkuChecklist';
import TingkatTabs from '../components/TingkatTabs';
import UjiModal from '../components/UjiModal';
import SumberPeraturan from '../components/SumberPeraturan';
import { Avatar, BadgeStatus, Icon, Kosong, ProgressBar } from '../components/ui';

/** Tingkat Siaga tertinggi yang sudah terbuka (prasyaratnya selesai) dan belum selesai; dipakai sebagai tab awal. */
export function tingkatSiagaAwal(progress, peserta) {
  const buka = DAFTAR_TINGKAT_SIAGA.filter((t) => prasyaratTerpenuhi(progress, peserta, t).ok);
  return buka.find((t) => !tingkatSelesai(progress, peserta, t)) ?? buka[buka.length - 1] ?? DAFTAR_TINGKAT_SIAGA[0];
}

/**
 * SKU satu anak Siaga (Pramuka Siaga, Fase 2): butir SK Kwarnas 119/2011 per tingkat (Mula, Bantu, Tata). Anak tidak punya akun, jadi tidak ada pengajuan:
 * Pembina menilai langsung butir demi butir (memasukkan PIN sendiri, seperti SKU Penegak); Admin hanya melihat.
 */
export default function SiagaSku({ pesertaId, onKembali }) {
  const { daftarPesertaSemua, progress, user, dokumen, muatDokumen } = useApp();
  const konteks = useKonteksMenilai();
  useEffect(() => { if (user.role !== 'peserta') muatDokumen(); }, [user.role, muatDokumen]); // surat pengantar agama memengaruhi siapa yang boleh menilai butir agama
  const peserta = daftarPesertaSemua.find((u) => u.id === pesertaId);
  const [tingkat, setTingkat] = useState(() => (peserta ? tingkatSiagaAwal(progress, peserta) : DAFTAR_TINGKAT_SIAGA[0]));
  const [uji, setUji] = useState(null);
  if (!peserta) return <Kosong judul="Anggota tidak ditemukan" />;

  const aktif = anggotaAktif(peserta);
  const tanpaAgama = !peserta.agama;
  const bisaMenguji = user.role === 'penguji' && aktif && !tanpaAgama; // nonaktif dan alumni hanya dilihat; tanpa agama server menolak semua penulisan SKU
  const terkunci = DAFTAR_TINGKAT_SIAGA.filter((t) => !prasyaratTerpenuhi(progress, peserta, t).ok);
  const h = hitungProgres(progress, peserta, tingkat);
  const prasyarat = prasyaratTerpenuhi(progress, peserta, tingkat);

  const renderAksi = (poin, entry) => {
    if (!bisaMenguji) return null;
    if (!bolehMenilaiPoin(user, poin, { ...konteks, peserta })) {
      return <span className="text-xs font-semibold text-pramuka-500">{poin.agama ? 'Butir agama dinilai Pembina seagama' : 'Hanya Pembina yang menilai'}</span>;
    }
    const lewatSurat = poin.agama && suratAgamaAktif(dokumen, peserta.id, poin.id) && (user.agama ?? null) !== peserta.agama;
    const dikunci = !prasyarat.ok && entry.status !== 'lulus';
    return (
      <span className="flex flex-col items-end gap-1">
        <button
          className={`btn btn-sm ${entry.status === 'lulus' ? 'btn-outline' : 'btn-primary'}`}
          disabled={dikunci}
          title={dikunci ? `Anak ini belum menyelesaikan seluruh butir ${prasyarat.prasyarat}` : undefined}
          onClick={() => setUji({ poin })}
        >
          {entry.status === 'lulus' ? 'Tinjau' : 'Nilai butir'}
        </button>
        {lewatSurat && entry.status !== 'lulus' && <span className="text-[11px] font-semibold text-pramuka-500">Dinilai guru agama (surat pengantar)</span>}
      </span>
    );
  };

  return (
    <div className="animasi-naik">
      <button onClick={onKembali} className="no-print mb-3 flex items-center gap-1.5 text-sm font-semibold text-pramuka-700 hover:text-pramuka-900">
        <Icon nama="kembali" className="h-4 w-4" /> Kembali
      </button>

      <section className="panel mb-5 flex flex-wrap items-center gap-4 p-4">
        <Avatar nama={peserta.nama} ukuran="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight [overflow-wrap:anywhere]">{peserta.nama}</h1>
          <p className="text-sm text-pramuka-600 [overflow-wrap:anywhere]">
            Kelas {peserta.kelas}{peserta.jenisKelamin ? `, ${labelJenisKelamin(peserta.jenisKelamin)}` : ''}{peserta.agama ? `, ${peserta.agama}` : ''}
            {peserta.perindukan ? ` | ${peserta.perindukan}${peserta.barung ? ` / ${peserta.barung}` : ''}` : ''}
          </p>
          {!aktif && <p className="mt-1"><BadgeStatus status={statusAnggota(peserta)} /></p>}
        </div>
      </section>

      {!aktif && (
        <p role="status" className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {peserta.nama} berstatus <b>{statusAnggota(peserta) === 'alumni' ? 'alumni' : 'nonaktif'}</b>: data hanya dapat dilihat; penilaian tidak dapat dilakukan.
        </p>
      )}
      {aktif && tanpaAgama && (
        <p role="status" className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Agama {peserta.nama} belum dicatat. Isi agamanya lebih dulu di menu <b>Anggota Siaga</b> (ubah data anak): butir agama bergantung padanya, dan penilaian belum dapat dicatat.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TingkatTabs nilai={tingkat} onUbah={setTingkat} daftar={DAFTAR_TINGKAT_SIAGA} terkunci={terkunci} label="Tingkat SKU Siaga" />
        <p className="text-sm font-semibold text-pramuka-700">{h.lulus} dari {h.total} butir lulus ({h.persen}%)</p>
      </div>
      <div className="mb-2"><ProgressBar persen={h.persen} tinggi="h-3" label={`Progres ${SEMUA_TINGKAT[tingkat].judul}`} /></div>
      {!prasyarat.ok && (
        <p className="mb-3 text-xs font-medium text-pramuka-600">Tingkat {tingkat} baru dapat dinilai sesudah seluruh butir {prasyarat.prasyarat} lulus.</p>
      )}
      <p className="mb-1 text-xs text-pramuka-600">Butir dinilai Pembina secara informal dan individual, butir demi butir; kenaikan tingkat lewat upacara pelantikan.</p>
      <SumberPeraturan rujukan="sku-siaga-2011" className="mb-4" />

      <SkuChecklist tingkat={tingkat} peserta={peserta} renderAksi={renderAksi} />
      {uji && <UjiModal pesertaId={peserta.id} poin={uji.poin} onTutup={() => setUji(null)} />}
    </div>
  );
}
