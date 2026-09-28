/**
 * PENSIL SUNTING di halaman muka (murni, tanpa React): pengurus yang sedang masuk melihat ikon pensil pada tiap bagian halaman muka, menuju tab
 * Kelola Beranda yang sesuai. Halaman muka sengaja tidak memuat klien basis data (JS awal kecil, pengunjung umum tidak mengunduhnya), jadi peran
 * TIDAK dibaca dari server di sana: aplikasi menulis petunjuk kecil di localStorage tiap kali pengguna dimuat, dan halaman muka hanya membacanya
 * bila ada sesi tersimpan. Petunjuk ini hanya menampilkan atau menyembunyikan ikon; hak sebenarnya tetap ditegakkan server (dan tab Kelola Beranda
 * tetap menyaring dari peran di aplikasi), jadi petunjuk yang usang atau diubah orang tidak memberi hak apa pun.
 */
import { pembinaAtauAdmin, pengurus } from './hakLogic';

export const KUNCI_PETUNJUK = 'sigarda_petunjuk_sunting';

/** Tab Kelola Beranda, urut seperti di menu. `faq` hanya untuk Pembina dan Admin (sama dengan KelolaBeranda.jsx). */
export const TAB_KELOLA = ['kontak', 'berita', 'prestasi', 'galeri', 'sosial', 'faq'];

/** Petunjuk untuk pengguna menurut tampilan: 'pembina' (Pembina/Admin), 'pengurus' (Dewan Ambalan), atau '' (bukan pengurus). */
export const petunjukDari = (user) => (pembinaAtauAdmin(user) ? 'pembina' : pengurus(user) ? 'pengurus' : '');

/** Boleh melihat pensil untuk tab ini? */
export const bolehSunting = (petunjuk, tab) => (petunjuk === 'pembina' ? TAB_KELOLA.includes(tab) : petunjuk === 'pengurus' ? TAB_KELOLA.includes(tab) && tab !== 'faq' : false);

/** Alamat yang membuka aplikasi langsung di tab Kelola Beranda tertentu (relatif, jalan di alamat dasar mana pun). */
export const tautanSunting = (tab) => `./?buka=kelolaberanda&tab=${encodeURIComponent(tab)}`;

/** Tab dari alamat (?buka=kelolaberanda&tab=berita); null bila bukan permintaan membuka Kelola Beranda. Tab tak dikenal menjadi 'kontak'. */
export function parameterKelola(search = '') {
  const p = new URLSearchParams(search);
  if (p.get('buka') !== 'kelolaberanda') return null;
  const tab = p.get('tab');
  return TAB_KELOLA.includes(tab) ? tab : 'kontak';
}

export function simpanPetunjuk(petunjuk, penyimpan = globalThis.localStorage) {
  try {
    if (!penyimpan) return;
    if (petunjuk) penyimpan.setItem(KUNCI_PETUNJUK, petunjuk);
    else penyimpan.removeItem(KUNCI_PETUNJUK);
  } catch { /* penyimpanan diblokir: tanpa pensil */ }
}

/** Petunjuk tersimpan, hanya bila ada sesi (`adaSesi`); nilai selain 'pembina' dan 'pengurus' dianggap kosong. Tidak pernah melempar galat. */
export function bacaPetunjuk(adaSesi, penyimpan = globalThis.localStorage) {
  try {
    if (!adaSesi || !penyimpan) return '';
    const v = penyimpan.getItem(KUNCI_PETUNJUK);
    return v === 'pembina' || v === 'pengurus' ? v : '';
  } catch { return ''; }
}
