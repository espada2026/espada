/**
 * Klien basis data RINGAN: menggantikan `createClient` dari @supabase/supabase-js untuk build terbit.
 *
 * Paket supabase-js menyertakan klien realtime (WebSocket) dan penyimpanan berkas yang tidak dipakai aplikasi ini (kira-kira sepertiga
 * dari seluruh Supabase di JS awal). Aplikasi hanya membutuhkan lima hal: `auth` (getSession, setSession, signOut), `from`, `rpc`, dan
 * `functions.invoke`. Di sini keempatnya dirangkai langsung dari paket kecil yang sama (auth-js, postgrest-js, functions-js), dengan
 * perilaku yang sama seperti SupabaseClient:
 *  - kunci penyimpanan sesi `sb-<subdomain>-auth-token` (SAMA dengan supabase-js, sehingga pengguna yang sudah masuk tidak keluar sendiri);
 *  - setiap permintaan REST dan fungsi membawa `apikey` dan `Authorization: Bearer <token sesi>` (kunci anon bila belum masuk).
 * Bentuk yang dikembalikan sama dengan yang dipakai src/lib/api.js dan src/lokal/klienFake.js.
 */
import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import { FunctionsClient } from '@supabase/functions-js';

const INFO_KLIEN = { 'X-Client-Info': 'sigarda-klien-ringan' };

/** Alamat proyek dengan garis miring penutup (supaya alamat turunan tersusun benar); galat bila bukan alamat http(s). */
export function alamatProyek(url) {
  const teks = String(url ?? '').trim();
  if (!teks) throw new Error('supabaseUrl is required.');
  if (!/^https?:\/\//i.test(teks)) throw new Error('Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.');
  try {
    return new URL(teks.endsWith('/') ? teks : `${teks}/`);
  } catch {
    throw new Error('Invalid supabaseUrl: Provided URL is malformed.');
  }
}

/** Kunci penyimpanan sesi bawaan supabase-js: `sb-<bagian pertama nama host>-auth-token`. */
export const kunciSesi = (url) => `sb-${alamatProyek(url).hostname.split('.')[0]}-auth-token`;

export function buatKlienRingan(url, kunci, { auth: opsiAuth = {}, fetch: fetchDasar } = {}) {
  const dasar = alamatProyek(url);
  if (!kunci) throw new Error('supabaseKey is required.');
  const ambil = (...arg) => (fetchDasar ?? fetch)(...arg);

  const auth = new AuthClient({
    url: new URL('auth/v1', dasar).href,
    headers: { Authorization: `Bearer ${kunci}`, apikey: kunci, ...INFO_KLIEN },
    storageKey: kunciSesi(url),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
    fetch: fetchDasar, // undefined pada penggunaan biasa (auth-js memakai fetch global); diisi hanya oleh pengujian
    ...opsiAuth,
  });

  // Token sesi bila sudah masuk, kunci anon bila belum.
  const tokenAkses = async () => (await auth.getSession()).data?.session?.access_token ?? kunci;
  const ambilDenganAuth = async (input, init) => {
    const token = await tokenAkses();
    const headers = new Headers(init?.headers);
    if (!headers.has('apikey')) headers.set('apikey', kunci);
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    return ambil(input, { ...init, headers });
  };

  const rest = new PostgrestClient(new URL('rest/v1', dasar).href, { headers: INFO_KLIEN, schema: 'public', fetch: ambilDenganAuth });
  const functions = new FunctionsClient(new URL('functions/v1', dasar).href, { headers: INFO_KLIEN, customFetch: ambilDenganAuth });

  return {
    auth,
    functions,
    from: (relasi) => rest.from(relasi),
    rpc: (nama, args = {}, opsi = {}) => rest.rpc(nama, args, opsi),
  };
}
