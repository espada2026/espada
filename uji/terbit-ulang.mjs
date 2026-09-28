// Terbit ulang situs saat berita terbit (pengganti deploy harian): sigarda.terbit_ulang_atur / _periksa / _catat / _kirim / _matikan, pemicu pada beranda_berita, dan
// sg_terbit_ulang_status / sg_terbit_ulang_minta. PGlite; pg_net dan pg_cron DIPALSUKAN seperti pada uji keep-alive. Yang dijaga: kunci GitHub rahasia (tidak terbaca aplikasi,
// tidak ikut cadangan), permintaan HANYA bila ada berita terbit yang berubah atau jadwalnya tiba, jeda dan batas gagal, serta hak Pembina/Admin untuk tombol dan keadaan.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { siapkanPg, sqlSebagai } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { TABEL_DILEWATI } from '../scripts/cadangan/dump.mjs';

const P = process.cwd().replace(/\\/g, '/');
let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };

const pg = new PGlite();
await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
await isiDataContoh(pg);
await pg.query('update public.profiles set wajib_ganti_pin = false');
const q = async (sql, p = []) => (await pg.query(sql, p)).rows;
const galat = async (sql, p = []) => { try { await pg.query(sql, p); return null; } catch (e) { return e.message; } };
const idDari = async (u) => (await q('select id from public.profiles where username = $1', [u]))[0].id;
const pembina = await idDari('pembina'), admin = await idDari('admin'), dewan = await idDari('dewan'), ahmad = await idDari('10231');
const sebagai = async (id, sql, args = []) => { try { return { ok: true, rows: (await sqlSebagai(pg, id, sql, args)).rows }; } catch (e) { return { ok: false, pesan: e.message }; } };
const konf = async () => (await q('select * from public.terbit_ulang_konfigurasi'))[0];
const TOKEN = 'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ';
const REPO = 'tribudi3267/sigarda';
const tandaiBersih = () => q('update public.terbit_ulang_konfigurasi set perlu = false, perlu_sejak = null');
const simpanBerita = (id, judul, status, terbit = null) => sebagai(id, "select public.sg_berita_simpan(null, 'kegiatan', $1, 'Ringkas', 'Isi lengkap', '', $2, $3::timestamptz) as id", [judul, status, terbit]);

const PALSU_NET = `create schema net;
  create table public.tes_net (id bigserial primary key, url text, headers jsonb, body jsonb, waktu int);
  create table net._http_response (id bigint primary key, status_code int, error_msg text);
  create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 2000)
    returns bigint language plpgsql as $$ declare v bigint; begin insert into public.tes_net (url, headers, body, waktu) values (url, headers, body, timeout_milliseconds) returning id into v; return v; end $$;`;
const PALSU_CRON = `create schema cron;
  create table cron.job (jobid serial, jobname text unique, schedule text, command text, active boolean default true);
  create function cron.schedule(job_name text, schedule text, command text) returns bigint language plpgsql as
    $$ begin insert into cron.job (jobname, schedule, command) values (job_name, schedule, command) on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command; return 1; end $$;
  create function cron.unschedule(job_name text) returns boolean language plpgsql as $$ begin delete from cron.job where jobname = job_name; return true; end $$;`;

console.log('--- Hak akses tabel dan pengaturan ---');
{
  const t = (await q(`select relrowsecurity r, has_table_privilege('authenticated', c.oid, 'select') s, has_table_privilege('anon', c.oid, 'select') a,
    (select count(*) from pg_policies where schemaname = 'public' and tablename = 'terbit_ulang_konfigurasi')::int k from pg_class c where relname = 'terbit_ulang_konfigurasi' and relnamespace = 'public'::regnamespace`))[0];
  ok(t.r && !t.s && !t.a && t.k === 0, 'tabel terbit_ulang_konfigurasi: RLS aktif, tanpa kebijakan, tanpa hak baca untuk authenticated dan anon');
  let r = await sebagai(ahmad, 'select * from public.terbit_ulang_konfigurasi');
  ok(!r.ok && /permission denied/i.test(r.pesan), 'akun aplikasi tidak dapat membaca kunci lewat kueri tabel');
  r = await sebagai(pembina, `select sigarda.terbit_ulang_atur('${REPO}', '${TOKEN}')`);
  ok(!r.ok && /hanya dari SQL Editor/.test(r.pesan), 'pengguna yang sudah login (bahkan Pembina) DITOLAK mengatur terbit ulang');
  r = await sebagai(pembina, 'select sigarda.terbit_ulang_kirim()');
  ok(!r.ok && /hanya dari SQL Editor/.test(r.pesan), 'mengirim manual lewat SQL Editor hanya untuk pemilik');
  r = await sebagai(admin, 'select sigarda.terbit_ulang_matikan()');
  ok(!r.ok && /hanya dari SQL Editor/.test(r.pesan), 'mematikan hanya dari SQL Editor');
  ok((await konf()) === undefined, 'penolakan tidak meninggalkan konfigurasi');
  ok((await q('select sigarda.terbit_ulang_keadaan() k'))[0].k.diatur === false, 'keadaan tanpa konfigurasi: diatur false');
  ok(/belum diatur/i.test((await sebagai(pembina, 'select public.sg_terbit_ulang_minta()')).pesan ?? ''), 'tombol terbit ulang tanpa konfigurasi: pesan yang menuntun (belum diatur pemilik)');
}

console.log('\n--- Validasi masukan ---');
{
  ok(/pemilik\/nama/.test(await galat(`select sigarda.terbit_ulang_atur('tanpa-garis-miring', '${TOKEN}')`) ?? ''), 'repositori tanpa pemilik/nama ditolak');
  ok(/pemilik\/nama/.test(await galat(`select sigarda.terbit_ulang_atur('a/b/c', '${TOKEN}')`) ?? '') && /pemilik\/nama/.test(await galat(`select sigarda.terbit_ulang_atur('a/b;drop', '${TOKEN}')`) ?? ''), 'repositori berlebih atau bermuatan aneh ditolak');
  ok(/Kunci akses GitHub/.test(await galat(`select sigarda.terbit_ulang_atur('${REPO}', 'pendek')`) ?? ''), 'kunci terlalu pendek ditolak');
  ok(/berakhiran \.yml/.test(await galat(`select sigarda.terbit_ulang_atur('${REPO}', '${TOKEN}', '../../x')`) ?? ''), 'nama berkas alur tidak sah ditolak');
  ok(/cabang/i.test(await galat(`select sigarda.terbit_ulang_atur('${REPO}', '${TOKEN}', 'deploy.yml', 'cabang jelek; x')`) ?? ''), 'nama cabang tidak sah ditolak');
  ok((await konf()) === undefined, 'masukan tidak sah tidak tersimpan');
}

console.log('\n--- Tanpa pg_net dan pg_cron: tersimpan dengan catatan, tanpa galat ---');
{
  const h = (await q(`select sigarda.terbit_ulang_atur(' ${REPO} ', ' ${TOKEN} ') h`))[0].h;
  ok(/pg_cron belum aktif/.test(h) && /pg_net belum aktif/.test(h), 'hasil menyebut pg_cron dan pg_net yang belum aktif');
  const k = await konf();
  ok(k.repo === REPO && k.token === TOKEN && k.alur === 'deploy.yml' && k.cabang === 'main', 'nilai dirapikan dan bawaan alur/cabang terisi');
  ok((await q('select sigarda.terbit_ulang_kirim_sekarang() x'))[0].x === null && (await q('select sigarda.terbit_ulang_periksa() x'))[0].x === null, 'kirim dan periksa tanpa pg_net: null, tanpa galat');
  ok(/pg_net belum aktif/.test(await galat('select sigarda.terbit_ulang_kirim()') ?? ''), 'kirim manual tanpa pg_net: pesan yang jelas');
}

console.log('\n--- Dengan pg_net dan pg_cron (palsu) ---');
await pg.exec(PALSU_NET);
await pg.exec(PALSU_CRON);
{
  const h = (await q(`select sigarda.terbit_ulang_atur('${REPO}', '${TOKEN}') h`))[0].h;
  ok(/select sigarda\.terbit_ulang_kirim\(\)/.test(h), 'atur memberi langkah mencoba berikutnya');
  const job = (await q(`select schedule, command from cron.job where jobname = 'sigarda-terbit-ulang'`))[0];
  ok(job?.schedule === '*/5 * * * *' && job.command === 'select sigarda.terbit_ulang_periksa()', 'pekerjaan pg_cron dijadwalkan tiap 5 menit');
  await q(`select sigarda.terbit_ulang_atur('${REPO}', '${TOKEN}')`);
  ok((await q(`select count(*)::int n from cron.job where jobname = 'sigarda-terbit-ulang'`))[0].n === 1, 'mengatur lagi tidak menggandakan jadwal');
  ok((await q('select sigarda.terbit_ulang_periksa() x'))[0].x === null && (await q('select count(*)::int n from public.tes_net'))[0].n === 0, 'tanpa berita dan tanpa perubahan: TIDAK ada permintaan ke GitHub');
}

console.log('\n--- Pemicu: hanya perubahan yang menyentuh berita TERBIT menandai "perlu" ---');
{
  await tandaiBersih();
  await simpanBerita(pembina, 'Masih draf', 'draf');
  ok((await konf()).perlu === false, 'draf baru tidak menandai');
  await tandaiBersih();
  const men = (await simpanBerita(dewan, 'Diajukan Dewan', 'menunggu')).rows[0].id;
  ok((await konf()).perlu === false, 'pengajuan Dewan (menunggu) tidak menandai');
  const tolak = (await simpanBerita(dewan, 'Akan ditolak', 'menunggu')).rows[0].id;
  await tandaiBersih();
  await sebagai(pembina, "select public.sg_berita_tinjau($1, 'ditolak', 'Belum layak tayang')", [tolak]);
  ok((await konf()).perlu === false, 'menolak pengajuan (menunggu -> ditolak) tidak menandai');
  await sebagai(pembina, "select public.sg_berita_tinjau($1, 'terbit', '')", [men]);
  const k1 = await konf();
  ok(k1.perlu === true && k1.perlu_sejak, 'menyetujui pengajuan (menunggu -> terbit) menandai "perlu"');
  await tandaiBersih();
  const baru = (await simpanBerita(pembina, 'Terbit langsung', 'terbit')).rows[0].id;
  ok((await konf()).perlu === true, 'berita baru langsung terbit menandai');
  await tandaiBersih();
  await sebagai(pembina, "select public.sg_berita_simpan($1, 'kegiatan', 'Terbit langsung (revisi)', 'R', 'Isi baru', '', 'terbit', null)", [baru]);
  ok((await konf()).perlu === true, 'mengubah berita yang sudah terbit menandai');
  await tandaiBersih();
  await sebagai(pembina, "select public.sg_berita_simpan($1, 'kegiatan', 'Ditarik jadi draf', 'R', 'Isi', '', 'draf', null)", [baru]);
  ok((await konf()).perlu === true, 'menarik berita terbit menjadi draf menandai (halamannya harus hilang)');
  await tandaiBersih();
  await sebagai(pembina, 'select public.sg_berita_hapus($1)', [baru]);
  ok((await konf()).perlu === false, 'menghapus draf tidak menandai');
  const t2 = (await simpanBerita(pembina, 'Untuk dihapus', 'terbit')).rows[0].id;
  await tandaiBersih();
  await sebagai(pembina, 'select public.sg_berita_hapus($1)', [t2]);
  ok((await konf()).perlu === true, 'menghapus berita terbit menandai');
  await tandaiBersih();
  await simpanBerita(pembina, 'Terjadwal', 'terbit', new Date(Date.now() + 30 * 86400000).toISOString()); // sg_berita_simpan membatasi jadwal paling jauh 366 hari ke depan
  await q('update public.terbit_ulang_konfigurasi set perlu = false, perlu_sejak = null');
  ok((await q("select count(*)::int n from public.beranda_berita where status = 'terbit'"))[0].n >= 2, 'prasyarat: ada berita terbit (satu terjadwal di masa depan)');
}

console.log('\n--- Pengiriman: hanya bila perlu, dengan jeda dan pencatatan jawaban ---');
{
  await q('update public.terbit_ulang_konfigurasi set kirim_terakhir = now(), perlu = false, perlu_sejak = null, gagal_beruntun = 0, status_terakhir = null, kirim_id = null, pesan_terakhir = null');
  await q('delete from public.tes_net');
  ok((await q('select sigarda.terbit_ulang_periksa() x'))[0].x === null, 'tidak perlu dan tidak ada jadwal yang tiba: tidak mengirim');
  await q('update public.terbit_ulang_konfigurasi set perlu = true, perlu_sejak = now()');
  ok((await q('select sigarda.terbit_ulang_periksa() x'))[0].x === null, 'perlu tetapi baru dikirim kurang dari 4 menit lalu: menunggu (jeda)');
  await q(`update public.terbit_ulang_konfigurasi set kirim_terakhir = now() - interval '10 minutes'`);
  const id = (await q('select sigarda.terbit_ulang_periksa() x'))[0].x;
  const t = (await q('select * from public.tes_net'))[0];
  ok(id !== null && t && t.url === `https://api.github.com/repos/${REPO}/actions/workflows/deploy.yml/dispatches` && t.body.ref === 'main', 'permintaan ke API GitHub: alamat alur deploy dan cabang main');
  ok(t.headers.Authorization === `Bearer ${TOKEN}` && t.headers['User-Agent'] === 'sigarda-terbit-ulang' && t.headers.Accept === 'application/vnd.github+json' && t.headers['X-GitHub-Api-Version'] === '2022-11-28', 'header memuat kunci, User-Agent (wajib bagi GitHub), Accept, dan versi API');
  const k = await konf();
  ok(k.perlu === false && k.kirim_id === id && k.status_terakhir === null && /Menunggu jawaban/.test(k.pesan_terakhir) && k.kirim_terakhir, 'setelah dikirim: perlu dihapus, id permintaan dan waktu tercatat');
  await q('update public.terbit_ulang_konfigurasi set perlu = true');
  ok((await q('select sigarda.terbit_ulang_periksa() x'))[0].x === null && (await q('select count(*)::int n from public.tes_net'))[0].n === 1, 'perubahan baru sesudah pengiriman menunggu jeda 4 menit (banyak perubahan menjadi satu deploy)');

  await q('insert into net._http_response (id, status_code, error_msg) values ($1, 204, null)', [id]);
  await q('select sigarda.terbit_ulang_catat()');
  const s = await konf();
  ok(s.status_terakhir === 204 && s.kirim_id === null && s.gagal_beruntun === 0 && /Deploy diminta ke GitHub/.test(s.pesan_terakhir), 'jawaban 204 dicatat sebagai sukses');
  ok(s.perlu === true, 'perubahan yang masuk selagi menunggu jawaban tetap tertandai (tidak hilang)');
}

console.log('\n--- Kegagalan: pesan menuntun, dicoba lagi, lalu berhenti setelah 3 kali ---');
{
  const kirimDanJawab = async (kode, galatTeks = null) => {
    await q(`update public.terbit_ulang_konfigurasi set kirim_terakhir = now() - interval '10 minutes', perlu = true, perlu_sejak = now()`);
    const id = (await q('select sigarda.terbit_ulang_periksa() x'))[0].x;
    if (id !== null) await q('insert into net._http_response (id, status_code, error_msg) values ($1, $2, $3)', [id, kode, galatTeks]);
    await q('select sigarda.terbit_ulang_catat()');
    return { id, k: await konf() };
  };
  await q('update public.terbit_ulang_konfigurasi set gagal_beruntun = 0, kirim_id = null');
  let r = await kirimDanJawab(401);
  ok(r.id !== null && r.k.status_terakhir === 401 && /kedaluwarsa/.test(r.k.pesan_terakhir) && r.k.perlu === true && r.k.gagal_beruntun === 1, '401: pesan menyebut kunci kedaluwarsa, perubahan tertandai lagi untuk dicoba ulang');
  r = await kirimDanJawab(403);
  ok(/izin Actions/.test(r.k.pesan_terakhir) && r.k.gagal_beruntun === 2, '403: pesan menyebut izin Actions');
  r = await kirimDanJawab(404);
  ok(/tidak cocok/.test(r.k.pesan_terakhir) && r.k.gagal_beruntun === 3, '404: pesan menyebut repositori/alur/kunci tidak cocok');
  await q('delete from public.tes_net');
  await q(`update public.terbit_ulang_konfigurasi set kirim_terakhir = now() - interval '10 minutes', perlu = true`);
  ok((await q('select sigarda.terbit_ulang_periksa() x'))[0].x === null && (await q('select count(*)::int n from public.tes_net'))[0].n === 0, 'sesudah 3 kegagalan beruntun: BERHENTI mencoba (kunci salah tidak boleh membanjiri GitHub)');
  const kd = (await q('select sigarda.terbit_ulang_keadaan() k'))[0].k;
  ok(kd.menyerah === true && kd.gagalBeruntun === 3 && kd.status === 404 && !/token|github_pat|tribudi3267/.test(JSON.stringify(kd)), 'keadaan: menyerah true, tanpa kunci maupun repositori');
  await simpanBerita(pembina, 'Berita sesudah menyerah', 'terbit');
  ok((await konf()).gagal_beruntun === 0, 'berita baru diterbitkan: hitungan gagal dihapus (dicoba lagi)');
  await q(`update public.terbit_ulang_konfigurasi set kirim_terakhir = now() - interval '10 minutes'`);
  ok((await q('select sigarda.terbit_ulang_periksa() x'))[0].x !== null, 'dan permintaan dikirim lagi');
  r = await kirimDanJawab(422);
  ok(/workflow_dispatch/.test(r.k.pesan_terakhir), '422: pesan menyebut cabang/alur/workflow_dispatch');
  await q('update public.terbit_ulang_konfigurasi set gagal_beruntun = 0');
  r = await kirimDanJawab(0, 'Timeout was reached');
  ok(r.k.pesan_terakhir === 'Timeout was reached' && r.k.perlu === true, 'galat jaringan dari pg_net dicatat apa adanya dan dicoba lagi');
  await q('update public.terbit_ulang_konfigurasi set gagal_beruntun = 0, perlu = false, perlu_sejak = null, kirim_id = null');
}

console.log('\n--- Berita terjadwal: waktunya tiba tanpa perubahan apa pun ---');
{
  await q('delete from public.beranda_berita');
  await q('alter table public.beranda_berita disable trigger terbit_ulang_berita');
  await q(`insert into public.beranda_berita (kategori, judul, isi, status, terbit_pada) values ('kegiatan', 'Terjadwal', 'Isi', 'terbit', now() + interval '1 hour')`);
  await q(`update public.terbit_ulang_konfigurasi set kirim_terakhir = now() - interval '30 minutes', perlu = false, perlu_sejak = null`);
  await q('delete from public.tes_net');
  ok((await q('select sigarda.terbit_ulang_periksa() x'))[0].x === null, 'berita terjadwal yang belum waktunya: tidak mengirim');
  await q(`update public.beranda_berita set terbit_pada = now() - interval '1 minute'`);
  ok((await q('select sigarda.terbit_ulang_periksa() x'))[0].x !== null, 'waktu terbit tiba sejak permintaan terakhir: dikirim (tanpa penanda perlu dari pemicu)');
  await q('alter table public.beranda_berita enable trigger terbit_ulang_berita');
  await q(`update public.beranda_berita set terbit_pada = now() - interval '20 minutes'`);
  await q(`update public.terbit_ulang_konfigurasi set kirim_terakhir = now() - interval '10 minutes', perlu = false, perlu_sejak = null`);
  ok((await q('select sigarda.terbit_ulang_periksa() x'))[0].x === null, 'berita yang waktu terbitnya sudah lewat SEBELUM permintaan terakhir tidak memicu lagi');
}

console.log('\n--- Tombol dan keadaan di aplikasi (Pembina dan Admin) ---');
{
  await q(`update public.terbit_ulang_konfigurasi set kirim_terakhir = now() - interval '10 minutes', gagal_beruntun = 2, kirim_id = null, perlu = false`);
  await q('delete from public.tes_net');
  ok(/Hanya Pembina dan Admin/.test((await sebagai(dewan, 'select public.sg_terbit_ulang_status()')).pesan ?? '') && /Hanya Pembina dan Admin/.test((await sebagai(dewan, 'select public.sg_terbit_ulang_minta()')).pesan ?? ''), 'Dewan Ambalan (pengurus, bukan Pembina/Admin) ditolak melihat keadaan dan meminta terbit ulang');
  ok(/Hanya Pembina dan Admin/.test((await sebagai(ahmad, 'select public.sg_terbit_ulang_status()')).pesan ?? '') && /Hanya Pembina dan Admin/.test((await sebagai(ahmad, 'select public.sg_terbit_ulang_minta()')).pesan ?? ''), 'Penegak biasa ditolak');
  const st = await sebagai(admin, 'select public.sg_terbit_ulang_status() k');
  ok(st.ok && st.rows[0].k.diatur === true && !/token|github_pat|tribudi3267/.test(JSON.stringify(st.rows[0].k)), 'Admin melihat keadaan tanpa kunci dan repositori');
  const mi = await sebagai(pembina, 'select public.sg_terbit_ulang_minta() k');
  ok(mi.ok && (await q('select count(*)::int n from public.tes_net'))[0].n === 1 && mi.rows[0].k.gagalBeruntun === 0, 'Pembina menekan tombol: permintaan dikirim seketika dan hitungan gagal dihapus');
  const lagi = await sebagai(pembina, 'select public.sg_terbit_ulang_minta() k');
  ok(!lagi.ok && /baru saja dikirim/.test(lagi.pesan) && (await q('select count(*)::int n from public.tes_net'))[0].n === 1, 'menekan lagi dalam 2 menit ditolak (tidak menggandakan deploy)');
}

console.log('\n--- Kunci tidak ikut cadangan, lalu dimatikan ---');
{
  const c = (await sebagai(admin, 'select public.sg_cadangan_admin() d')).rows[0].d;
  ok(!('terbit_ulang_konfigurasi' in c.tabel) && !JSON.stringify(c).includes(TOKEN), 'sg_cadangan_admin tidak memuat tabel maupun kunci');
  ok(TABEL_DILEWATI.has('public.terbit_ulang_konfigurasi') && TABEL_DILEWATI.has('public.login_gagal'), 'cadangan otomatis dan manual melewati tabel kunci (dump.mjs)');
  await q('select sigarda.terbit_ulang_matikan()');
  ok((await konf()) === undefined && (await q(`select count(*)::int n from cron.job where jobname = 'sigarda-terbit-ulang'`))[0].n === 0, 'dimatikan: konfigurasi (termasuk kunci) dan jadwal pg_cron dihapus');
  ok(/Belum diatur/.test(await galat('select sigarda.terbit_ulang_kirim()') ?? ''), 'kirim manual sesudah dimatikan: pesan belum diatur');
  await q('update public.beranda_berita set judul = judul');
  ok((await konf()) === undefined, 'pemicu tanpa konfigurasi tidak melakukan apa pun (tidak galat)');
}

console.log(`\nRINGKASAN TERBIT-ULANG: ${lulus} lulus, ${gagal} GAGAL.`);
if (gagal) process.exit(1);
