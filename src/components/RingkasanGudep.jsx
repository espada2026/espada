import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { AMBANG_HADIR } from '../config';
import { anggotaSiaga } from '../lib/siagaLogic';
import {
  periodeDari, PERIODE, rekapAbsensi, ringkasAbsensi, sesiPeriode, tahunAjaranDari,
} from '../lib/absensiLogic';
import { hariIni } from '../lib/format';
import { hitungJenisKelamin } from '../lib/jenisKelaminLogic';
import useAbsensiPeriode from '../hooks/useAbsensiPeriode';
import { Icon, MuatAbsensi, ProgressBar } from './ui';
import KartuIuran from './KartuIuran';

/**
 * Ringkasan lintas fitur untuk dashboard Admin Gudep Siaga: komposisi anggota, rekap absensi semester berjalan, dan iuran.
 * onNav(tab, pesertaId?) berpindah ke menu terkait.
 */
export default function RingkasanGudep({ onNav }) {
  const { daftarPesertaSemua, absensi } = useApp();
  const daftarPeserta = useMemo(() => anggotaSiaga(daftarPesertaSemua).filter((u) => (u.status ?? 'aktif') === 'aktif'), [daftarPesertaSemua]);

  const ta = tahunAjaranDari(hariIni());
  const periode = periodeDari(hariIni());
  const abs = useAbsensiPeriode(ta, periode); // semester berjalan sudah dimuat saat masuk; ini menjaga bila semester berganti

  const absen = useMemo(() => {
    const sesi = sesiPeriode(absensi, ta, periode);
    const rekap = rekapAbsensi(absensi, daftarPeserta, sesi);
    const rendah = rekap
      .filter((r) => r.persen !== null && r.persen < AMBANG_HADIR)
      .sort((a, b) => a.persen - b.persen);
    return { ...ringkasAbsensi(rekap, sesi, AMBANG_HADIR), rendah: rendah.length, daftarRendah: rendah.slice(0, 5) };
  }, [absensi, daftarPeserta, ta, periode]);

  const jk = hitungJenisKelamin(daftarPeserta);
  const semuaAnak = anggotaSiaga(daftarPesertaSemua);
  const arsip = { nonaktif: semuaAnak.filter((u) => u.status === 'nonaktif').length, alumni: semuaAnak.filter((u) => u.status === 'alumni').length };
  const komposisi = [
    { label: 'Tanpa akun masuk', jumlah: daftarPeserta.filter((u) => u.tanpaAkun).length },
    { label: 'Punya akun masuk', jumlah: daftarPeserta.filter((u) => !u.tanpaAkun).length },
    { label: 'Sudah berbarung', jumlah: daftarPeserta.filter((u) => u.perindukan && u.barung).length },
  ];

  return (
    <div className="space-y-5">
      <section aria-label="Komposisi anggota">
        <h2 className="mb-2 text-lg font-bold">Anggota Siaga</h2>
        <div className="panel grid grid-cols-2 divide-pramuka-100 md:grid-cols-4 md:divide-x">
          <div className="p-4">
            <p className="font-display text-3xl font-bold text-pramuka-800">{daftarPeserta.length}</p>
            <p className="text-sm text-pramuka-600">Total anggota Siaga aktif</p>
          </div>
          {komposisi.map((p, i) => (
            <div key={p.label} className={`p-4 ${i > 0 ? 'border-t border-pramuka-100 md:border-t-0' : ''}`}>
              <p className="font-display text-3xl font-bold text-pramuka-800">{p.jumlah}</p>
              <p className="text-sm text-pramuka-600">{p.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-pramuka-600">
          Laki-laki <span className="font-semibold text-pramuka-800">{jk.L}</span>, perempuan <span className="font-semibold text-pramuka-800">{jk.P}</span>
          {jk.kosong > 0 && <>, <span className="font-semibold text-amber-700">{jk.kosong} belum diisi jenis kelaminnya</span></>}
        </p>
        {(arsip.nonaktif > 0 || arsip.alumni > 0) && (
          <p className="mt-1 text-xs text-pramuka-500">Tidak dihitung di atas: {arsip.nonaktif} nonaktif, {arsip.alumni} alumni (lihat di menu Anggota Siaga).</p>
        )}
      </section>

      <section aria-label="Rekap absensi">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Absensi latihan perindukan</h2>
            <p className="text-sm text-pramuka-600">{PERIODE[periode]} {ta}</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => onNav('absensi')}>
            <Icon nama="absensi" className="h-4 w-4" /> Rekap lengkap dan Excel
          </button>
        </div>
        {!abs.siap ? <MuatAbsensi galat={abs.galat} coba={abs.coba} /> : (<>
        <div className="panel grid grid-cols-2 divide-pramuka-100 md:grid-cols-4 md:divide-x">
          <div className="p-4">
            <p className="font-display text-3xl font-bold text-pramuka-800">{absen.pertemuan}</p>
            <p className="text-sm text-pramuka-600">Pertemuan terlaksana</p>
          </div>
          <div className="border-t border-pramuka-100 p-4 md:border-t-0">
            <p className="font-display text-3xl font-bold text-pramuka-800">{absen.rata === null ? '-' : `${absen.rata}%`}</p>
            <p className="text-sm text-pramuka-600">Rata-rata kehadiran</p>
          </div>
          <div className="p-4">
            <p className="font-display text-3xl font-bold text-emerald-700">{absen.baik}</p>
            <p className="text-sm text-pramuka-600">Kehadiran {AMBANG_HADIR}% ke atas</p>
          </div>
          <div className="p-4">
            <p className="font-display text-3xl font-bold text-red-700">{absen.rendah}</p>
            <p className="text-sm text-pramuka-600">Di bawah {AMBANG_HADIR}%</p>
          </div>
        </div>
        {absen.daftarRendah.length > 0 && (
          <div className="panel mt-3 p-4">
            <p className="mb-2 text-sm font-semibold text-pramuka-800">Perlu perhatian (kehadiran terendah)</p>
            <ul className="space-y-2">
              {absen.daftarRendah.map((r) => (
                <li key={r.user.id} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold">{r.user.nama}</span>
                    <span className="text-pramuka-500">, kelas {r.user.kelas}{r.user.barung ? `, barung ${r.user.barung}` : ''}</span>
                  </span>
                  <span className="w-24"><ProgressBar persen={r.persen} label={`Kehadiran ${r.user.nama}`} /></span>
                  <span className="w-10 text-right font-semibold text-red-700">{r.persen}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        </>)}
      </section>

      <KartuIuran onBuka={() => onNav('iuran')} />
    </div>
  );
}
