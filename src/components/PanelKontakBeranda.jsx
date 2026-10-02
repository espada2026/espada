import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Field } from './ui';
import { BATAS, LABEL, KOLOM_PARAGRAF, periksaKontak, samaKontak, untukForm } from '../lib/berandaLogic';

/** Satu isian: teks satu baris atau paragraf (textarea). */
function Isian({ kolom, form, ubah, galat, bantuan, placeholder, jenis = 'text', baris = 0 }) {
  const id = `beranda-${kolom}`;
  const nilai = form[kolom];
  const umum = {
    id,
    value: nilai,
    maxLength: BATAS[kolom] + 200, // sedikit longgar: pesan galat yang menuntun, bukan pemotongan diam-diam
    placeholder,
    onChange: (e) => ubah(kolom, e.target.value),
    'aria-invalid': galat ? 'true' : undefined,
    'aria-describedby': galat ? `${id}-galat` : undefined,
    className: `input ${galat ? 'border-red-500' : ''}`,
  };
  return (
    <Field label={LABEL[kolom]} htmlFor={id} bantuan={bantuan}>
      {baris ? <textarea rows={baris} {...umum} /> : <input type={jenis} {...umum} />}
      {KOLOM_PARAGRAF.includes(kolom) && <p className="mt-1 text-right text-xs text-pramuka-500">{nilai.length} / {BATAS[kolom]}</p>}
      {galat && <p id={`${id}-galat`} role="alert" className="mt-1 text-xs font-medium text-red-700">{galat}</p>}
    </Field>
  );
}

/** Tab Kontak pada Kelola Beranda: kontak, tautan media sosial, jadwal latihan, sambutan, dan cerita gudep (pengaturan beranda.kontak). */
export default function PanelKontakBeranda() {
  const { api, notify } = useApp();
  const [awal, setAwal] = useState(null); // tersimpan di server (null = belum dimuat)
  const [form, setForm] = useState(() => untukForm(null));
  const [galatMuat, setGalatMuat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [dicoba, setDicoba] = useState(false);

  const muat = useCallback(async () => {
    const r = await api().muatBerandaKontak();
    if (r.ok) { setAwal(r.data); setForm(r.data); setGalatMuat(''); } else setGalatMuat(r.pesan ?? 'Isi beranda tidak dapat dimuat.');
  }, [api]);
  useEffect(() => { muat(); }, [muat]);

  const galat = periksaKontak(form);
  const berubah = awal !== null && !samaKontak(form, awal);
  const ubah = (kolom, nilai) => setForm((f) => ({ ...f, [kolom]: nilai }));
  const tampil = (kolom) => (dicoba ? galat[kolom] : undefined);
  const bagi = { form, ubah };

  const simpan = async (e) => {
    e.preventDefault();
    setDicoba(true);
    if (Object.keys(galat).length || sibuk) return;
    setSibuk(true);
    const r = await api().simpanBerandaKontak(form);
    setSibuk(false);
    if (!r.ok) { notify(r.pesan, 'err'); return; }
    notify('Isi beranda tersimpan.');
    setDicoba(false);
    await muat();
  };

  return (
    <div className="space-y-5">
      {galatMuat && <p role="alert" className="panel border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800">{galatMuat}</p>}

      <form onSubmit={simpan} className="space-y-5" noValidate>
        <section className="panel p-4" aria-labelledby="beranda-kontak">
          <h2 id="beranda-kontak" className="text-base font-bold text-pramuka-900">Kontak dan jadwal</h2>
          <p className="mb-3 text-xs text-pramuka-600">Email dan telepon yang dikosongkan memakai yang tertera di Data Gudep.</p>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Isian kolom="whatsapp" galat={tampil('whatsapp')} placeholder="08xxxxxxxxxx" bantuan="Dipakai tombol WhatsApp di beranda." {...bagi} />
            <Isian kolom="telepon" galat={tampil('telepon')} {...bagi} />
            <Isian kolom="email" galat={tampil('email')} jenis="email" {...bagi} />
            <Isian kolom="jadwal" galat={tampil('jadwal')} placeholder="Setiap Sabtu pagi di sekolah" {...bagi} />
          </div>
        </section>

        <section className="panel p-4" aria-labelledby="beranda-sosial">
          <h2 id="beranda-sosial" className="text-base font-bold text-pramuka-900">Media sosial dan peta</h2>
          <p className="mb-3 text-xs text-pramuka-600">Tempel alamat lengkap yang diawali https://. Alamat lain (mis. javascript:) ditolak.</p>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Isian kolom="instagram" galat={tampil('instagram')} placeholder="https://instagram.com/..." {...bagi} />
            <Isian kolom="youtube" galat={tampil('youtube')} placeholder="https://youtube.com/..." {...bagi} />
            <Isian kolom="facebook" galat={tampil('facebook')} placeholder="https://facebook.com/..." {...bagi} />
            <Isian kolom="tiktok" galat={tampil('tiktok')} placeholder="https://tiktok.com/@..." {...bagi} />
            <Isian kolom="peta" galat={tampil('peta')} placeholder="https://maps.app.goo.gl/..." bantuan="Kosong = tombol peta membuka pencarian nama sekolah di Google Maps." {...bagi} />
          </div>
        </section>

        <section className="panel p-4" aria-labelledby="beranda-teks">
          <h2 id="beranda-teks" className="text-base font-bold text-pramuka-900">Sambutan dan cerita gudep</h2>
          <p className="mb-3 text-xs text-pramuka-600">Pisahkan paragraf dengan satu baris kosong. Nama dan jabatan penyampai sambutan diambil dari Data Gudep.</p>
          <Isian kolom="sambutanPembina" galat={tampil('sambutanPembina')} baris={5} {...bagi} />
          <Isian kolom="sambutanKepsek" galat={tampil('sambutanKepsek')} baris={5} {...bagi} />
          <Isian kolom="cerita" galat={tampil('cerita')} baris={6} bantuan="Kosong = beranda memakai kalimat bawaan." {...bagi} />
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-gold" disabled={sibuk || !berubah}>{sibuk ? 'Menyimpan...' : 'Simpan'}</button>
          {berubah && <span className="text-sm text-pramuka-600">Ada perubahan yang belum disimpan.</span>}
          {dicoba && Object.keys(galat).length > 0 && <span role="alert" className="text-sm font-medium text-red-700">Perbaiki isian yang bertanda merah.</span>}
        </div>
      </form>
    </div>
  );
}
