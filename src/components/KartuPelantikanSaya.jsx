import usePelantikanSaka from '../hooks/usePelantikanSaka';
import { useApp } from '../context/AppContext';
import { fmtTanggal } from '../lib/format';
import { pelantikanPeserta, sakaPeserta, TINGKAT_PELANTIKAN, tingkatSiaga } from '../lib/pelantikanLogic';

/**
 * Pelantikan dan keanggotaan Saka milik Penegak atau anak Siaga yang sedang masuk (Beranda; dicatat Pembina). Tidak tampil sama sekali bila belum ada catatan
 * (atau data belum dapat dimuat, mis. basis data belum dimigrasi), agar Beranda tidak penuh.
 */
export default function KartuPelantikanSaya() {
  const { user } = useApp();
  const { pelantikan, saka } = usePelantikanSaka();
  const p = pelantikanPeserta(pelantikan, user.id);
  const s = sakaPeserta(saka, user.id);
  const dilantik = TINGKAT_PELANTIKAN.filter((t) => p[t.id]);
  if (dilantik.length === 0 && s.length === 0) return null;
  return (
    <section className="panel mb-5 p-4" aria-label="Pelantikan saya">
      <h2 className="mb-2 text-lg font-bold">Pelantikan</h2>
      <ul className="space-y-1 text-sm text-pramuka-800">
        {dilantik.map((t) => (
          <li key={t.id}><b>Dilantik {tingkatSiaga(t.id) ? 'Siaga ' : ''}{t.label}</b> pada {fmtTanggal(p[t.id].tanggal)}, {p[t.id].tempat}.</li>
        ))}
        {s.map((x) => (
          <li key={x.id}>
            <b>{x.saka}</b>, {x.status === 'aktif' ? `aktif sejak ${fmtTanggal(x.tanggalMasuk)}` : `${fmtTanggal(x.tanggalMasuk)} sampai ${fmtTanggal(x.tanggalSelesai)}`}
            {x.suratUrl && <> (<a href={x.suratUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-pramuka-700 underline underline-offset-2">surat keterangan</a>)</>}.
          </li>
        ))}
      </ul>
    </section>
  );
}
