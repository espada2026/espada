import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import '../data/skuSiaga'; // mendaftarkan katalog SKU Siaga supaya hitungan Mula/Bantu/Tata bekerja
import { rekapPerBarung, rekapSiaga, ringkasRekapSiaga } from '../lib/rekapSiagaLogic';
import { anggotaSiaga } from '../lib/siagaLogic';
import { fmtTanggal, hariIni } from '../lib/format';
import { useGudep } from '../lib/gudepStore';
import FilterBar, { FILTER_AWAL, terapkanFilter } from '../components/FilterBar';
import RingkasanGudep from '../components/RingkasanGudep';
import { labelJenisKelamin } from '../lib/jenisKelaminLogic';
import { Icon, Kosong, ProgressBar } from '../components/ui';

function unduhCsv(rekap) {
  const kepala = [
    'Nama', 'Jenis Kelamin', 'NIS', 'Kelas', 'Perindukan', 'Barung', 'Agama',
    'Mula lulus', 'Mula total', 'Mula persen', 'Tanggal lulus Mula',
    'Bantu lulus', 'Bantu total', 'Bantu persen', 'Tanggal lulus Bantu',
    'Tata lulus', 'Tata total', 'Tata persen', 'Tanggal lulus Tata',
  ];
  const baris = rekap.map((r) => [
    r.user.nama, labelJenisKelamin(r.user.jenisKelamin), r.user.nis ?? '', r.user.kelas ?? '', r.user.perindukan ?? '', r.user.barung ?? '', r.user.agama ?? '',
    r.mula.lulus, r.mula.total, r.mula.persen, r.tglMula ?? '',
    r.bantu.lulus, r.bantu.total, r.bantu.persen, r.tglBantu ?? '',
    r.tata.lulus, r.tata.total, r.tata.persen, r.tglTata ?? '',
  ]);
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  // Pemisah titik koma dan BOM agar terbaca benar di Excel berbahasa Indonesia
  const csv = `\ufeff${[kepala, ...baris].map((b) => b.map(esc).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `rekap-sku-siaga-${hariIni()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Kolom progres satu tingkat pada tabel rekap per anak. */
function SelTingkat({ h, tgl, label }) {
  return (
    <td className="px-4 py-3">
      <div className="w-28">
        <p className="mb-1 text-xs">{h.lulus}/{h.total} ({h.persen}%)</p>
        <ProgressBar persen={h.persen} label={label} />
        {tgl && <p className="mt-1 text-xs text-pramuka-500">Lulus {fmtTanggal(tgl)}</p>}
      </div>
    </td>
  );
}

export default function AdminDashboard({ onBuka, onNav }) {
  const G = useGudep();
  const { users, progress } = useApp();
  const anakAktif = useMemo(() => anggotaSiaga(users).filter((u) => (u.status ?? 'aktif') === 'aktif'), [users]);
  const [filter, setFilter] = useState(FILTER_AWAL);

  const rekap = useMemo(() => rekapSiaga(progress, users), [progress, users]);
  const tersaring = useMemo(() => {
    const idOk = new Set(terapkanFilter(rekap.map((r) => r.user), filter).map((u) => u.id));
    return rekap.filter((r) => idOk.has(r.user.id)).sort((a, b) => a.user.nama.localeCompare(b.user.nama, 'id'));
  }, [rekap, filter]);

  const perBarung = useMemo(() => rekapPerBarung(rekap), [rekap]);
  const ringkas = useMemo(() => ringkasRekapSiaga(rekap), [rekap]);

  const angka = [
    { nilai: ringkas.jumlah, label: 'Anggota Siaga aktif' },
    { nilai: ringkas.mula, label: 'Lulus SKU Mula' },
    { nilai: ringkas.bantu, label: 'Lulus SKU Bantu' },
    { nilai: ringkas.tata, label: 'Lulus SKU Tata' },
  ];

  return (
    <div className="animasi-naik">
      <div className="print-only mb-4 border-b-2 border-pramuka-800 pb-2 text-center">
        <p className="text-lg font-bold">Rekapitulasi Kelulusan SKU Siaga</p>
        <p className="text-sm">{G.nama}. Dicetak {fmtTanggal(hariIni())}</p>
      </div>

      <div className="no-print mb-4">
        <h1 className="text-2xl font-bold">Dashboard Admin Gudep</h1>
        <p className="text-sm text-pramuka-600">Ringkasan anggota Siaga, absensi latihan perindukan, iuran, dan kelulusan SKU Mula, Bantu, dan Tata.</p>
      </div>

      <div className="no-print mb-6"><RingkasanGudep onNav={onNav} /></div>

      <div className="no-print mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-bold">Rekapitulasi SKU</h2>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" onClick={() => unduhCsv(tersaring)}>
            <Icon nama="unduh" className="h-4 w-4" /> Unduh CSV
          </button>
          <button className="btn btn-gold btn-sm" onClick={() => window.print()}>
            <Icon nama="cetak" className="h-4 w-4" /> Cetak atau simpan PDF
          </button>
        </div>
      </div>

      <section className="panel mb-5 grid grid-cols-2 divide-pramuka-100 md:grid-cols-4 md:divide-x">
        {angka.map((a, i) => (
          <div key={a.label} className={`p-4 ${i > 1 ? 'border-t border-pramuka-100 md:border-t-0' : ''}`}>
            <p className="font-display text-3xl font-bold text-pramuka-800">{a.nilai}</p>
            <p className="text-sm text-pramuka-600">{a.label}</p>
          </div>
        ))}
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-lg font-bold">Per barung</h2>
        <div className="panel overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-pramuka-100 text-pramuka-800">
              <tr>
                <th className="px-4 py-2 font-semibold">Barung</th>
                <th className="px-4 py-2 font-semibold">Anggota</th>
                <th className="px-4 py-2 font-semibold">Lulus Mula</th>
                <th className="px-4 py-2 font-semibold">Lulus Bantu</th>
                <th className="px-4 py-2 font-semibold">Lulus Tata</th>
                <th className="px-4 py-2 font-semibold">Rata-rata Mula</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pramuka-100">
              {perBarung.length === 0 && <tr><td className="px-4 py-3 text-pramuka-600" colSpan={6}>Belum ada anggota Siaga aktif.</td></tr>}
              {perBarung.map((g) => (
                <tr key={g.kunci || 'tanpa'}>
                  <td className="px-4 py-2 font-semibold">{g.barung}</td>
                  <td className="px-4 py-2">{g.jumlah}</td>
                  <td className="px-4 py-2">{g.mulaLulus}</td>
                  <td className="px-4 py-2">{g.bantuLulus}</td>
                  <td className="px-4 py-2">{g.tataLulus}</td>
                  <td className="px-4 py-2">{g.rataMula}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Rekap per anggota</h2>
        <div className="mb-3"><FilterBar data={anakAktif} filter={filter} setFilter={setFilter} tampil={['kelas', 'agama', 'jk']} /></div>

        {tersaring.length === 0 ? (
          <Kosong judul="Tidak ada data" teks="Ubah kata kunci, kelas, agama, atau jenis kelamin pada filter." />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-pramuka-100 text-pramuka-800">
                <tr>
                  <th className="px-4 py-2 font-semibold">Nama</th>
                  <th className="px-4 py-2 font-semibold">Kelas, barung</th>
                  <th className="px-4 py-2 font-semibold">Mula</th>
                  <th className="px-4 py-2 font-semibold">Bantu</th>
                  <th className="px-4 py-2 font-semibold">Tata</th>
                  <th className="no-print px-4 py-2"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pramuka-100">
                {tersaring.map((r) => (
                  <tr key={r.user.id}>
                    <td className="px-4 py-3 font-semibold">{r.user.nama}<span className="block text-xs font-normal text-pramuka-500">{r.user.agama}</span></td>
                    <td className="px-4 py-3 text-pramuka-600">{r.user.kelas}{r.user.barung ? `, ${r.user.barung}` : ''}</td>
                    <SelTingkat h={r.mula} tgl={r.tglMula} label="Mula" />
                    <SelTingkat h={r.bantu} tgl={r.tglBantu} label="Bantu" />
                    <SelTingkat h={r.tata} tgl={r.tglTata} label="Tata" />
                    <td className="no-print px-4 py-3 text-right">
                      <button className="btn btn-outline btn-sm" onClick={() => onBuka(r.user.id)}>Rincian</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
