/**
 * Ilustrasi halaman muka: lanskap perkemahan (hero) dan ikon SVG program. Semuanya SVG bawaan, tanpa berkas gambar, sehingga ikut terprarender dan ringan.
 * Foto asli kegiatan menggantikan ilustrasi lewat menu Kelola Beranda pada fase berikutnya.
 */

/** Lanskap perkemahan: bukit berlapis, pinus, dua tenda, dan api unggun yang berkedip pelan. Dihias saja (aria-hidden). */
export function LanskapPerkemahan({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 1200 330" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="ln-matahari" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="rgb(var(--il-8))" stopOpacity=".95" /><stop offset="1" stopColor="rgb(var(--emas-light))" stopOpacity="0" /></radialGradient>
        <radialGradient id="ln-cahaya" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="rgb(var(--il-9))" stopOpacity=".55" /><stop offset="1" stopColor="rgb(var(--il-9))" stopOpacity="0" /></radialGradient>
        <symbol id="ln-pinus" viewBox="0 0 60 120"><path d="M30 0 50 34H38l16 30H40l18 34H2l18-34H6l16-30H10z" fill="currentColor" /><rect x="26" y="96" width="8" height="24" fill="currentColor" /></symbol>
      </defs>
      <circle cx="880" cy="128" r="120" fill="url(#ln-matahari)" />
      <circle cx="880" cy="128" r="46" fill="rgb(var(--emas-light))" />
      <path d="M0 200 120 150 240 190 380 120 520 185 660 130 800 188 940 140 1080 190 1200 150V330H0z" fill="rgb(var(--pramuka-600))" opacity=".75" />
      <path d="M0 240 100 205 230 235 360 190 500 240 640 200 780 245 930 205 1070 240 1200 210V330H0z" fill="rgb(var(--pramuka-700))" />
      <g fill="rgb(var(--pramuka-800))" color="rgb(var(--pramuka-800))">
        <use href="#ln-pinus" x="40" y="176" width="46" height="92" /><use href="#ln-pinus" x="92" y="196" width="36" height="72" /><use href="#ln-pinus" x="330" y="184" width="44" height="88" />
        <use href="#ln-pinus" x="560" y="190" width="40" height="80" /><use href="#ln-pinus" x="1010" y="180" width="48" height="96" /><use href="#ln-pinus" x="1070" y="200" width="36" height="72" /><use href="#ln-pinus" x="1130" y="172" width="52" height="104" />
      </g>
      <path d="M0 275 140 255 300 272 470 250 640 272 820 256 1000 274 1200 254V330H0z" fill="rgb(var(--il-3))" />
      <g fill="rgb(var(--pramuka-900))" color="rgb(var(--pramuka-900))">
        <use href="#ln-pinus" x="10" y="200" width="60" height="120" /><use href="#ln-pinus" x="64" y="224" width="46" height="92" /><use href="#ln-pinus" x="1120" y="196" width="64" height="128" /><use href="#ln-pinus" x="1074" y="226" width="44" height="88" />
      </g>
      <g transform="translate(180 236)">
        <path d="M0 76 70 6l70 70z" fill="rgb(var(--emas))" /><path d="M70 6l70 70H70z" fill="rgb(var(--il-5))" /><path d="M52 76 70 40l18 36z" fill="rgb(var(--pramuka-900))" />
        <path d="M70 6V-26" stroke="rgb(var(--pramuka-900))" strokeWidth="3" /><path d="M70 -26l26 8-26 8z" fill="rgb(var(--il-4))" />
      </g>
      <g transform="translate(330 262)"><path d="M0 50 46 4l46 46z" fill="rgb(var(--pramuka-200))" /><path d="M46 4l46 46H46z" fill="rgb(var(--il-6))" /><path d="M34 50 46 26l12 24z" fill="rgb(var(--pramuka-900))" /></g>
      <g transform="translate(700 262)">
        <ellipse cx="0" cy="18" rx="120" ry="34" fill="url(#ln-cahaya)" />
        <path d="M-26 40 26 26M26 40-26 26" stroke="rgb(var(--pramuka-700))" strokeWidth="7" strokeLinecap="round" />
        <g className="ln-api"><path d="M0 28c-15-4-18-19-8-30 2 8 7 7 8 14 5-6 4-16 1-24 15 8 22 26 12 36-3 3-8 4-13 4z" fill="#e2803a" /><path d="M0 28c-8-2-10-10-5-16 2 4 4 4 5 8 3-3 3-8 1-12 8 5 11 14 5 18-2 1-4 2-6 2z" fill="rgb(var(--il-9))" /></g>
      </g>
      <path d="M0 300 200 290 420 304 700 292 960 306 1200 292V330H0z" fill="rgb(var(--pramuka-900))" />
    </svg>
  );
}

const IKON = {
  tenda: <><path d="M3 20 12 4l9 16z" /><path d="M9 20l3-5 3 5" /></>,
  kompas: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  bintang: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  simpul: <><circle cx="9" cy="12" r="5" /><circle cx="15" cy="12" r="5" /></>,
  api: <path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 3-6 1 1 1 2 2 3 0-3 0-5 0-7z" />,
  tunas: <><path d="M12 21v-8" /><path d="M12 13c0-4 3-6 7-6 0 4-3 6-7 6z" /><path d="M12 15c0-3-2-5-6-5 0 3 2 5 6 5z" /></>,
  cek: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16 9.5" /></>,
};

/** Ikon garis 24x24 untuk program dan perjalanan; `nama` di luar daftar tidak menampilkan apa-apa. */
export function IkonBeranda({ nama, ukuran = 24, className = '' }) {
  if (!IKON[nama]) return null;
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      {IKON[nama]}
    </svg>
  );
}

/** Peta bergaya (bukan peta sungguhan) untuk kartu lokasi; pin di tengah. Dihias saja. */
export function PetaBergaya({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 500 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="500" height="320" fill="rgb(var(--il-7))" />
      <g stroke="rgb(var(--pramuka-50))" strokeWidth="12" fill="none" strokeLinecap="round"><path d="M-10 90 200 110 330 60 520 90" /><path d="M180 -10 210 130 190 340" /><path d="M-10 230 250 200 520 250" /></g>
      <g stroke="rgb(var(--pramuka-50))" strokeWidth="5" fill="none"><path d="M330 60 350 330" /><path d="M60 -10 90 330" /></g>
      <rect x="235" y="130" width="60" height="46" rx="6" fill="rgb(var(--pramuka-300))" />
      <path d="M265 98c-11 0-19 8-19 18 0 14 19 32 19 32s19-18 19-32c0-10-8-18-19-18z" fill="rgb(var(--pramuka-800))" />
      <circle cx="265" cy="116" r="7" fill="rgb(var(--emas-light))" />
    </svg>
  );
}
