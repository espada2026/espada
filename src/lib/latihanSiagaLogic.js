/**
 * LATIHAN PERINDUKAN ANAK SIAGA (murni, tanpa React; Pramuka Siaga, Fase 3)
 *
 * SK Kwarnas 119/2011, butir 11 tiap tingkat: rajin dan giat mengikuti latihan perindukan (Mula sedikitnya 6 kali berturut-turut, Bantu 8 kali sebagai Siaga Mula,
 * Tata 12 kali sebagai Siaga Bantu). Datanya dari absensi latihan (absensi_sesi/absensi_hadir; hari latihan bebas, tidak hanya Jumat): hadir = status 'H'.
 * Hanya tampilan bantuan: Pembina yang menilai butirnya. Kenaikan tingkat lewat pelantikan (Fase 4) akan menggantikan tanggal "sejak" di sini.
 */
import { hariIni } from './format';

export const TARGET_LATIHAN = { Mula: 6, Bantu: 8, Tata: 12 };

/** Awalan id butir tiap tingkat sebelumnya (butir Penegak tidak ada di sini). */
const AWALAN_SEBELUM = { Bantu: 'MUL-', Tata: 'BNU-' };

/**
 * Tanggal sejak anak mulai menjalani `tingkat`: tanggal uji terakhir butir lulus pada tingkat sebelumnya, atau null (Mula, atau tingkat sebelumnya belum ada tanggal ujinya).
 * `progressPeserta` = progress[pesertaId] ({ [sku_id]: { status, tanggalUji } }).
 */
export function awalTingkat(progressPeserta, tingkat) {
  const awalan = AWALAN_SEBELUM[tingkat];
  if (!awalan) return null;
  let akhir = null;
  for (const [id, e] of Object.entries(progressPeserta ?? {})) {
    if (id.startsWith(awalan) && e.status === 'lulus' && e.tanggalUji && (akhir === null || e.tanggalUji > akhir)) akhir = e.tanggalUji;
  }
  return akhir;
}

/**
 * Ringkasan latihan satu anak dari `absensi` ({ sesi, hadir }). Sesi yang kehadirannya belum dicatat untuk anak ini tidak dihitung.
 * Hasil: { sesi (jumlah latihan pada rentang), tercatat, hadir, beruntun (hadir berturut-turut sampai latihan tercatat terbaru) }.
 */
export function ringkasLatihan(absensi, pesertaId, { sejak = null, hari = hariIni() } = {}) {
  const tanggal = Object.keys(absensi?.sesi ?? {}).filter((t) => t <= hari && (!sejak || t >= sejak)).sort();
  let tercatat = 0;
  let hadir = 0;
  let beruntun = 0;
  for (const t of tanggal) {
    const st = absensi?.hadir?.[t]?.[pesertaId]?.status;
    if (!st) continue;
    tercatat += 1;
    if (st === 'H') { hadir += 1; beruntun += 1; } else beruntun = 0;
  }
  return { sesi: tanggal.length, tercatat, hadir, beruntun };
}
