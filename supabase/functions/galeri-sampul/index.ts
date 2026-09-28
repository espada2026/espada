// ============================================================================
// SIGARDA: Edge Function `galeri-sampul` (mengambil foto sampul dan nama album Google Photos)
//
// Dipanggil aplikasi (menu Kelola Beranda > Galeri) saat pengurus menempel tautan album Google Photos:
//   POST { "tautan": "https://photos.app.goo.gl/..." }   dengan header Authorization: Bearer <sesi pengguna>
// Jawaban (selalu HTTP 200): { ok: true, sampul, judul } atau { ok: false, pesan }.
// Halaman album yang dibagikan memuat gambar pratinjau tautan (meta og:image, dipakai WhatsApp) berupa foto sampul album. Peramban tidak boleh membaca halaman
// Google (CORS), jadi fungsi ini yang mengambilnya. Hasilnya disimpan aplikasi di kolom sampul album seperti biasa; fungsi ini tidak menulis apa pun.
//
// Keamanan: hanya pengurus aktif (Pembina, Admin Gudep, Dewan Ambalan) yang dilayani; hanya tautan photos.app.goo.gl dan photos.google.com yang diambil,
// setiap pengalihan diperiksa lagi sebelum diikuti (tidak dapat dipakai sebagai proxy ke alamat lain), batas waktu dan ukuran dijaga, dan hanya alamat gambar
// googleusercontent.com berpola ketat yang dikembalikan.
//
// Secret: tidak ada yang perlu diisi (SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tersedia otomatis).
// Deploy: lihat README bagian "Sampul album Google Photos otomatis". Matikan "Verify JWT" (pemeriksaan dilakukan di dalam fungsi, sama seperti fungsi sigarda).
// Berkas ini SENGAJA satu berkas agar bisa ditempel di editor dashboard Supabase. Logika (tangani) tidak bergantung pada Deno dan diuji.
// ============================================================================

// deno-lint-ignore-file no-explicit-any
// Harus import tetap (bukan import() dinamis): runtime Supabase hanya mengemas pustaka yang terlihat saat deploy.
import { createClient } from 'npm:@supabase/supabase-js@2';

declare const Deno: any;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const HOST_ALBUM = new Set(['photos.app.goo.gl', 'photos.google.com']);
// Alamat dasar gambar tanpa akhiran ukuran (=w800-h600...), mis. https://lh3.googleusercontent.com/pw/AP1Gcz...
const POLA_DASAR = /^https:\/\/lh[0-9]\.googleusercontent\.com\/[A-Za-z0-9_/.-]{20,600}$/;
const MAKS_LONCAT = 5;
const BATAS_BYTE = 3_000_000;
const BATAS_MS = 12_000;
const UKURAN_BAWAAN = 'w800-h600-p-k-no'; // kartu galeri 4:3, dipangkas rapi

/** Tautan album Google Photos yang dibagikan (https, host dikenal). Dicerminkan src/lib/galeriSampulLogic.js (dijaga uji/galeri-sampul.mjs). */
export function albumGooglePhotos(tautan: unknown) {
  try {
    const u = new URL(String(tautan ?? '').trim());
    return u.protocol === 'https:' && HOST_ALBUM.has(u.hostname.toLowerCase());
  } catch { return false; }
}

const bukaEntitas = (s: string) => s.replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Isi meta bernama `nama` (mis. og:image) dari HTML; urutan atribut bebas; '' bila tidak ada. */
export function ambilMeta(html: string, nama: string) {
  for (const tag of String(html ?? '').match(/<meta\b[^>]*>/gi) ?? []) {
    if (!new RegExp(`\\bproperty\\s*=\\s*["']${nama}["']`, 'i').test(tag)) continue;
    const isi = /\bcontent\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? /\bcontent\s*=\s*'([^']*)'/i.exec(tag)?.[1] ?? '';
    return bukaEntitas(isi).trim();
  }
  return '';
}

/** Alamat dasar (tanpa akhiran ukuran) dari alamat gambar; '' bila bukan gambar googleusercontent.com berpola sah. */
export function dasarSampul(url: unknown) {
  const s = String(url ?? '').trim();
  const i = s.lastIndexOf('=');
  const dasar = i > 0 && /^[A-Za-z0-9-]*$/.test(s.slice(i + 1)) ? s.slice(0, i) : s;
  return POLA_DASAR.test(dasar) ? dasar : '';
}

/** Nama album dari og:title: bagian penanggalan otomatis Google di ujung ("... · Thursday, Sep 24") dibuang; paling panjang 100 karakter. */
export function bersihkanJudul(judul: string) {
  const s = String(judul ?? '').replace(/\s+·\s+[^·]*\d[^·]*$/, '').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, 100).join('').trim();
}

/** Pengurus aktif: penguji dan Admin aktif, atau Penegak aktif berjabatan Dewan, dan sudah mengganti PIN awal. Dicerminkan dari sigarda.pengurus() (dijaga uji/galeri-sampul.mjs). */
export function pengurusAktif(p: any) {
  if (!p || (p.status ?? 'aktif') !== 'aktif' || p.wajib_ganti_pin) return false;
  return p.role === 'penguji' || p.role === 'admin' || (p.role === 'peserta' && !!p.jabatan_dewan);
}

async function bacaTerbatas(res: Response, batas: number) {
  const pembaca = res.body?.getReader();
  if (!pembaca) return '';
  const potongan: Uint8Array[] = [];
  let total = 0;
  while (total < batas) {
    const { done, value } = await pembaca.read();
    if (done) break;
    potongan.push(value);
    total += value.length;
  }
  try { await pembaca.cancel(); } catch { /* sudah selesai */ }
  const gabung = new Uint8Array(total);
  let posisi = 0;
  for (const p of potongan) { gabung.set(p, posisi); posisi += p.length; }
  return new TextDecoder().decode(gabung.subarray(0, batas)); // satu potongan dapat melampaui batas: dipotong tegas
}

/** Mengambil halaman album dan membaca sampul serta nama. Pengalihan diikuti manual, dan setiap alamat diperiksa lagi (bukan hanya yang pertama). */
export async function ambilAlbum(tautan: string, ambil: typeof fetch = fetch): Promise<{ sampul: string; judul: string } | { galat: string }> {
  let url = tautan;
  for (let i = 0; i <= MAKS_LONCAT; i++) {
    if (!albumGooglePhotos(url)) return { galat: 'Tautan dialihkan ke alamat yang bukan Google Photos, jadi tidak diikuti.' };
    let res: Response;
    try {
      res = await ambil(url, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SIGARDA-sampul/1.0)', 'Accept-Language': 'id,en;q=0.8' }, signal: AbortSignal.timeout(BATAS_MS) });
    } catch {
      return { galat: 'Google Photos tidak dapat dihubungi. Coba lagi nanti.' };
    }
    if (res.status >= 300 && res.status < 400) {
      const lokasi = res.headers.get('location');
      if (!lokasi) return { galat: 'Pengalihan dari Google Photos tidak lengkap.' };
      try { url = new URL(lokasi, url).href; } catch { return { galat: 'Pengalihan dari Google Photos tidak sah.' }; }
      continue;
    }
    if (!res.ok) return { galat: `Google Photos menjawab ${res.status}. Pastikan albumnya dibagikan lewat tautan.` };
    const html = await bacaTerbatas(res, BATAS_BYTE);
    const dasar = dasarSampul(ambilMeta(html, 'og:image'));
    if (!dasar) return { galat: 'Sampul album tidak ditemukan. Pastikan ini tautan album yang dibagikan (bukan foto tunggal atau album pribadi).' };
    return { sampul: `${dasar}=${UKURAN_BAWAAN}`, judul: bersihkanJudul(ambilMeta(html, 'og:title')) };
  }
  return { galat: 'Terlalu banyak pengalihan dari Google Photos.' };
}

export type Deps = {
  profilDari: (token: string) => Promise<any | null>;   // profil pemilik sesi (role, jabatan_dewan, status) atau null bila sesi tidak sah
  ambil: typeof fetch;
};

/** Titik masuk logika. Selalu mengembalikan objek jawaban (dikirim dengan HTTP 200, seperti fungsi sigarda). */
export async function tangani(metode: string, authHeader: string | null, body: any, d: Deps) {
  if (metode !== 'POST') return { ok: false, pesan: 'Gunakan POST.' };
  const token = authHeader?.replace(/^Bearer\s+/i, '') ?? '';
  const profil = token ? await d.profilDari(token) : null;
  if (!profil) return { ok: false, pesan: 'Sesi berakhir. Masuk kembali.', sesiBerakhir: true };
  if (!pengurusAktif(profil)) return { ok: false, pesan: 'Hanya pengurus (Pembina, Admin Gudep, dan Dewan Ambalan) yang dapat mengambil sampul album.' };
  const tautan = typeof body?.tautan === 'string' ? body.tautan.trim() : '';
  if (!albumGooglePhotos(tautan)) return { ok: false, pesan: 'Hanya tautan album Google Photos (photos.app.goo.gl atau photos.google.com) yang dapat diambil sampulnya.' };
  const r = await ambilAlbum(tautan, d.ambil);
  return 'galat' in r ? { ok: false, pesan: r.galat } : { ok: true, sampul: r.sampul, judul: r.judul };
}

/* ============================================================================
 * Sambungan ke Supabase (hanya berjalan di Deno / Supabase Edge Functions)
 * ========================================================================== */

let depsDeno: Deps | null = null;
function ambilDepsDeno(): Deps {
  if (depsDeno) return depsDeno;
  const url = Deno.env.get('SUPABASE_URL');
  const layanan = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  // Periksa lebih dulu agar penyebabnya jelas di log, bukan "500 Internal Server Error".
  if (!url) throw new Error('SUPABASE_URL tidak tersedia pada fungsi.');
  if (!layanan) throw new Error('SUPABASE_SERVICE_ROLE_KEY tidak tersedia pada fungsi.');
  const admin = createClient(url, layanan, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  depsDeno = {
    ambil: fetch,
    async profilDari(token: string) {
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user?.id) return null;
      const { data: p } = await admin.from('profiles').select('role, jabatan_dewan, status, wajib_ganti_pin').eq('id', data.user.id).maybeSingle();
      return p ?? null;
    },
  };
  return depsDeno;
}

if (typeof Deno !== 'undefined' && Deno.serve) {
  Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    let body: any = {};
    try { body = await req.json(); } catch { /* badan kosong */ }
    let hasil: any;
    try {
      hasil = await tangani(req.method, req.headers.get('Authorization'), body, ambilDepsDeno());
    } catch (e: any) {
      hasil = { ok: false, pesan: `Fungsi galeri-sampul belum siap: ${e?.message ?? e}` };
    }
    return new Response(JSON.stringify(hasil), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  });
}
