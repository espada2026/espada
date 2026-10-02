import { useMemo, useState } from 'react';
import AdminAnggota from './AdminAnggota';
import { useApp } from '../context/AppContext';
import { AGAMA } from '../data/skuData';
import {
  BARUNG_MAKS, BARUNG_MIN, anggotaSiaga, bacaTempelanSiaga, bakukanKelasSiaga, penyamaKelompok, periksaBanyakSiaga, periksaSiaga, susunKelompok,
} from '../lib/siagaLogic';
import { urutTeks } from '../lib/format';
import { hitungProgres } from '../lib/skuLogic';
import SiagaSku, { tingkatSiagaAwal } from './SiagaSku';
import AkunBaru from '../components/AkunBaru';
import { BadgeStatus, Field, Kosong, Modal } from '../components/ui';

const KOSONG = { nama: '', kelas: '', jk: '', agama: '', nis: '', perindukan: '', barung: '' };
const JK_LABEL = { L: 'Putra', P: 'Putri' };

/** Tambah atau ubah satu anggota Siaga. `awal` = anggota yang diubah (tanpa = tambah). */
function ModalAnggota({ awal, onTutup, onAkunBaru }) {
  const { users, tambahSiaga, buatAkunSiaga, ubahSiaga, hapusSiaga, aturStatusAnggota } = useApp();
  const berakun = !!awal && !awal.tanpaAkun; // anak yang sudah punya akun masuk: NIS = nama pengguna, tidak diubah dari sini
  const [buatAkun, setBuatAkun] = useState(false); // hanya saat menambah: buat akun masuk (NIS dan PIN awal) sekalian
  const [f, setF] = useState(awal ? { nama: awal.nama, kelas: awal.kelas ?? '', jk: awal.jenisKelamin ?? '', agama: awal.agama ?? '', nis: awal.nis ?? '', perindukan: awal.perindukan ?? '', barung: awal.barung ?? '' } : KOSONG);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const ubah = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const penyama = useMemo(() => {
    const p = penyamaKelompok(users);
    return { ...p, nis: (nis) => users.some((u) => u.nis === nis && u.id !== awal?.id) };
  }, [users, awal]);

  const simpan = async () => {
    const p = periksaSiaga(f, penyama);
    if (!p.ok) { setGalat(p.pesan); return; }
    if (buatAkun && !p.nilai.nis) { setGalat('NIS wajib diisi untuk anak yang diberi akun masuk (NIS menjadi nama penggunanya).'); return; }
    setSibuk(true);
    const r = awal ? await ubahSiaga(awal.id, berakun ? { ...p.nilai, nis: awal.nis } : p.nilai) : buatAkun ? await buatAkunSiaga(p.nilai) : await tambahSiaga([p.nilai]);
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan); return; }
    if (r.akun) onAkunBaru(r.akun);
    onTutup();
  };
  const ubahStatus = async (status) => {
    const alasan = status === 'nonaktif' ? 'Anak ini ditandai tidak melanjutkan Pramuka Siaga.' : '';
    if (!window.confirm(status === 'aktif' ? 'Aktifkan kembali anggota ini?' : alasan + ' Lanjutkan?')) return;
    setSibuk(true);
    const r = await aturStatusAnggota(awal.id, status, status === 'aktif' ? bakukanKelasSiaga(f.kelas) : null, '');
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan ?? 'Gagal mengubah status.'); return; }
    onTutup();
  };
  const hapus = async () => {
    if (!window.confirm(`Hapus ${awal.nama}? Hanya bisa bila belum punya catatan apa pun.`)) return;
    setSibuk(true);
    const r = await hapusSiaga(awal.id);
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan); return; }
    onTutup();
  };

  return (
    <Modal
      buka tutup={() => !sibuk && onTutup()} judul={awal ? `Ubah: ${awal.nama}` : 'Tambah anggota Siaga'}
      aksi={(<><button className="btn btn-outline" disabled={sibuk} onClick={onTutup}>Batal</button><button className="btn btn-primary" disabled={sibuk} onClick={simpan}>{sibuk ? 'Menyimpan...' : 'Simpan'}</button></>)}
    >
      <Field label="Nama lengkap" htmlFor="sg-nama"><input id="sg-nama" className="input" maxLength={120} value={f.nama} onChange={ubah('nama')} /></Field>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="Kelas" htmlFor="sg-kelas" bantuan="Angka 1-6, boleh dengan paralel (4, 5A)."><input id="sg-kelas" className="input" maxLength={3} value={f.kelas} onChange={ubah('kelas')} /></Field>
        <Field label="Jenis kelamin (opsional)" htmlFor="sg-jk">
          <select id="sg-jk" className="input" value={f.jk} onChange={ubah('jk')}><option value="">-</option><option value="L">Putra</option><option value="P">Putri</option></select>
        </Field>
        <Field label="Agama (opsional)" htmlFor="sg-agama" bantuan="Menentukan butir agama pada SKU.">
          <select id="sg-agama" className="input" value={f.agama} onChange={ubah('agama')}><option value="">-</option>{AGAMA.map((a) => <option key={a}>{a}</option>)}</select>
        </Field>
        <Field label={buatAkun ? 'NIS (nama pengguna)' : 'NIS (opsional)'} htmlFor="sg-nis" bantuan={berakun ? 'NIS anak berakun adalah nama penggunanya; Admin Gudep mengubahnya di menu Anggota.' : undefined}>
          <input id="sg-nis" className="input" maxLength={20} value={f.nis} onChange={ubah('nis')} disabled={berakun} />
        </Field>
        <Field label="Perindukan (opsional)" htmlFor="sg-per"><input id="sg-per" className="input" maxLength={40} value={f.perindukan} onChange={ubah('perindukan')} /></Field>
        <Field label="Barung (opsional)" htmlFor="sg-bar"><input id="sg-bar" className="input" maxLength={40} value={f.barung} onChange={ubah('barung')} /></Field>
      </div>
      {!awal && (
        <label className="mb-3 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={buatAkun} onChange={(e) => setBuatAkun(e.target.checked)} />
          <span><span className="font-semibold">Buat akun masuk</span> (anak dapat masuk dan mengajukan SKU sendiri). NIS menjadi nama pengguna dan PIN awal dibuat otomatis; tampil sekali untuk Anda sampaikan. Tanpa dicentang, anak dinilai langsung Pembina tanpa akun.</span>
        </label>
      )}
      {berakun && <p className="mb-2 text-xs text-pramuka-600">Anak ini punya akun masuk. PIN yang lupa direset lewat menu Reset PIN.</p>}
      {galat && <p role="alert" className="mb-2 text-sm font-medium text-red-700">{galat}</p>}
      {awal && (
        <div className="mt-2 flex flex-wrap gap-2 border-t border-pramuka-100 pt-3">
          {(awal.status ?? 'aktif') === 'aktif'
            ? <button className="btn btn-outline btn-sm" disabled={sibuk} onClick={() => ubahStatus('nonaktif')}>Tandai tidak melanjutkan</button>
            : <button className="btn btn-outline btn-sm" disabled={sibuk} onClick={() => ubahStatus('aktif')}>Aktifkan kembali</button>}
          {!berakun && <button className="btn btn-outline btn-sm text-red-700" disabled={sibuk} onClick={hapus}>Hapus (salah input)</button>}
        </div>
      )}
    </Modal>
  );
}

/** Tempel banyak anak sekaligus dari Excel/Word: satu anak per baris, kolom dipisah tab, koma, atau titik koma. */
function ModalTempel({ onTutup }) {
  const { users, tambahSiaga } = useApp();
  const [teks, setTeks] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const hasil = useMemo(() => periksaBanyakSiaga(bacaTempelanSiaga(teks), users), [teks, users]);
  const simpan = async () => {
    if (hasil.baris.length === 0) { setGalat('Tempelkan datanya lebih dulu.'); return; }
    if (hasil.galat > 0) { setGalat('Perbaiki baris yang bertanda galat lebih dulu.'); return; }
    setSibuk(true);
    const r = await tambahSiaga(hasil.baris.map((b) => b.nilai));
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan); return; }
    onTutup();
  };
  return (
    <Modal
      buka tutup={() => !sibuk && onTutup()} judul="Tempel daftar anak Siaga" lebar="max-w-2xl"
      aksi={(<><button className="btn btn-outline" disabled={sibuk} onClick={onTutup}>Batal</button><button className="btn btn-primary" disabled={sibuk || hasil.baris.length === 0} onClick={simpan}>{sibuk ? 'Menyimpan...' : `Tambahkan ${hasil.baris.length || ''}`}</button></>)}
    >
      <p className="mb-2 text-sm text-pramuka-600">
        Satu anak per baris. Urutan kolom: <strong>Nama, Kelas, JK (L/P), Agama, NIS, Perindukan, Barung</strong>; hanya Nama dan Kelas yang wajib. Salin dari Excel langsung ke kotak ini.
      </p>
      <textarea className="input min-h-32 font-mono text-xs" aria-label="Daftar anak" value={teks} onChange={(e) => { setTeks(e.target.value); setGalat(''); }} placeholder={'Andi Saputra\t4A\tL\tIslam\t\tPerindukan Melati\tBarung Kancil'} />
      {hasil.baris.length > 0 && (
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm">
          {hasil.baris.map((b) => (
            <li key={b.no} className={b.pesan ? 'text-red-700' : 'text-pramuka-800'}>
              {b.no}. {b.pesan ? `Galat: ${b.pesan}` : `${b.nilai.nama} (kelas ${b.nilai.kelas}${b.nilai.barung ? `, ${b.nilai.barung}` : ''})`}
            </li>
          ))}
        </ul>
      )}
      {galat && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{galat}</p>}
    </Modal>
  );
}

/** Menempatkan anggota terpilih ke perindukan dan barung. */
function ModalBarung({ ids, onTutup }) {
  const { users, aturBarung } = useApp();
  const [perindukan, setPerindukan] = useState('');
  const [barung, setBarung] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const daftarPer = useMemo(() => [...new Set(anggotaSiaga(users).map((u) => u.perindukan).filter(Boolean))].sort(urutTeks), [users]);
  const simpan = async () => {
    const p = periksaSiaga({ nama: 'x', kelas: '1', perindukan, barung }, penyamaKelompok(users));
    if (!p.ok) { setGalat(p.pesan); return; }
    setSibuk(true);
    const r = await aturBarung(ids, p.nilai.perindukan, p.nilai.barung);
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan); return; }
    onTutup();
  };
  return (
    <Modal
      buka tutup={() => !sibuk && onTutup()} judul={`Tempatkan ${ids.length} anak ke barung`}
      aksi={(<><button className="btn btn-outline" disabled={sibuk} onClick={onTutup}>Batal</button><button className="btn btn-primary" disabled={sibuk} onClick={simpan}>{sibuk ? 'Menyimpan...' : 'Simpan'}</button></>)}
    >
      <p className="mb-2 text-sm text-pramuka-600">Kosongkan keduanya untuk mengeluarkan anak dari kelompoknya. Anjuran: {BARUNG_MIN}-{BARUNG_MAKS} anak per barung.</p>
      <Field label="Perindukan" htmlFor="sg-p"><input id="sg-p" className="input" list="sg-daftar-per" maxLength={40} value={perindukan} onChange={(e) => setPerindukan(e.target.value)} /></Field>
      <datalist id="sg-daftar-per">{daftarPer.map((p) => <option key={p} value={p} />)}</datalist>
      <Field label="Barung" htmlFor="sg-b"><input id="sg-b" className="input" maxLength={40} value={barung} onChange={(e) => setBarung(e.target.value)} /></Field>
      {galat && <p role="alert" className="text-sm font-medium text-red-700">{galat}</p>}
    </Modal>
  );
}

/** Ringkasan SKU satu anak pada daftar: tingkat yang sedang dikerjakan dan jumlah butir lulus; tombol membuka rincian. */
function SkuRingkas({ anggota, progress, onBuka }) {
  const tingkat = tingkatSiagaAwal(progress, anggota);
  const h = hitungProgres(progress, anggota, tingkat);
  return (
    <button className="btn btn-outline btn-sm shrink-0" onClick={onBuka} aria-label={`SKU ${anggota.nama}: ${tingkat} ${h.lulus} dari ${h.total} butir lulus`}>
      SKU {tingkat} <span className="font-normal text-pramuka-600">{h.lulus}/{h.total}</span>
    </button>
  );
}

function TabKelompok({ users, onUbah }) {
  const { perindukan, tanpaKelompok } = useMemo(() => susunKelompok(users), [users]);
  if (perindukan.length === 0 && tanpaKelompok.length === 0) return <Kosong judul="Belum ada anggota Siaga" teks="Tambahkan anak lewat tombol di atas." />;
  const Nama = ({ u }) => <button className="text-left underline-offset-2 hover:underline" onClick={() => onUbah(u)}>{u.nama}{u.jenisKelamin ? ` (${u.jenisKelamin})` : ''}</button>;
  return (
    <div className="space-y-4">
      {perindukan.map((p) => (
        <section key={p.perindukan} className="panel p-4" aria-label={`Perindukan ${p.perindukan}`}>
          <h3 className="text-lg font-bold">{p.perindukan} <span className="text-sm font-normal text-pramuka-600">{p.jumlah} anak ({p.putra} putra, {p.putri} putri)</span></h3>
          {p.peringatan && <p className="text-xs font-medium text-amber-900">{p.peringatan}</p>}
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {p.barung.map((b) => (
              <div key={b.nama} className="min-w-0 rounded-lg border border-pramuka-100 p-3">
                <p className="font-semibold">{b.nama || 'Belum masuk barung'} <span className="text-xs font-normal text-pramuka-500">{b.anggota.length} anak</span></p>
                {b.peringatan && b.nama !== '' && <p className="text-xs text-amber-900">{b.peringatan}</p>}
                <ul className="mt-1 space-y-0.5 text-sm [overflow-wrap:anywhere]">{b.anggota.map((u) => <li key={u.id}><Nama u={u} /></li>)}</ul>
              </div>
            ))}
          </div>
        </section>
      ))}
      {tanpaKelompok.length > 0 && (
        <section className="panel p-4" aria-label="Belum ditempatkan">
          <h3 className="text-lg font-bold">Belum ditempatkan <span className="text-sm font-normal text-pramuka-600">{tanpaKelompok.length} anak</span></h3>
          <ul className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2 [overflow-wrap:anywhere]">{tanpaKelompok.map((u) => <li key={u.id}><Nama u={u} /></li>)}</ul>
        </section>
      )}
    </div>
  );
}

/**
 * Anggota Siaga (Pembina dan Admin): anak Siaga tidak punya akun; datanya dibuat dan dirawat di sini, termasuk pembagian ke perindukan dan barung.
 */
function DaftarSiaga() {
  const { users, progress } = useApp();
  const semua = useMemo(() => anggotaSiaga(users), [users]);
  const [skuId, setSkuId] = useState(null); // anak yang SKU-nya sedang dibuka (SiagaSku)
  const [tab, setTab] = useState('daftar');
  const [cari, setCari] = useState('');
  const [kelas, setKelas] = useState('');
  const [status, setStatus] = useState('aktif');
  const [pilih, setPilih] = useState(() => new Set());
  const [akunBaru, setAkunBaru] = useState(null); // nama pengguna dan PIN awal akun anak yang baru dibuat (tampil sekali)
  const [modal, setModal] = useState(null); // { jenis: 'tambah' | 'tempel' | 'ubah' | 'barung', anggota? }

  const daftarKelas = useMemo(() => [...new Set(semua.map((u) => u.kelas).filter(Boolean))].sort(urutTeks), [semua]);
  const tampil = useMemo(() => {
    const k = cari.trim().toLowerCase();
    return semua
      .filter((u) => (status === 'semua' || (u.status ?? 'aktif') === status) && (!kelas || u.kelas === kelas) && (!k || u.nama.toLowerCase().includes(k)))
      .sort((a, b) => urutTeks(a.kelas ?? '', b.kelas ?? '') || urutTeks(a.nama, b.nama));
  }, [semua, cari, kelas, status]);
  const terpilih = tampil.filter((u) => pilih.has(u.id)).map((u) => u.id);
  const ganti = (id) => setPilih((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const tutup = () => { setModal(null); setPilih(new Set()); };

  if (skuId) return <SiagaSku key={skuId} pesertaId={skuId} onKembali={() => setSkuId(null)} />;

  return (
    <div className="animasi-naik">
      <h1 className="mb-1 text-2xl font-bold">Anggota Siaga</h1>
      <p className="mb-4 text-sm text-pramuka-600">
        Anak Siaga boleh punya akun masuk (mengajukan SKU sendiri) atau tanpa akun (dinilai langsung Pembina); datanya dikelola Pembina di sini. {semua.filter((u) => (u.status ?? 'aktif') === 'aktif').length} anggota aktif.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ jenis: 'tambah' })}>Tambah anak</button>
        <button className="btn btn-outline btn-sm" onClick={() => setModal({ jenis: 'tempel' })}>Tempel daftar banyak anak</button>
        <span className="ml-auto flex gap-1" role="tablist" aria-label="Tampilan">
          {[['daftar', 'Daftar'], ['kelompok', 'Perindukan dan barung']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`btn btn-sm ${tab === id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </span>
      </div>

      {tab === 'kelompok' ? <TabKelompok users={users} onUbah={(a) => setModal({ jenis: 'ubah', anggota: a })} /> : (
        <>
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
            <input className="input sm:col-span-2" aria-label="Cari nama" placeholder="Cari nama" value={cari} onChange={(e) => setCari(e.target.value)} />
            <select className="input" aria-label="Kelas" value={kelas} onChange={(e) => setKelas(e.target.value)}><option value="">Semua kelas</option>{daftarKelas.map((k) => <option key={k} value={k}>Kelas {k}</option>)}</select>
            <select className="input" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="aktif">Aktif</option><option value="nonaktif">Tidak melanjutkan</option><option value="alumni">Alumni</option><option value="semua">Semua</option></select>
          </div>
          {terpilih.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-pramuka-50 px-3 py-2 text-sm">
              <span>{terpilih.length} dipilih</span>
              <button className="btn btn-primary btn-sm" onClick={() => setModal({ jenis: 'barung' })}>Tempatkan ke barung</button>
              <button className="btn btn-outline btn-sm" onClick={() => setPilih(new Set())}>Batal pilih</button>
            </div>
          )}
          {tampil.length === 0 ? (
            <Kosong judul={semua.length === 0 ? 'Belum ada anggota Siaga' : 'Tidak ada yang cocok'} teks={semua.length === 0 ? 'Tambahkan anak satu per satu atau tempel daftarnya dari Excel.' : 'Ubah pencarian atau filter.'} />
          ) : (
            <ul className="panel divide-y divide-pramuka-100">
              {tampil.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                  <input type="checkbox" aria-label={`Pilih ${u.nama}`} checked={pilih.has(u.id)} onChange={() => ganti(u.id)} />
                  <button className="min-w-0 flex-1 text-left" onClick={() => setModal({ jenis: 'ubah', anggota: u })}>
                    <span className="block font-medium [overflow-wrap:anywhere]">{u.nama}</span>
                    <span className="block text-xs text-pramuka-600 [overflow-wrap:anywhere]">
                      Kelas {u.kelas}{u.jenisKelamin ? `, ${JK_LABEL[u.jenisKelamin]}` : ''}{u.agama ? `, ${u.agama}` : ''}{u.tanpaAkun ? '' : ', berakun'}{u.perindukan ? ` | ${u.perindukan}${u.barung ? ` / ${u.barung}` : ''}` : ''}
                    </span>
                  </button>
                  {(u.status ?? 'aktif') !== 'aktif' && <BadgeStatus status={u.status} />}
                  <SkuRingkas anggota={u} progress={progress} onBuka={() => setSkuId(u.id)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {modal?.jenis === 'tambah' && <ModalAnggota onTutup={tutup} onAkunBaru={setAkunBaru} />}
      {modal?.jenis === 'ubah' && <ModalAnggota awal={modal.anggota} onTutup={tutup} onAkunBaru={setAkunBaru} />}
      {akunBaru && <AkunBaru akun={akunBaru} onTutup={() => setAkunBaru(null)} />}
      {modal?.jenis === 'tempel' && <ModalTempel onTutup={tutup} />}
      {modal?.jenis === 'barung' && <ModalBarung ids={terpilih} onTutup={tutup} />}
    </div>
  );
}

/**
 * Menu Anggota (satu menu untuk Pembina dan Admin): daftar anak Siaga beserta SKU, perindukan, dan barung. Admin mendapat satu tab tambahan,
 * "Akun masuk", untuk mengelola akun Pembina, Admin, dan anak berakun (ubah, status, hapus; reset PIN lewat menu akun).
 */
export default function Siaga({ tabAwal = 'anak' }) {
  const { user } = useApp();
  const [tab, setTab] = useState(user.role === 'admin' ? tabAwal : 'anak');
  if (user.role !== 'admin') return <DaftarSiaga />;
  return (
    <div>
      <div role="tablist" aria-label="Jenis data anggota" className="mb-4 inline-flex rounded-lg bg-pramuka-100 p-1">
        {[['anak', 'Anak Siaga'], ['akun', 'Akun masuk']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-pramuka-800 text-pramuka-50' : 'text-pramuka-700 hover:bg-pramuka-200'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'anak' ? <DaftarSiaga /> : <AdminAnggota />}
    </div>
  );
}
