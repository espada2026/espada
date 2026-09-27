// Fase 0b: klien basis data ringan (src/lib/klienRingan.js) menggantikan supabase-js. Diuji terhadap fetch palsu: alamat, header, sesi, dan
// bahwa bentuknya cocok dengan yang dipakai src/lib/api.js (from/rpc/functions.invoke/auth.getSession,setSession,signOut).
import { readFileSync } from 'node:fs';
import { alamatProyek, buatKlienRingan, kunciSesi } from '../src/lib/klienRingan.js';

let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };
const galat = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

const URL_PROYEK = 'https://abcdxyz.supabase.co';
const KUNCI = 'kunci-anon-contoh';

console.log('--- alamat dan kunci sesi ---');
ok(kunciSesi(URL_PROYEK) === 'sb-abcdxyz-auth-token', `kunci sesi sama dengan supabase-js (${kunciSesi(URL_PROYEK)}); pengguna yang sudah masuk tidak keluar sendiri`);
ok(kunciSesi(`${URL_PROYEK}/`) === 'sb-abcdxyz-auth-token', 'garis miring penutup tidak mengubah kunci sesi');
ok(alamatProyek(URL_PROYEK).href === `${URL_PROYEK}/`, 'alamat diberi garis miring penutup');
ok(/required/.test(galat(() => alamatProyek(''))), 'alamat kosong ditolak');
ok(/HTTP or HTTPS/.test(galat(() => alamatProyek('abcdxyz.supabase.co'))), 'alamat tanpa http(s) ditolak');
ok(/supabaseKey is required/.test(galat(() => buatKlienRingan(URL_PROYEK, ''))), 'kunci kosong ditolak');

console.log('--- permintaan ---');
const catatan = [];
const jwt = (kadaluarsaDetik) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: 'u-1', aud: 'authenticated', role: 'authenticated', exp: kadaluarsaDetik })}.${b('tanda-contoh-panjang')}`;
};
const TOKEN = jwt(Math.floor(Date.now() / 1000) + 3600);
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const fetchPalsu = async (input, init = {}) => {
  const u = String(input?.url ?? input);
  const h = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
  catatan.push({ url: u, metode: init.method ?? 'GET', apikey: h.get('apikey'), auth: h.get('authorization'), body: init.body, info: h.get('x-client-info') });
  if (u.includes('/auth/v1/user')) return json({ id: 'u-1', aud: 'authenticated', role: 'authenticated', email: null });
  if (u.includes('/auth/v1/logout')) return new Response(null, { status: 204 });
  if (u.includes('/functions/v1/')) return json({ ok: true, dari: 'fungsi' });
  if (u.includes('/rest/v1/rpc/')) return json({ dari: 'rpc' });
  return json([{ id: 1 }]);
};

const klien = buatKlienRingan(URL_PROYEK, KUNCI, { auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }, fetch: fetchPalsu });
ok(['auth', 'from', 'rpc', 'functions'].every((k) => k in klien), 'bentuk klien: auth, from, rpc, functions');

{
  const s = await klien.auth.getSession();
  ok(s.data?.session === null, 'belum masuk: getSession tanpa sesi');
  const r = await klien.rpc('sg_contoh', { p_a: 1 });
  const c = catatan.at(-1);
  ok(!r.error && r.data?.dari === 'rpc', 'rpc mengembalikan { data, error } seperti supabase-js');
  ok(c.url === `${URL_PROYEK}/rest/v1/rpc/sg_contoh` && c.metode === 'POST', `rpc: POST ${c.url}`);
  ok(c.apikey === KUNCI && c.auth === `Bearer ${KUNCI}`, 'belum masuk: apikey dan Authorization memakai kunci anon');
  ok(JSON.parse(c.body).p_a === 1, 'argumen rpc dikirim sebagai JSON');
  ok(c.info === 'sigarda-klien-ringan', 'header X-Client-Info dikirim (nama header sama dengan yang diizinkan CORS)');
}
{
  const r = await klien.from('profiles').select('*').eq('id', 1).order('id').range(0, 9);
  const c = catatan.at(-1);
  ok(!r.error && r.data?.[0]?.id === 1, 'from().select().eq().order().range() mengembalikan { data, error }');
  ok(c.url.startsWith(`${URL_PROYEK}/rest/v1/profiles?`) && c.url.includes('select=*') && c.url.includes('id=eq.1') && c.url.includes('order=id.asc'), `from: ${c.url}`);
}

console.log('--- sesi ---');
{
  const r = await klien.auth.setSession({ access_token: TOKEN, refresh_token: 'segar-contoh' });
  ok(!r.error && r.data?.session?.access_token === TOKEN, 'setSession menerima sesi dari Edge Function (bentuk yang dipakai api.js: masuk)');
  const s = await klien.auth.getSession();
  ok(s.data?.session?.user?.id === 'u-1', 'getSession mengembalikan pengguna sesudah setSession (api.js: sesiSaatIni)');
  await klien.rpc('sg_contoh', {});
  let c = catatan.at(-1);
  ok(c.auth === `Bearer ${TOKEN}` && c.apikey === KUNCI, 'sesudah masuk: rpc membawa token sesi (bukan kunci anon)');
  await klien.from('profiles').select('*');
  c = catatan.at(-1);
  ok(c.auth === `Bearer ${TOKEN}`, 'sesudah masuk: pembacaan tabel membawa token sesi');
  const f = await klien.functions.invoke('sigarda', { body: { aksi: 'contoh', x: 1 } });
  c = catatan.at(-1);
  ok(!f.error && f.data?.dari === 'fungsi', 'functions.invoke mengembalikan { data, error } (api.js: edge)');
  ok(c.url === `${URL_PROYEK}/functions/v1/sigarda` && c.metode === 'POST', `functions.invoke: POST ${c.url}`);
  ok(c.auth === `Bearer ${TOKEN}` && c.apikey === KUNCI, 'functions.invoke membawa token sesi dan apikey');
  ok(JSON.parse(c.body).aksi === 'contoh', 'isi body fungsi dikirim sebagai JSON');
  await klien.auth.signOut();
  const s2 = await klien.auth.getSession();
  ok(s2.data?.session === null, 'signOut menghapus sesi (api.js: keluar)');
  await klien.rpc('sg_contoh', {});
  ok(catatan.at(-1).auth === `Bearer ${KUNCI}`, 'sesudah keluar: kembali memakai kunci anon');
}

console.log('--- api.js tidak memakai fitur di luar klien ringan ---');
{
  // api.js dan halaman hanya boleh memakai bagian klien yang tersedia; realtime/storage tidak ada di klien ringan.
  const pola = /klien\.(?:realtime|storage|channel|removeChannel|schema)\b|\.storage\.from\(/;
  const berkas = ['src/lib/api.js', 'src/context/AppContext.jsx', 'src/lib/supabaseClient.js'];
  ok(berkas.every((b) => !pola.test(readFileSync(`${process.cwd()}/${b}`, 'utf8'))), 'tidak ada pemakaian realtime/storage di api.js, AppContext, supabaseClient');
  const sup = readFileSync(`${process.cwd()}/src/lib/supabaseClient.js`, 'utf8');
  ok(!/from '@supabase\/supabase-js'/.test(sup) && /buatKlienRingan/.test(sup), 'supabaseClient.js memakai klien ringan, bukan supabase-js');
}

console.log(`\nRINGKASAN KLIEN-RINGAN: ${lulus} lulus, ${gagal} GAGAL.`);
process.exit(gagal ? 1 : 0);
