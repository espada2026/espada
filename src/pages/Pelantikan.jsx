import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import usePelantikanSaka from '../hooks/usePelantikanSaka';
import { fmtTanggal, hariIni } from '../lib/format';
import '../data/skuSiaga'; // mendaftarkan katalog Siaga (butir Mula/Bantu/Tata) agar kelayakan tingkat Siaga dapat dihitung
import {
  TINGKAT_SIAGA_PELANTIKAN, calonPelantikan, kelompokPelantikan, labelTingkatPelantikan, periksaPelantikan, ringkasPelantikan, tingkatSiaga,
} from '../lib/pelantikanLogic';
import SumberPeraturan from '../components/SumberPeraturan';
import { Avatar, Field, Icon, Kosong, Modal } from '../components/ui';

/** Catat pelantikan satu upacara untuk banyak anggota (Penegak atau anak Siaga) sekaligus (semua atau tidak sama sekali di server). */
function FormPelantikan({ data, onSelesai }) {
  const { api, users, progress, notify } = useApp();
  const [tingkat, setTingkat] = useState('mula');
  const [tanggal, setTanggal] = useState(hariIni());
  const [tempat, setTempat] = useState('');
  const [catatan, setCatatan] = useState('');
  const [agendaId, setAgendaId] = useState('');
  const [agenda, setAgenda] = useState([]);
  const [termasukSudah, setTermasukSudah] = useState(false);
  const [cari, setCari] = useState('');
  const [pilih, setPilih] = useState(() => new Set());
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => { api().muatAgenda().then((r) => { if (r.ok) setAgenda(r.data); }); }, [api]);
  useEffect(() => { setPilih(new Set()); setAgendaId(''); }, [tingkat, termasukSudah]);

  const calon = useMemo(() => calonPelantikan({ users, progress, pelantikan: data.pelantikan, tingkat, termasukSudah }), [users, progress, data.pelantikan, tingkat, termasukSudah]);
  const tampil = useMemo(() => {
    const k = cari.trim().toLowerCase();
    return k ? calon.filter((u) => `${u.nama} ${u.kelas ?? ''} ${u.sangga ?? ''} ${u.perindukan ?? ''} ${u.barung ?? ''}`.toLowerCase().includes(k)) : calon;
  }, [calon, cari]);
  const siaga = tingkatSiaga(tingkat);
  const agendaTingkat = agenda.filter((a) => a.jenis === (siaga ? 'pelantikan_siaga' : `pelantikan_${tingkat}`));
  const sudahTercatat = (id) => data.pelantikan.some((p) => p.pesertaId === id && p.tingkat === tingkat);

  const ubahPilih = (id) => setPilih((s) => { const b = new Set(s); if (b.has(id)) b.delete(id); else b.add(id); return b; });
  const pilihSemuaTampil = () => setPilih((s) => { const b = new Set(s); tampil.forEach((u) => b.add(u.id)); return b; });

  const kirim = async () => {
    if (sibuk) return;
    const pesan = periksaPelantikan({ tingkat, tanggal, tempat, catatan, jumlah: pilih.size });
    if (pesan) { setGalat(pesan); return; }
    setSibuk(true);
    setGalat('');
    const r = await api().catatPelantikan({ tingkat, tanggal, tempat, pesertaIds: [...pilih], agendaId: agendaId ? Number(agendaId) : null, catatan });
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan); return; }
    notify(`Pelantikan ${labelTingkatPelantikan(tingkat)} dicatat untuk ${r.data} anak.`);
    setPilih(new Set());
    onSelesai();
  };

  return (
    <section className="panel mb-5 p-4" aria-label="Catat pelantikan">
      <h2 className="mb-1 text-lg font-bold">Catat pelantikan</h2>
      <p className="mb-3 text-sm text-pramuka-600">
        Catat sesudah upacara terlaksana. Yang tampil hanya {siaga ? 'anggota Siaga' : 'Penegak'} aktif yang sudah menyelesaikan seluruh butir SKU tingkat itu. Satu upacara dicatat sekaligus; bila ada yang tidak layak, seluruh pencatatan dibatalkan.
      </p>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Tingkat" htmlFor="pl-tingkat">
          <select id="pl-tingkat" className="input" value={tingkat} onChange={(e) => setTingkat(e.target.value)}>
            {TINGKAT_SIAGA_PELANTIKAN.map((t) => <option key={t.id} value={t.id}>Siaga {t.label}</option>)}
          </select>
        </Field>
        <Field label="Tanggal pelantikan" htmlFor="pl-tanggal">
          <input id="pl-tanggal" type="date" className="input" max={hariIni()} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </Field>
        <Field label="Tempat" htmlFor="pl-tempat">
          <input id="pl-tempat" className="input" maxLength={120} value={tempat} onChange={(e) => setTempat(e.target.value)} placeholder="Contoh: Lapangan upacara sekolah" />
        </Field>
        <Field label="Kegiatan di Agenda (opsional)" htmlFor="pl-agenda" bantuan={agendaTingkat.length ? undefined : (siaga ? 'Belum ada kegiatan Agenda berjenis Pelantikan Siaga.' : `Belum ada kegiatan Agenda berjenis pelantikan ${labelTingkatPelantikan(tingkat)}.`)}>
          <select id="pl-agenda" className="input" value={agendaId} onChange={(e) => setAgendaId(e.target.value)} disabled={!agendaTingkat.length}>
            <option value="">Tanpa tautan</option>
            {agendaTingkat.map((a) => <option key={a.id} value={a.id}>{a.judul}, {fmtTanggal(a.tanggal)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Catatan (opsional)" htmlFor="pl-catatan">
        <input id="pl-catatan" className="input" maxLength={200} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
      </Field>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{siaga ? 'Anggota Siaga' : 'Penegak'} ({calon.length} layak, {pilih.size} dipilih)</p>
        <label className="flex items-center gap-2 text-xs font-medium text-pramuka-700">
          <input type="checkbox" className="h-4 w-4 accent-pramuka-800" checked={termasukSudah} onChange={(e) => setTermasukSudah(e.target.checked)} />
          Termasuk yang sudah tercatat (untuk koreksi)
        </label>
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        <input className="input min-w-0 flex-1" aria-label="Cari anggota" placeholder={siaga ? 'Cari nama, kelas, perindukan, atau barung' : 'Cari nama, kelas, atau sangga'} value={cari} onChange={(e) => setCari(e.target.value)} />
        <button type="button" className="btn btn-outline btn-sm" onClick={pilihSemuaTampil} disabled={!tampil.length}>Pilih semua yang tampil</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setPilih(new Set())} disabled={!pilih.size}>Kosongkan</button>
      </div>
      {calon.length === 0 ? (
        <Kosong judul={siaga ? 'Belum ada anggota Siaga yang layak' : 'Belum ada Penegak yang layak'} teks={`Belum ada ${siaga ? 'anggota Siaga' : 'Penegak'} aktif yang menyelesaikan seluruh butir SKU ${siaga ? 'Siaga ' : ''}${labelTingkatPelantikan(tingkat)}${termasukSudah ? '' : ' dan belum dilantik'}.`} />
      ) : (
        <ul className="max-h-72 divide-y divide-pramuka-100 overflow-y-auto rounded-lg border border-pramuka-100 text-sm">
          {tampil.map((u) => (
            <li key={u.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-pramuka-50">
                <input type="checkbox" className="h-4 w-4 shrink-0 accent-pramuka-800" checked={pilih.has(u.id)} onChange={() => ubahPilih(u.id)} />
                <span className="min-w-0 flex-1 truncate font-medium">{u.nama}</span>
                <span className="shrink-0 text-xs text-pramuka-500">{u.kelas || '-'}{sudahTercatat(u.id) ? ', sudah tercatat' : ''}</span>
              </label>
            </li>
          ))}
          {tampil.length === 0 && <li className="px-3 py-3 text-pramuka-500">Tidak ada yang cocok dengan pencarian.</li>}
        </ul>
      )}
      {galat && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{galat}</p>}
      <div className="mt-4">
        <button className="btn btn-primary" onClick={kirim} disabled={sibuk || !pilih.size}>{sibuk ? 'Menyimpan...' : `Catat pelantikan (${pilih.size} anggota)`}</button>
      </div>
    </section>
  );
}

/** Riwayat pelantikan per upacara, dengan hapus per anak (bila salah catat). */
function RiwayatPelantikan({ data, onSelesai }) {
  const { api, users, notify } = useApp();
  const kelompok = useMemo(() => kelompokPelantikan(data.pelantikan, users), [data.pelantikan, users]);
  const [buka, setBuka] = useState(null);
  const [hapus, setHapus] = useState(null); // { id, nama, tingkat }
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  const konfirmasi = async () => {
    setSibuk(true);
    const r = await api().hapusPelantikan(hapus.id);
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan); return; }
    notify('Catatan pelantikan dihapus.');
    setHapus(null);
    setGalat('');
    onSelesai();
  };

  return (
    <section aria-label="Riwayat pelantikan">
      <h2 className="mb-2 text-lg font-bold">Riwayat pelantikan ({kelompok.length} upacara)</h2>
      {kelompok.length === 0 ? (
        <Kosong judul="Belum ada pelantikan tercatat" teks="Catat pelantikan pertama lewat formulir di atas." />
      ) : (
        <ul className="panel divide-y divide-pramuka-100">
          {kelompok.map((g) => (
            <li key={g.kunci} className="p-4">
              <button className="flex w-full flex-wrap items-baseline justify-between gap-2 text-left" aria-expanded={buka === g.kunci} onClick={() => setBuka(buka === g.kunci ? null : g.kunci)}>
                <span className="font-semibold">Pelantikan {tingkatSiaga(g.tingkat) ? 'Siaga ' : ''}{labelTingkatPelantikan(g.tingkat)}, {fmtTanggal(g.tanggal)}</span>
                <span className="text-xs text-pramuka-600">{g.tempat}, {g.anggota.length} {tingkatSiaga(g.tingkat) ? 'anggota' : 'Penegak'}</span>
              </button>
              {buka === g.kunci && (
                <ul className="animasi-naik mt-2 divide-y divide-pramuka-100 rounded-lg border border-pramuka-100 text-sm">
                  {g.anggota.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span className="min-w-0 truncate font-medium">{a.nama} <span className="text-xs font-normal text-pramuka-500">{a.kelas}</span></span>
                      <button className="shrink-0 text-xs font-semibold text-red-700 underline underline-offset-2" onClick={() => { setGalat(''); setHapus({ id: a.id, nama: a.nama, tingkat: g.tingkat }); }}>Hapus</button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal
        buka={!!hapus}
        tutup={() => setHapus(null)}
        judul="Hapus catatan pelantikan?"
        aksi={
          <>
            <button className="btn btn-outline" onClick={() => setHapus(null)} disabled={sibuk}>Batal</button>
            <button className="btn btn-primary" onClick={konfirmasi} disabled={sibuk}>{sibuk ? 'Menghapus...' : 'Hapus'}</button>
          </>
        }
      >
        <p className="text-sm text-pramuka-800">Catatan pelantikan {hapus ? labelTingkatPelantikan(hapus.tingkat) : ''} untuk <b>{hapus?.nama}</b> dihapus. Gunakan ini bila salah mencatat; untuk koreksi tanggal atau tempat cukup catat ulang.</p>
        {galat && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{galat}</p>}
      </Modal>
    </section>
  );
}

/**
 * Pelantikan kenaikan tingkat Siaga (Pembina dan Admin): mencatat pelantikan Mula, Bantu, dan Tata per upacara. Hak ditegakkan server (sg_pelantikan_*);
 * anak berakun melihat miliknya di Beranda.
 */
export default function Pelantikan() {
  const data = usePelantikanSaka();
  const r = ringkasPelantikan(data.pelantikan, data.saka);

  return (
    <div className="animasi-naik">
      <h1 className="mb-1 text-2xl font-bold">Pelantikan</h1>
      <p className="mb-2 text-sm text-pramuka-600">
        Catatan pelantikan kenaikan tingkat Siaga: Mula, Bantu, dan Tata (tempat dan tanggal; tanggal pelantikan menjadi awal hitungan latihan tingkat berikutnya).
      </p>
      <SumberPeraturan className="mb-4" rujukan={['sku-siaga-2011']} />

      {data.galat && <p role="alert" className="mb-4 text-sm font-medium text-red-700">{data.galat}</p>}
      <p className="mb-4 text-sm text-pramuka-700" aria-live="polite">
        {data.memuat ? 'Memuat...' : `Dilantik Mula: ${r.mula}, Bantu: ${r.bantu}, Tata: ${r.tata}.`}
      </p>

      <FormPelantikan data={data} onSelesai={data.muat} />
      <RiwayatPelantikan data={data} onSelesai={data.muat} />
    </div>
  );
}
