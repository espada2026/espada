import { useGudep } from '../lib/gudepStore';
import { fmtTanggal } from '../lib/format';
import { labelTingkatPelantikan } from '../lib/pelantikanLogic';
import BlokTtd from './BlokTtd';
import LogoMark from './LogoMark';

/**
 * Piagam pelantikan kenaikan tingkat Siaga (A4 landscape), dari catatan pelantikan (src/lib/pelantikanLogic.js; dicatat Pembina di menu Pelantikan).
 * Tanda tangan dan stempel BASAH oleh Pembina (BlokTtd); tanpa QR karena pelantikan tidak punya token verifikasi (keaslian = tanda tangan dan stempel).
 * `pelantikan` = { tingkat: 'mula' | 'bantu' | 'tata', tanggal, tempat, catatan }.
 */
export default function PiagamPelantikanSiaga({ peserta, pelantikan }) {
  const G = useGudep();
  const tingkat = labelTingkatPelantikan(pelantikan.tingkat);
  return (
    <article className="print-area mx-auto min-w-[760px] max-w-[1050px] border-[10px] border-pramuka-800 bg-white p-2 text-pramuka-900">
      <div className="border-2 border-emas px-10 py-8 text-center">
        <div className="flex justify-center"><LogoMark size={72} /></div>
        <p className="mt-2 text-sm font-semibold">{G.nama}, {G.kwarran}</p>
        <h2 className="mt-3 font-display text-4xl font-bold text-pramuka-800">Piagam Pelantikan</h2>
        <p className="mt-1 font-display text-lg font-semibold">Pramuka Siaga Tingkat {tingkat}</p>

        <p className="mt-6 text-sm">Dengan ini dinyatakan bahwa</p>
        <p className="mt-2 border-b-2 border-emas/70 pb-1 font-display text-3xl font-bold [overflow-wrap:anywhere]">{peserta.nama}</p>
        <p className="mt-2 text-sm">
          Kelas {peserta.kelas}{peserta.barung ? `, barung ${peserta.barung}` : ''}{peserta.perindukan ? `, perindukan ${peserta.perindukan}` : ''}
        </p>

        <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed">
          telah menyelesaikan Syarat Kecakapan Umum Siaga {tingkat} dan <span className="font-bold">DILANTIK</span> sebagai Pramuka Siaga
          tingkat {tingkat} dalam upacara pelantikan pada tanggal {fmtTanggal(pelantikan.tanggal)}, bertempat di {pelantikan.tempat}.
        </p>

        <div className="mt-8 flex justify-end">
          <BlokTtd orang={G.pembina} tanggal={pelantikan.tanggal} />
        </div>
      </div>
    </article>
  );
}
