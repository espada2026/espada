/**
 * Panggilan BACA-SAJA tanpa login ke fungsi publik di basis data (mis. sg_beranda_publik), tanpa memuat klien basis data.
 *
 * Halaman muka (landing) dibuka pengunjung umum; untuk mereka cukup satu permintaan HTTP biasa ke PostgREST dengan kunci anon (kunci publik yang
 * memang tertanam di aplikasi), tanpa modul autentikasi. Mode lokal (`npm run dev:lokal`, Postgres di peramban) tetap lewat klien lokal.
 * Tidak pernah melempar galat: hasilnya { ok, data } atau { ok: false, pesan }.
 */

const LOKAL = import.meta.env?.VITE_BACKEND === 'lokal';

/**
 * Indeks halaman berita statis (berita/index.json, ditulis build; lihat scripts/berita-statis.mjs): larik { path, judul, terbitPada }. Berkas statis biasa di
 * situs yang sama, bukan fungsi basis data. Kosong bila belum ada (situs belum dibangun dengan halaman berita, mode lokal, jaringan putus). Tidak melempar galat.
 */
export async function ambilIndeksHalamanBerita({ ambil = globalThis.fetch, dasar = import.meta.env?.BASE_URL ?? './' } = {}) {
  try {
    const r = await ambil(`${dasar}berita/index.json`, { headers: { Accept: 'application/json' } });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

/** Alamat REST sebuah fungsi dari alamat proyek: garis miring ganda dibuang. */
export const alamatRpc = (url, nama) => `${String(url ?? '').trim().replace(/\/+$/, '')}/rest/v1/rpc/${nama}`;

export async function panggilRpcPublik(nama, args = {}, { batasMs = 8000, ambil = globalThis.fetch } = {}) {
  try {
    if (LOKAL) {
      const { ambilKlien } = await import('./supabaseClient');
      const { klien } = await ambilKlien();
      const { data, error } = await klien.rpc(nama, args);
      return error ? { ok: false, pesan: String(error.message ?? error) } : { ok: true, data };
    }
    const url = import.meta.env?.VITE_SUPABASE_URL;
    const kunci = import.meta.env?.VITE_SUPABASE_ANON_KEY;
    if (!url || !kunci) return { ok: false, pesan: 'Sambungan ke server belum diatur.' };
    const pengendali = typeof AbortController === 'function' ? new AbortController() : null;
    const waktu = pengendali ? setTimeout(() => pengendali.abort(), batasMs) : null;
    try {
      const r = await ambil(alamatRpc(url, nama), {
        method: 'POST',
        headers: { apikey: kunci, Authorization: `Bearer ${kunci}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        signal: pengendali?.signal,
      });
      if (!r.ok) return { ok: false, pesan: `Server menjawab ${r.status}.` };
      return { ok: true, data: await r.json() };
    } finally {
      if (waktu) clearTimeout(waktu);
    }
  } catch (e) {
    return { ok: false, pesan: String(e?.message ?? e) };
  }
}
