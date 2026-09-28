import { renderToStaticMarkup } from 'react-dom/server';
import LogoMark from '../components/LogoMark';
import { pecahParagraf, pecahTanggal, tautanBagikanWa, urlGambar } from '../lib/berandaLogic';
import { LABEL_KATEGORI_BERITA } from '../lib/berandaKontenLogic';
import { susunDokumenBerita, urlBerita } from '../lib/beritaStatisLogic';

/**
 * Halaman satu berita (dirender SAAT BUILD menjadi HTML statis, tanpa JavaScript di peramban; lihat scripts/berita-statis.mjs). Hanya kelas Tailwind yang sudah
 * ada di CSS hasil build (dipakai halaman muka juga); semua tautan memakai alamat utama situs agar jalan dari alamat bersarang berita/<id>-<slug>/.
 */
export default function HalamanBerita({ b, namaGudep, alamatSitus }) {
  const dasar = `${String(alamatSitus).replace(/\/+$/, '')}/`;
  const t = pecahTanggal(b.terbitPada.slice(0, 10));
  const sampul = urlGambar(b.sampulUrl);
  const isi = pecahParagraf(b.isi);
  return (
    <div className="min-h-screen bg-pramuka-50 text-pramuka-900">
      <header className="border-b border-emas/25 bg-pramuka-900 text-pramuka-50">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-3 px-5">
          <a href={dasar} className="flex min-w-0 items-center gap-3 no-underline">
            <LogoMark size={38} judul="Lambang SIGARDA" />
            <span className="min-w-0 truncate font-display text-[15px] font-bold tracking-wide">{namaGudep}</span>
          </a>
          <a href={`${dasar}#masuk`} className="btn btn-gold ml-auto shrink-0 !rounded-full !px-5">Masuk</a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
        <nav aria-label="Jejak halaman" className="mb-5 text-sm"><a className="font-semibold text-emas-dark" href={`${dasar}#berita`}>← Semua berita</a></nav>
        <article>
          <span className="inline-block w-fit rounded-full bg-emas/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emas-dark">{LABEL_KATEGORI_BERITA[b.kategori] ?? 'Berita'}</span>
          <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-4xl">{b.judul}</h1>
          {t && <p className="mt-2 text-sm text-pramuka-500"><time dateTime={b.terbitPada}>{t.namaHari}, {t.hari} {t.bulan} {t.tahun}</time></p>}
          {sampul && <img src={sampul} alt="" className="mt-6 w-full rounded-2xl object-cover" />}
          {b.ringkasan && <p className="mt-6 text-lg leading-relaxed text-pramuka-700">{b.ringkasan}</p>}
          <div className="mt-5 space-y-4 text-base leading-relaxed text-pramuka-800">
            {isi.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <p className="mt-8 border-t border-pramuka-200 pt-4">
            <a href={tautanBagikanWa(b.judul, urlBerita(dasar, b))} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-emas-dark">Bagikan lewat WhatsApp ↗</a>
          </p>
        </article>
      </main>
      <footer className="bg-[#150b05] py-8 text-center text-sm text-pramuka-200">
        <p>© {namaGudep}. <a className="underline" href={dasar}>Kembali ke halaman muka</a></p>
      </footer>
    </div>
  );
}

/** Dokumen HTML utuh satu berita. `kepalaTambahan` = tag gaya dan ikon dari index.html hasil build. */
export function renderHalamanBerita({ b, namaGudep, alamatSitus, gambarCadangan, kepalaTambahan }) {
  const badanHtml = renderToStaticMarkup(<HalamanBerita b={b} namaGudep={namaGudep} alamatSitus={alamatSitus} />);
  return susunDokumenBerita({ b, badanHtml, alamatSitus, namaGudep, gambarCadangan, kepalaTambahan });
}
