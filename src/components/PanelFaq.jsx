import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { periksaFaq, untukFormFaq } from '../lib/berandaKontenLogic';
import { Field, Kosong } from './ui';

/** Tab Pertanyaan Umum (FAQ) pada Kelola Beranda: HANYA Pembina dan Admin Gudep (menu ini tidak ditampilkan bagi Dewan Ambalan). */
export default function PanelFaq() {
  const { api, notify } = useApp();
  const [daftar, setDaftar] = useState(null);
  const [galatMuat, setGalatMuat] = useState('');
  const [id, setId] = useState(null);
  const [form, setForm] = useState(() => untukFormFaq(null));
  const [dicoba, setDicoba] = useState(false);
  const [sibuk, setSibuk] = useState('');

  const muat = useCallback(async () => {
    const r = await api().muatFaq();
    if (r.ok) { setDaftar(r.data); setGalatMuat(''); } else setGalatMuat(r.pesan ?? 'Pertanyaan umum tidak dapat dimuat.');
  }, [api]);
  useEffect(() => { muat(); }, [muat]);

  const bukaBaru = () => { setId(null); setForm(untukFormFaq(null)); setDicoba(false); };

  const simpan = async () => {
    setDicoba(true);
    const galat = periksaFaq(form);
    if (Object.keys(galat).length || sibuk) return;
    setSibuk('simpan');
    const r = await api().simpanFaq({ ...form, id });
    setSibuk('');
    if (!r.ok) { notify(r.pesan, 'err'); return; }
    notify('Pertanyaan tersimpan.');
    bukaBaru();
    await muat();
  };

  const hapus = async (f) => {
    if (!window.confirm(`Hapus pertanyaan "${f.pertanyaan}"?`)) return;
    setSibuk(`hapus-${f.id}`);
    const r = await api().hapusFaq(f.id);
    setSibuk('');
    if (!r.ok) { notify(r.pesan, 'err'); return; }
    notify('Dihapus.');
    if (id === f.id) bukaBaru();
    await muat();
  };

  const geser = async (f, arah) => {
    setSibuk(`geser-${f.id}`);
    const r = await api().geserFaq(f.id, arah);
    setSibuk('');
    if (!r.ok) notify(r.pesan, 'err');
    await muat();
  };

  const galat = dicoba ? periksaFaq(form) : {};

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-pramuka-900">Pertanyaan umum</h3>
          {id !== null && <button type="button" className="btn btn-outline btn-sm" onClick={bukaBaru}>+ Pertanyaan baru</button>}
        </div>
        {galatMuat && <p role="alert" className="panel border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800">{galatMuat}</p>}
        {daftar === null && !galatMuat && <p className="text-sm text-pramuka-600">Memuat...</p>}
        {daftar !== null && daftar.length === 0 && <Kosong judul="Belum ada pertanyaan" teks="Kosong = beranda memakai daftar bawaan. Isi formulir di sebelah untuk menggantinya." />}
        {daftar !== null && daftar.length > 0 && (
          <div className="divide-y divide-pramuka-200 rounded-lg border border-pramuka-200 bg-white">
            {daftar.map((f, i) => (
              <div key={f.id} className="flex flex-wrap items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="font-semibold text-pramuka-900 [overflow-wrap:anywhere]">{f.pertanyaan}</p>
                  <p className="text-xs text-pramuka-600">Urutan {i + 1}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <button type="button" className="btn btn-outline btn-sm" disabled={i === 0 || !!sibuk} onClick={() => geser(f, -1)} aria-label="Naikkan urutan">↑</button>
                  <button type="button" className="btn btn-outline btn-sm" disabled={i === daftar.length - 1 || !!sibuk} onClick={() => geser(f, 1)} aria-label="Turunkan urutan">↓</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => { setId(f.id); setForm(untukFormFaq(f)); setDicoba(false); }}>Ubah</button>
                  <button type="button" className="btn btn-outline btn-sm text-red-700" disabled={sibuk === `hapus-${f.id}`} onClick={() => hapus(f)}>Hapus</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form className="min-w-0 space-y-4" onSubmit={(e) => e.preventDefault()} noValidate>
        <h3 className="text-base font-bold text-pramuka-900">{id !== null ? 'Ubah pertanyaan' : 'Tambah pertanyaan'}</h3>
        <Field label="Pertanyaan" htmlFor="faq-t">
          <input id="faq-t" className={`input ${galat.pertanyaan ? 'border-red-500' : ''}`} value={form.pertanyaan} placeholder="Tulis seperti pertanyaan calon anggota Siaga atau orang tua" onChange={(e) => setForm((f) => ({ ...f, pertanyaan: e.target.value }))} />
          {galat.pertanyaan && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{galat.pertanyaan}</p>}
        </Field>
        <Field label="Jawaban" htmlFor="faq-j">
          <textarea id="faq-j" rows={5} className={`input ${galat.jawaban ? 'border-red-500' : ''}`} value={form.jawaban} placeholder="Jawaban singkat dan jelas" onChange={(e) => setForm((f) => ({ ...f, jawaban: e.target.value }))} />
          {galat.jawaban && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{galat.jawaban}</p>}
        </Field>
        <button type="button" className="btn btn-gold" disabled={!!sibuk} onClick={simpan}>{sibuk === 'simpan' ? 'Menyimpan...' : 'Simpan pertanyaan'}</button>
        {dicoba && Object.keys(galat).length > 0 && <p role="alert" className="text-sm font-medium text-red-700">Perbaiki isian yang bertanda merah.</p>}
      </form>
    </div>
  );
}
