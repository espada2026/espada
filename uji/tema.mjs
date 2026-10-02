// Tema tampilan (Siaga atau asli) yang diatur Admin untuk seluruh gudep: server (hak, validasi, tema ikut jawaban publik tanpa login),
// penyimpan tema di perambah, dan kesetaraan variabel CSS antar-tema (kedua tema harus mengisi variabel yang sama).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { siapkanPg, buatKlienFake, sqlSebagai } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';
import { DAFTAR_TEMA, KUNCI_TEMA, TEMA_BAWAAN, pasangTema, temaAktif, temaSah } from '../src/lib/temaStore.js';
import { resetGudep, tambahGudep } from '../src/lib/gudepStore.js';

const P = process.cwd().replace(/\\/g, '/');
let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };
const pg = new PGlite();
await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
await isiDataContoh(pg);
await pg.query('update public.profiles set wajib_ganti_pin = false');
const q = async (sql, p = []) => (await pg.query(sql, p)).rows;
const masuk = async (nama, pin) => { const a = buatApi(buatKlienFake(pg)); await a.masuk(nama, pin); return a; };
const admin = await masuk('admin', PIN_DEMO.admin);
const pembina = await masuk('pembina', PIN_DEMO.pembina);
const ahmad = await masuk('10231', PIN_DEMO.penegak);
const publik = async () => (await sqlSebagai(pg, null, 'select public.sg_gudep_publik() d')).rows[0].d;

console.log('--- Server ---');
ok(!('tema' in (await publik())), 'belum diatur: jawaban publik tanpa kunci tema (aplikasi memakai bawaan)');
for (const [n, a] of [['Pembina', pembina], ['Penegak', ahmad]]) {
  const r = await a.simpanTema('asli');
  ok(!r.ok && /Hanya Admin/.test(r.pesan ?? ''), `${n} tidak dapat mengubah tema`);
}
ok((await sqlSebagai(pg, null, `select public.sg_tema_simpan('asli')`).then(() => false, () => true)), 'tanpa login tidak dapat mengubah tema');
ok((await q(`select count(*)::int n from public.pengaturan where kunci = 'tampilan.tema'`))[0].n === 0, 'yang ditolak tidak menyimpan apa pun');
for (const salah of ['', 'gelap', 'ASLI', null]) {
  const r = await admin.simpanTema(salah);
  ok(!r.ok && /Tema tidak dikenal/.test(r.pesan ?? ''), `tema ${JSON.stringify(salah)} ditolak`);
}
ok((await admin.simpanTema('asli')).ok, 'Admin menyimpan tema asli');
ok((await publik()).tema === 'asli', 'tema ikut jawaban publik tanpa login');
ok((await admin.simpanTema('siaga')).ok && (await publik()).tema === 'siaga', 'Admin mengembalikan ke Siaga');
ok((await admin.simpanTema('asli')).ok && (await q(`select count(*)::int n from public.pengaturan where kunci = 'tampilan.tema'`))[0].n === 1, 'menyimpan ulang memperbarui satu baris pengaturan');
// identitas gudep tetap utuh bersama tema
await admin.simpanGudep({
  nama: 'Gugus Depan Contoh', singkat: 'Perindukan Contoh', sekolah: 'SD Contoh', kota: 'Contoh',
  pembina: { jabatan: 'Pembina Gudep', nama: 'Budi', nta: '', nip: '' }, kamabigus: { jabatan: 'Kepala Sekolah', nama: '', nta: '', nip: '' },
});
{
  const d = await publik();
  ok(d.tema === 'asli' && d.nama === 'Gugus Depan Contoh' && d.kota === 'Contoh', 'jawaban publik memuat identitas dan tema sekaligus');
  ok(!('pembina' in d) && !('nta' in d), 'data pejabat tetap tidak keluar tanpa login');
}
await pg.query(`update public.pengaturan set nilai = '"rusak"'::jsonb where kunci = 'tampilan.tema'`);
ok(!('tema' in (await publik())), 'nilai tersimpan yang tidak dikenal tidak dikeluarkan');

console.log('\n--- Klien: penyimpan tema ---');
ok(DAFTAR_TEMA.map((t) => t.id).join() === 'siaga,asli' && TEMA_BAWAAN === 'siaga', 'daftar tema = siaga, asli; bawaan siaga');
ok(temaSah('siaga') && temaSah('asli') && !temaSah('gelap') && !temaSah(undefined), 'temaSah');
const jawab = {};
const sql = readFileSync(`${P}/supabase/skema.sql`, 'utf8');
ok(DAFTAR_TEMA.every((t) => sql.includes(`'${t.id}'`)) && /not in \('siaga', 'asli'\)/.test(sql), 'daftar tema klien = daftar tema pada fungsi SQL');
// simulasi perambah: dokumen dan penyimpanan palsu
const simpanan = new Map();
globalThis.document = { documentElement: { dataset: {} } };
globalThis.localStorage = { getItem: (k) => simpanan.get(k) ?? null, setItem: (k, v) => simpanan.set(k, v) };
ok(temaAktif() === 'siaga', 'tanpa atribut: tema aktif = siaga');
ok(pasangTema('asli') && document.documentElement.dataset.tema === 'asli' && simpanan.get(KUNCI_TEMA) === 'asli' && temaAktif() === 'asli', 'pasangTema memasang atribut dan mengingat pilihan');
ok(!pasangTema('gelap') && document.documentElement.dataset.tema === 'asli', 'tema tidak dikenal diabaikan');
resetGudep(); tambahGudep({ tema: 'siaga', nama: 'X' });
ok(temaAktif() === 'siaga', 'tambahGudep (jawaban sg_gudep_publik) memasang tema');
tambahGudep({ tema: 'rusak' });
ok(temaAktif() === 'siaga', 'tema rusak dari server tidak mengubah apa pun');
delete globalThis.document; delete globalThis.localStorage;
ok(pasangTema('asli') === true && temaAktif() === 'siaga', 'tanpa perambah (prarender) tidak melempar galat');
void jawab;

console.log('\n--- Berkas: kedua tema memakai variabel yang sama ---');
const css = readFileSync(`${P}/src/index.css`, 'utf8');
const blok = (re) => (css.match(re) ?? [''])[0];
const nama = (b) => [...b.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]).sort().join();
const siaga = blok(/:root \{[\s\S]*?\n\}/), asli = blok(/:root\[data-tema='asli'\] \{[\s\S]*?\n\}/);
ok(siaga.length > 100 && asli.length > 100, 'blok variabel kedua tema ditemukan');
ok(nama(siaga) === nama(asli), 'tema asli mengisi persis variabel yang sama dengan tema Siaga');
const tw = readFileSync(`${P}/tailwind.config.js`, 'utf8');
ok(!/#[0-9a-fA-F]{6}/.test(tw), 'tailwind.config.js tanpa warna tertulis (semua dari variabel CSS)');
const html = readFileSync(`${P}/index.html`, 'utf8');
ok(html.includes(`getItem('${KUNCI_TEMA}')`) && /id="pilih-tema"/.test(html), 'index.html memasang tema tersimpan sebelum halaman tergambar (kunci sama dengan temaStore)');
ok(/Bitter/.test(html) && /Baloo\+2/.test(html), 'index.html memuat font kedua tema');
for (const b of ['src/components/LogoMark.jsx', 'src/landing/ilustrasi.jsx', 'src/landing/bagian.jsx']) {
  ok(!/#[0-9a-fA-F]{6}\b/.test(readFileSync(`${P}/${b}`, 'utf8').replace(/#e2803a/g, '')), `${b}: warna lewat variabel tema, bukan heksadesimal tertulis`);
}

console.log(`\nRINGKASAN tema: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
