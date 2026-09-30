import { DAFTAR_TINGKAT } from '../data/skuData';
import { Icon } from './ui';

/** `daftar` = tingkat yang ditampilkan (bawaan Penegak; Siaga memberi DAFTAR_TINGKAT_SIAGA); `terkunci` = tingkat yang belum terbuka (ikon kunci). */
export default function TingkatTabs({ nilai, onUbah, kunciLaksana = false, daftar = DAFTAR_TINGKAT, terkunci = [], label = 'Tingkat SKU' }) {
  return (
    <div role="tablist" aria-label={label} className="no-print inline-flex flex-wrap rounded-lg bg-pramuka-100 p-1">
      {daftar.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={nilai === t}
          onClick={() => onUbah(t)}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
            nilai === t ? 'bg-pramuka-800 text-pramuka-50' : 'text-pramuka-700 hover:bg-pramuka-200'
          }`}
        >
          {((t === 'Laksana' && kunciLaksana) || terkunci.includes(t)) && <Icon nama="kunci" className="h-3.5 w-3.5" />}
          {t}
        </button>
      ))}
    </div>
  );
}
