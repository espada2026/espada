/**
 * Katalog SKU Pramuka Siaga terdaftar (SK Kwarnas 119/2011; data di skuSiagaData.js). Mengimpor berkas ini MENDAFTARKAN tingkat Mula, Bantu, dan Tata ke
 * SEMUA_TINGKAT dan INDEKS_POIN (skuData.js). Hanya halaman Siaga (dimuat malas), skrip skema/migrasi, dan uji yang mengimpornya, sehingga katalog ini
 * tidak menambah ukuran JS awal; kode umum (skuLogic, dokumenLogic) membacanya lewat SEMUA_TINGKAT/INDEKS_POIN dan baru melihat Siaga sesudah pendaftaran.
 */
import { bangun, daftarkanTingkat } from './skuData.js';
import { AGAMA_LAIN_SIAGA, BUTIR_BANTU, BUTIR_MULA, BUTIR_TATA } from './skuSiagaData.js';

const denganAgamaLainSiaga = (b) => (b.agama ? { ...b, agamaLain: AGAMA_LAIN_SIAGA } : b);

export const TINGKAT_SIAGA = {
  Mula: bangun('MUL', 'SKU Siaga Mula', BUTIR_MULA.map(denganAgamaLainSiaga)),
  Bantu: bangun('BNU', 'SKU Siaga Bantu', BUTIR_BANTU.map(denganAgamaLainSiaga)),
  Tata: bangun('TAT', 'SKU Siaga Tata', BUTIR_TATA.map(denganAgamaLainSiaga)),
};
export const DAFTAR_TINGKAT_SIAGA = Object.keys(TINGKAT_SIAGA);
for (const [tingkat, t] of Object.entries(TINGKAT_SIAGA)) daftarkanTingkat(tingkat, t);
