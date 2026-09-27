/**
 * Membaca hasil build untuk model profil muat (scripts/profil/model.mjs). Murni, tanpa akses berkas, supaya dapat diuji (uji/profil-muat.mjs).
 */

/**
 * Berkas yang dimuat index.html saat kunjungan pertama: skrip modul, modulepreload (potongan yang diimpor langsung oleh berkas awal), dan
 * stylesheet. Hanya berkas di folder assets; alamat dikembalikan relatif terhadap folder build (mis. "assets/index-abc.js").
 * Dibaca dari index.html, BUKAN dari nama berkas: potongan malas yang kebetulan bernama "index-*" tidak ikut terhitung.
 */
export function berkasAwalDariHtml(html, base = '/') {
  const hasil = { js: [], css: [] };
  for (const m of html.matchAll(/<(script|link)\b[^>]*>/g)) {
    const tag = m[0];
    const alamat = /(?:src|href)="([^"]+)"/.exec(tag)?.[1];
    if (!alamat) continue;
    const jalur = alamat.startsWith(base) ? alamat.slice(base.length) : alamat.replace(/^\//, '');
    if (!jalur.startsWith('assets/')) continue;
    const masuk = tag.startsWith('<script') || /rel="modulepreload"/.test(tag);
    if (masuk && jalur.endsWith('.js') && !hasil.js.includes(jalur)) hasil.js.push(jalur);
    else if (/rel="stylesheet"/.test(tag) && jalur.endsWith('.css') && !hasil.css.includes(jalur)) hasil.css.push(jalur);
  }
  return hasil;
}

/**
 * Apakah kode hasil build memuat klien basis data produksi (alamat REST dan Auth Supabase)? Bila tidak, build itu bukan build produksi
 * (variabel VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY kosong, atau VITE_BACKEND=lokal, membuang klien Supabase) dan ukuran JS awalnya tidak boleh dipakai sebagai ukuran terbit.
 */
export function memuatKlienProduksi(kode) {
  return kode.includes('rest/v1') && kode.includes('auth/v1') && kode.includes('functions/v1');
}
