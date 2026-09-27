import { useEffect, useState } from 'react';
import { Icon } from './ui';

const WARNA_NOMOR = {
  selesai: 'bg-emerald-600 text-white',
  proses: 'bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300',
  belum: 'bg-pramuka-100 text-pramuka-700',
};

/**
 * Lingkaran nomor urut butir: nomor SELALU terlihat (tidak digantikan tanda centang), ditambah lencana
 * centang kecil di sudut bila statusnya selesai/lulus. Dipakai pada SKU, portofolio Garuda, dan SPG agar seragam.
 */
export function NomorButir({ no, status, className = 'h-8 w-8 text-sm', bulat = true, title }) {
  const selesai = status === 'selesai';
  return (
    <span
      className={`relative mt-0.5 flex shrink-0 items-center justify-center font-bold ${bulat ? 'rounded-full' : 'rounded'} ${className} ${WARNA_NOMOR[status] ?? WARNA_NOMOR.belum}`}
      title={title}
    >
      {no}
      {selesai && (
        <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-700 ring-2 ring-white">
          <Icon nama="cek" className="h-2 w-2 text-white" />
        </span>
      )}
    </span>
  );
}

const WARNA_KOTAK = {
  selesai: 'bg-emerald-600 text-white hover:bg-emerald-700',
  proses: 'bg-amber-400 text-pramuka-900 hover:bg-amber-500',
  belum: 'bg-pramuka-100 text-pramuka-600 ring-1 ring-inset ring-pramuka-300 hover:bg-pramuka-200',
};

/** Kartu ringkas jumlah selesai/proses/belum. Dipisah dari kotak-kotaknya supaya halaman yang sudah punya kartu serupa (mis. RekapKesiapan) tidak menampilkannya dua kali. */
export function RingkasanKotak({ ringkasan, labelSelesai = 'Lulus' }) {
  return (
    <dl className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-lg bg-emerald-50 px-2 py-2.5">
        <dt className="text-xs font-semibold text-emerald-800">{labelSelesai}</dt>
        <dd className="font-display text-2xl font-bold text-emerald-800">{ringkasan.selesai}</dd>
      </div>
      <div className="rounded-lg bg-amber-50 px-2 py-2.5">
        <dt className="text-xs font-semibold text-amber-900">Proses</dt>
        <dd className="font-display text-2xl font-bold text-amber-900">{ringkasan.proses}</dd>
      </div>
      <div className="rounded-lg bg-pramuka-100 px-2 py-2.5">
        <dt className="text-xs font-semibold text-pramuka-700">Belum</dt>
        <dd className="font-display text-2xl font-bold text-pramuka-800">{ringkasan.belum}</dd>
      </div>
    </dl>
  );
}

/** Kotak-kotak bernomor saja (tanpa kartu ringkasan): judul, grid tombol berwarna, dan legenda. */
export function KotakBar({ judul, labelSelesai = 'Lulus', labelProses = 'Proses', labelBelum = 'Belum', kotak }) {
  return (
    <div>
      <p className="mb-1.5 mt-4 text-xs font-semibold text-pramuka-600">{judul}</p>
      <ul className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(2.25rem, 1fr))' }}>
        {kotak.map((k) => (
          <li key={k.key}>
            <button
              type="button"
              title={k.judul}
              onClick={k.onKlik}
              className={`flex h-9 w-full items-center justify-center rounded text-xs font-bold transition-colors ${WARNA_KOTAK[k.status] ?? WARNA_KOTAK.belum}`}
            >
              {k.no}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-pramuka-600">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" />{labelSelesai}</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />{labelProses}</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-pramuka-200" />{labelBelum}</span>
      </p>
    </div>
  );
}

/**
 * Ringkasan progres berbentuk kotak-kotak bernomor (gaya peta dokumen portofolio Garuda), dengan jumlah
 * selesai/proses/belum di atasnya. Tiap kotak dapat diklik untuk menyorot butir terkait di daftar bawahnya.
 * `id` = target tombol "kembali ke atas"; beri `scroll-mt-20` pada elemen ini bila ditempatkan di bawah header sticky.
 * Dipakai berdiri sendiri (SKU, SPG). Halaman yang sudah punya kartu ringkasan sendiri (Portofolio Garuda)
 * memakai `RingkasanKotak` dan `KotakBar` langsung agar tidak dobel.
 */
export default function GridProgres({ id, judul, labelSelesai = 'Lulus', ringkasan, kotak }) {
  return (
    <section id={id} className="panel scroll-mt-20 mb-4 p-4" aria-label={judul}>
      <RingkasanKotak ringkasan={ringkasan} labelSelesai={labelSelesai} />
      <KotakBar judul={judul} labelSelesai={labelSelesai} kotak={kotak} />
    </section>
  );
}

/** Gulir halus ke elemen `id` lalu sorot sesaat dengan kilau emas yang sudah ada (.glow-emas), tanpa gaya baru. */
export function gulirDanSorot(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.add('glow-emas');
  window.setTimeout(() => el.classList.remove('glow-emas'), 1800);
}

/**
 * Tombol melayang "kembali ke atas": muncul sesudah bagian `targetId` (ringkasan progres) tergulir keluar layar,
 * dan mengembalikan tampilan ke sana. `bottom-20` di ponsel supaya tidak tertutup menu bawah.
 */
export function TombolKeAtas({ targetId }) {
  const [tampil, setTampil] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return undefined;
    const onScroll = () => setTampil(target.getBoundingClientRect().bottom < 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [targetId]);

  if (!tampil) return null;
  return (
    <button
      type="button"
      onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      className="no-print fixed bottom-20 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-pramuka-800 text-pramuka-50 shadow-lg ring-2 ring-emas transition-transform hover:scale-105 md:bottom-6"
      aria-label="Kembali ke ringkasan progres"
      title="Kembali ke ringkasan progres"
    >
      <Icon nama="panahAtas" className="h-5 w-5" />
    </button>
  );
}
