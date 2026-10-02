import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { GUDEP_BAWAAN } from '../config';
import { useGudep } from '../lib/gudepStore';
import { KETERANGAN_ORANG, KOLOM_ORANG, WAJIB_TEKS, periksaGudep, samaGudep, untukForm } from '../lib/gudepLogic';
import { namaBerkasCadangan, perluCadangan } from '../lib/cadanganLogic';
import { waktuRelatif } from '../lib/notifikasiLogic';
import { KopSurat } from '../components/DokumenSku';
import { Field } from '../components/ui';
import SumberPeraturan from '../components/SumberPeraturan';
import { DAFTAR_TEMA, temaAktif } from '../lib/temaStore';

/** Warna contoh pada kartu pilihan tema (tetap, tidak ikut tema yang sedang aktif). */
const CONTOH_TEMA = {
  siaga: { latar: '#f1f8ff', tepi: '#bfdffc', utama: '#1d64ae', sorot: '#f5b81c', aksen: '#d62f2f', huruf: '"Baloo 2", "Trebuchet MS", sans-serif', bulat: '9999px', sudut: '14px' },
  asli: { latar: '#f8f2e4', tepi: '#e2cfa8', utama: '#45291a', sorot: '#c99a1d', aksen: '#b91c1c', huruf: 'Bitter, Georgia, serif', bulat: '8px', sudut: '6px' },
};

/** Panel "Tema tampilan" (Admin Gudep): memilih tema untuk seluruh gudep (Siaga atau asli cokelat-emas). */
function TemaTampilan() {
  const { simpanTema } = useApp();
  const [aktif, setAktif] = useState(temaAktif);
  const [sibuk, setSibuk] = useState(false);
  const pilih = async (id) => {
    if (id === aktif || sibuk) return;
    setSibuk(true);
    const r = await simpanTema(id);
    if (r?.ok !== false) setAktif(id);
    setSibuk(false);
  };
  return (
    <section className="panel space-y-3 p-4" aria-labelledby="gudep-tema">
      <h2 id="gudep-tema" className="text-base font-bold text-pramuka-900">Tema tampilan</h2>
      <p className="text-xs text-pramuka-600">
        Warna, huruf, dan bentuk tombol aplikasi. Pilihan berlaku untuk <b>seluruh gudep</b> (semua pengguna dan halaman muka) dan langsung berubah
        sesudah dipilih; dapat dikembalikan kapan saja. Logo kecil di tab peramban dan gambar pratinjau tautan WhatsApp tidak ikut berganti.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tema tampilan">
        {DAFTAR_TEMA.map((t) => {
          const c = CONTOH_TEMA[t.id];
          const dipilih = aktif === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={dipilih}
              disabled={sibuk}
              onClick={() => pilih(t.id)}
              className={`min-w-0 rounded-xl border-2 p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emas disabled:opacity-60 ${dipilih ? 'border-emas bg-pramuka-50' : 'border-pramuka-200 bg-white hover:border-pramuka-400'}`}
            >
              <div className="rounded-lg p-3" style={{ background: c.latar, border: `1px solid ${c.tepi}` }} aria-hidden="true">
                <div style={{ fontFamily: c.huruf, fontWeight: 700, color: c.utama, fontSize: '1rem' }}>Gugus Depan Siaga</div>
                <div className="mt-2 flex items-center gap-2">
                  <span style={{ background: c.utama, color: '#fff', borderRadius: c.bulat, padding: '3px 12px', fontSize: '0.7rem', fontWeight: 700 }}>Tombol</span>
                  <span style={{ background: c.sorot, borderRadius: c.bulat, padding: '3px 12px', fontSize: '0.7rem', fontWeight: 700, color: '#222' }}>Sorot</span>
                  <span style={{ background: c.aksen, borderRadius: c.sudut, width: 18, height: 18, display: 'inline-block' }} />
                </div>
              </div>
              <p className="mt-2 text-sm font-bold text-pramuka-900">{t.nama}{dipilih && <span className="ml-2 text-xs font-semibold text-pramuka-600">(dipakai sekarang)</span>}</p>
              <p className="text-xs text-pramuka-600">{t.keterangan}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Panel "Cadangan data" (Admin Gudep): status cadangan terakhir dan tombol unduh (tahap L4). */
function CadanganData() {
  const { api } = useApp();
  const [status, setStatus] = useState(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  const muat = useCallback(async () => {
    const r = await api().statusCadangan();
    if (r.ok) setStatus(r.data);
  }, [api]);
  useEffect(() => { muat(); }, [muat]);

  const unduh = async () => {
    setSibuk(true);
    setGalat('');
    const r = await api().unduhCadangan();
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan); return; }
    const berkas = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(berkas);
    const a = document.createElement('a');
    a.href = url;
    a.download = namaBerkasCadangan();
    a.click();
    URL.revokeObjectURL(url);
    await muat();
  };

  const perlu = status && perluCadangan(status);
  return (
    <section className="panel space-y-2 p-4" aria-labelledby="gudep-cadangan">
      <h2 id="gudep-cadangan" className="text-base font-bold text-pramuka-900">Cadangan data</h2>
      <p className="text-xs text-pramuka-600">
        Mengunduh satu berkas JSON berisi data aplikasi (tanpa akun login dan PIN) ke komputer ini, sebagai cadangan ringan di luar Supabase.
        Simpan berkas ini di tempat aman (mis. Google Drive pribadi); bila diperlukan lagi, kembalikan lewat SQL Editor Supabase. Untuk
        cadangan penuh (termasuk akun login), pakai <code>Cadangkan-SIGARDA.bat</code>.
      </p>
      <p className="text-sm">
        {status === null ? 'Memuat status...' : status.pada
          ? <>Cadangan terakhir: <b>{waktuRelatif(status.pada)}</b>{status.oleh ? ` oleh ${status.oleh}` : ''}.</>
          : <span className="font-medium text-amber-700">Belum pernah diunduh dari menu ini.</span>}
        {perlu && status?.pada && <span className="ml-1 font-medium text-amber-700">Sudah waktunya cadangan baru.</span>}
      </p>
      {galat && <p role="alert" className="text-sm font-medium text-red-700">{galat}</p>}
      <button type="button" className="btn btn-outline" disabled={sibuk} onClick={unduh}>{sibuk ? 'Menyiapkan...' : 'Unduh cadangan'}</button>
    </section>
  );
}

/** Satu isian teks pada formulir; `jalur` = 'nama' atau 'pembina.nta' (dipakai untuk pesan galat). */
function Isian({ id, label, jalur, nilai, ubah, galat, bantuan, maks, jenis = 'text', wajib = false, placeholder }) {
  return (
    <Field label={wajib ? `${label} (wajib)` : label} htmlFor={id} bantuan={bantuan}>
      <input
        id={id}
        type={jenis}
        className={`input ${galat ? 'border-red-500' : ''}`}
        value={nilai}
        maxLength={maks}
        placeholder={placeholder}
        onChange={(e) => ubah(jalur, e.target.value)}
        aria-invalid={galat ? 'true' : undefined}
        aria-describedby={galat ? `${id}-galat` : undefined}
      />
      {galat && <p id={`${id}-galat`} role="alert" className="mt-1 text-xs font-medium text-red-700">{galat}</p>}
    </Field>
  );
}

/**
 * Pengaturan data gudep (Admin Gudep): identitas gudep dan ambalan, alamat, kwartir, serta pejabat (Pembina Gudep / Ka Gudep, Kamabigus / Kepala
 * Sekolah) beserta NTA. Pradana dan Pradani diambil dari anggota Dewan Ambalan. Isian tersimpan di basis data dan menjadi rujukan seluruh dokumen cetak, kop surat, dan tampilan aplikasi.
 */
export default function DataGudep() {
  const { simpanGudep } = useApp();
  const tersimpan = useGudep();
  const [form, setForm] = useState(() => untukForm(tersimpan));
  const [sibuk, setSibuk] = useState(false);
  const [dicoba, setDicoba] = useState(false); // pesan galat baru ditampilkan setelah mencoba menyimpan

  const berubah = !samaGudep(form, tersimpan);
  // Formulir ikut data terkini selama belum disunting (mis. sesudah data selesai dimuat atau tersimpan)
  useEffect(() => { if (!berubah) setForm(untukForm(tersimpan)); }, [tersimpan]); // eslint-disable-line react-hooks/exhaustive-deps

  const galat = periksaGudep(form);
  const adaGalat = Object.keys(galat).length > 0;
  const tampilGalat = (jalur) => (dicoba ? galat[jalur] : undefined);

  const ubah = (jalur, nilai) => {
    setForm((f) => {
      const b = { ...f };
      if (jalur.includes('.')) {
        const [o, bagian] = jalur.split('.');
        b[o] = { ...f[o], [bagian]: nilai };
      } else b[jalur] = nilai;
      return b;
    });
  };
  const isian = (jalur, props) => {
    const [o, bagian] = jalur.split('.');
    return (
      <Isian
        id={`gudep-${jalur.replace('.', '-')}`}
        jalur={jalur}
        nilai={bagian ? form[o][bagian] : form[jalur]}
        ubah={ubah}
        galat={tampilGalat(jalur)}
        wajib={WAJIB_TEKS.includes(jalur) || jalur === 'pembina.nama' || jalur === 'pembina.jabatan'}
        {...props}
      />
    );
  };

  const simpan = async (e) => {
    e.preventDefault();
    setDicoba(true);
    if (adaGalat || sibuk) return;
    setSibuk(true);
    const r = await simpanGudep(form);
    setSibuk(false);
    if (r.ok) setDicoba(false);
  };

  return (
    <div className="animasi-naik space-y-5">
      <form onSubmit={simpan} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold">Data Gudep</h1>
        <p className="text-sm text-pramuka-600">
          Identitas gugus depan, perindukan, dan pejabatnya. Isian ini menjadi rujukan kop surat, tanda tangan, nomor surat, halaman masuk, dan seluruh
          dokumen cetak; tidak perlu lagi mengubah kode aplikasi. Perbarui isian ini setiap ada pergantian pengurus atau pejabat (mis. tahun ajaran baru):
          dokumen yang dibuat sesudahnya memakai data terbaru, sedangkan berita acara sidang dan surat pengantar yang sudah terbit tetap memuat nama saat dibuat.
        </p>
        <SumberPeraturan
          className="mt-1"
          rujukan={[
            { id: 'nomor-gudep-050-2003', bagian: 'Bab III butir 6 (nomor gudep; ganjil putra, genap putri)' },
            { id: 'gudep-05-2026', bagian: 'Pasal 12 (nomor gugus depan ditetapkan SK Kwartir Cabang), Pasal 16 (Majelis Pembimbing), dan Pasal 29 (Ketua Gugus Depan)' },
          ]}
        />
      </div>

      <section className="panel space-y-1 p-4" aria-labelledby="gudep-identitas">
        <h2 id="gudep-identitas" className="mb-2 text-base font-bold text-pramuka-900">Identitas Gugus Depan dan Perindukan</h2>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {isian('nama', { label: 'Nama gugus depan', maks: 120, bantuan: 'Contoh: Gugus Depan SD Negeri 1 Contoh' })}
          {isian('singkat', { label: 'Nama perindukan', maks: 120, bantuan: 'Contoh: Perindukan Melati (kata Perindukan ditambahkan sendiri bila belum ada)' })}
          {isian('sekolah', { label: 'Nama sekolah', maks: 120, bantuan: 'Contoh: SD Negeri 1 Contoh' })}
          {isian('nomorGudep', { label: 'Nomor gudep', maks: 40, bantuan: 'Contoh: 10.701/10.702 (putra/putri)' })}
          {isian('kodeSurat', { label: 'Kode surat', maks: 30, bantuan: 'Awalan nomor Surat Tanda Lulus, mis. GD-SDN1-CTH' })}
        </div>
      </section>

      <section className="panel space-y-1 p-4" aria-labelledby="gudep-alamat">
        <h2 id="gudep-alamat" className="mb-2 text-base font-bold text-pramuka-900">Alamat, kontak, dan kwartir</h2>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{isian('alamat', { label: 'Alamat', maks: 200, bantuan: 'Tercetak pada kop surat.' })}</div>
          {isian('kota', { label: 'Kota (tempat surat)', maks: 60, bantuan: 'Mis. "Purbalingga, 21 September 2026" pada tanda tangan.' })}
          {isian('telepon', { label: 'Telepon (opsional)', maks: 40, jenis: 'tel' })}
          {isian('email', { label: 'Email (opsional)', maks: 100, jenis: 'email' })}
          <span className="hidden sm:block" aria-hidden="true" />
          {isian('kwarran', { label: 'Kwartir ranting', maks: 80, bantuan: 'Contoh: Kwartir Ranting Contoh' })}
          {isian('kwarcab', { label: 'Kwartir cabang', maks: 80, bantuan: 'Contoh: Kwartir Cabang Purbalingga' })}
        </div>
      </section>

      <section aria-labelledby="gudep-pejabat">
        <h2 id="gudep-pejabat" className="mb-1 text-base font-bold text-pramuka-900">Pejabat dan NTA</h2>
        <p className="mb-2 text-xs text-pramuka-600">
          Nama, jabatan, dan NTA di bawah ini dipakai sebagai penanda tangan Surat Tanda Lulus, piagam pelantikan, dan surat lain yang dicetak aplikasi.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {KOLOM_ORANG.map((o) => (
            <div key={o} className="panel p-4">
              <h3 className="text-sm font-bold text-pramuka-900">{KETERANGAN_ORANG[o].judul}</h3>
              <p className="mb-2 text-xs text-pramuka-600">{KETERANGAN_ORANG[o].pakai}</p>
              {isian(`${o}.jabatan`, { label: 'Jabatan pada dokumen', maks: 80 })}
              {isian(`${o}.nama`, { label: 'Nama lengkap dan gelar', maks: 120 })}
              {isian(`${o}.nta`, { label: 'NTA', maks: 40, bantuan: 'Nomor Tanda Anggota Pramuka, mis. 11.03.10.701.02365' })}
              {(o === 'pembina' || o === 'kamabigus') && isian(`${o}.nip`, { label: 'NIP (opsional)', maks: 40 })}
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-4" aria-labelledby="gudep-pratinjau">
        <h2 id="gudep-pratinjau" className="mb-2 text-base font-bold text-pramuka-900">Pratinjau kop surat</h2>
        <div className="overflow-x-auto">
          <div className="min-w-[560px] bg-white p-3 text-pramuka-900"><KopSurat gudep={form} /></div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-primary" disabled={!berubah || sibuk}>{sibuk ? 'Menyimpan...' : 'Simpan data gudep'}</button>
        <button type="button" className="btn btn-outline" disabled={!berubah || sibuk} onClick={() => { setForm(untukForm(tersimpan)); setDicoba(false); }}>Batalkan perubahan</button>
        <button type="button" className="btn btn-outline" disabled={sibuk} onClick={() => setForm(untukForm(GUDEP_BAWAAN))} title="Mengisi formulir dengan nilai bawaan aplikasi; belum tersimpan sebelum Anda menekan Simpan">
          Isi dengan nilai bawaan
        </button>
        {dicoba && adaGalat && <p role="alert" className="text-sm font-medium text-red-700">Ada isian yang perlu diperbaiki (tanda merah).</p>}
      </div>
      </form>

      <TemaTampilan />

      <CadanganData />
    </div>
  );
}
