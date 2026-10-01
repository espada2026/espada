import { useApp } from '../context/AppContext';
import { DAFTAR_TINGKAT_SIAGA } from '../data/skuSiaga';
import { SEMUA_TINGKAT } from '../data/skuData';
import { cariPoin, hitungProgres, prasyaratTerpenuhi } from '../lib/skuLogic';
import { fmtTanggal } from '../lib/format';
import { Badge, Icon, Kosong, Lencana, ProgressBar, TeksPoin } from '../components/ui';
import { tingkatSiagaAwal } from './SiagaSku';
import KartuPelantikanSaya from '../components/KartuPelantikanSaya';

/**
 * Beranda anak Siaga yang punya akun masuk (Pramuka Siaga, Fase 2b): kemajuan SKU Mula, Bantu, Tata, agenda pengujian, dan butir yang perlu diulang.
 * Kartu pelantikan memuat tanggal dan tempat pelantikan Mula/Bantu/Tata (dicatat Pembina; Fase 4). Kehadiran dan iuran menyusul pada fase berikutnya.
 */
export default function SiagaBeranda({ setTab }) {
  const { user, users, progress, batalkanAjuan, hanyaLihatSaya } = useApp();
  const awal = tingkatSiagaAwal(progress, user);
  const fokus = hitungProgres(progress, user, awal);

  const entri = Object.entries(progress[user.id] ?? {}).map(([skuId, entry]) => ({ poin: cariPoin(skuId), entry })).filter((x) => x.poin);
  const agenda = entri.filter((x) => x.entry.status === 'diajukan' || x.entry.status === 'proses')
    .sort((a, b) => (a.entry.jadwal ?? '9999').localeCompare(b.entry.jadwal ?? '9999'));
  const diulang = entri.filter((x) => x.entry.status === 'ulang');
  const namaPenguji = (id) => users.find((u) => u.id === id)?.nama ?? '-';

  return (
    <div className="space-y-5 animasi-naik">
      <section className="flex items-center gap-5 rounded-lg border-2 border-emas bg-pramuka-800 p-5 text-pramuka-50">
        <Lencana persen={fokus.persen} />
        <div className="min-w-0">
          <p className="text-sm text-pramuka-300">Selamat datang,</p>
          <h1 className="text-2xl font-bold leading-tight [overflow-wrap:anywhere]">{user.nama}</h1>
          <p className="mt-1 text-sm text-pramuka-200">
            Kelas {user.kelas}{user.perindukan ? `, ${user.perindukan}` : ''}{user.barung ? ` / ${user.barung}` : ''}{user.agama ? `, ${user.agama}` : ''}
          </p>
          <p className="mt-2 inline-block rounded-md bg-emas px-2.5 py-1 text-sm font-bold text-pramuka-900">Pramuka Siaga {awal}</p>
          <p className="mt-2 text-xs text-pramuka-300">Lencana menunjukkan progres SKU {awal}: {fokus.lulus} dari {fokus.total} butir lulus.</p>
        </div>
      </section>

      <section className="panel divide-y divide-pramuka-100">
        {DAFTAR_TINGKAT_SIAGA.map((nama) => {
          const h = hitungProgres(progress, user, nama);
          const terkunci = !prasyaratTerpenuhi(progress, user, nama).ok;
          return (
            <div key={nama} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{SEMUA_TINGKAT[nama].judul}</h2>
                  <p className="text-sm text-pramuka-600">{h.lulus} dari {h.total} butir lulus{h.diproses > 0 && `, ${h.diproses} dalam proses`}</p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => setTab('sku')}>
                  {terkunci && <Icon nama="kunci" className="h-3.5 w-3.5" />}
                  Lihat butir
                </button>
              </div>
              <div className="mt-3"><ProgressBar persen={h.persen} tinggi="h-2.5" label={`Progres ${nama}`} /></div>
              {terkunci && <p className="mt-2 text-xs text-pramuka-500">Terbuka setelah seluruh butir tingkat sebelumnya lulus.</p>}
            </div>
          );
        })}
      </section>

      <KartuPelantikanSaya />

      <section>
        <h2 className="mb-2 text-lg font-bold">Agenda pengujian</h2>
        {agenda.length === 0 ? (
          <Kosong judul="Belum ada jadwal pengujian" teks="Pilih butir yang sudah kamu kuasai, lalu ajukan ke Pembina.">
            <button className="btn btn-primary btn-sm" onClick={() => setTab('sku')}>Pilih butir untuk diajukan</button>
          </Kosong>
        ) : (
          <ul className="panel divide-y divide-pramuka-100">
            {agenda.map(({ poin, entry }) => (
              <li key={poin.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><TeksPoin poin={poin} /></div>
                  <Badge status={entry.status} />
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-pramuka-600">
                  <Icon nama="kalender" className="h-3.5 w-3.5" />
                  {poin.tingkat}, {fmtTanggal(entry.jadwal ?? entry.tanggalUji)}, penguji {entry.pengujiId ? namaPenguji(entry.pengujiId) : 'antrian Pembina'}
                </p>
                {entry.status === 'diajukan' && !hanyaLihatSaya && (
                  <button className="btn btn-outline btn-sm mt-2" onClick={() => batalkanAjuan(poin.id)}>Batalkan pengajuan</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {diulang.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold">Perlu diulang</h2>
          <ul className="panel divide-y divide-pramuka-100">
            {diulang.map(({ poin, entry }) => (
              <li key={poin.id} className="p-4">
                <TeksPoin poin={poin} />
                <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900"><span className="font-semibold">Catatan penguji:</span> {entry.catatan}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
