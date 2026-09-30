// Inti penerapan otomatis migrasi dan pemeriksaan pemasangan (pustaka yang dapat diuji; pintu masuknya jalankan.mjs, dipanggil GitHub Actions:
// .github/workflows/deploy.yml [migrasi sebelum situs terbit], migrasi-manual.yml, dan periksa-pemasangan.yml; panduan pemilik: docs/penerapan-otomatis.md).
//
// Migrasi TIDAK lagi ditempel di SQL Editor: skrip ini menjalankan migrasi yang BELUM tercatat, sesuai urutan README (bagian "Memperbarui database yang sudah
// berjalan"), satu per satu, dan mencatatnya di tabel sigarda.migrasi_terapan. Migrasi sudah dibungkus begin/commit dan idempoten, jadi yang gagal tidak
// meninggalkan setengah jadi. Repositori PUBLIK: log hanya memuat NAMA migrasi/objek, kode galat, dan pesan pendek; tidak pernah isi SQL, data, atau alamat sambungan.
//
// `db` = adapter { exec(sql): menjalankan SQL banyak pernyataan, rows(sql, params): baris hasil satu pernyataan } (pg.Client di produksi, PGlite di uji).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { urutanMigrasiReadme } from '../catatan-rilis-lib.mjs';

export const TABEL_PELACAK = 'sigarda.migrasi_terapan';
const BATAS_BARIS_LOG = 60;

/** Adapter untuk pg.Client (pemakaian produksi). */
export const adapterPg = (client) => ({
  exec: async (sql) => { await client.query(sql); },
  rows: async (sql, params) => (await client.query(sql, params)).rows,
});

/** Galat pendek yang aman dicetak di log publik: kode SQLSTATE dan baris pertama pesan (tanpa DETAIL yang dapat memuat nilai data). */
export function ringkasGalat(e) {
  const pesan = String((e && e.message) || e).split('\n')[0].slice(0, 200);
  return `${e && e.code ? `[${e.code}] ` : ''}${pesan}`;
}

/** Membaca urutan migrasi dari README dan isi berkasnya: [{ nama, sql }]. Melempar bila README menyebut berkas yang tidak ada, atau ada berkas yang tidak terdaftar. */
export function bacaMigrasi(akar) {
  const urutan = urutanMigrasiReadme(readFileSync(path.join(akar, 'README.md'), 'utf8'));
  const folder = path.join(akar, 'supabase/migrasi');
  const ganda = urutan.filter((n, i) => urutan.indexOf(n) !== i);
  if (ganda.length) throw new Error(`README mendaftarkan migrasi ganda: ${[...new Set(ganda)].join(', ')}.`);
  const hilang = urutan.filter((n) => !existsSync(path.join(folder, `${n}.sql`)));
  if (hilang.length) throw new Error(`README menyebut migrasi yang berkasnya tidak ada: ${hilang.join(', ')}.`);
  const tanpaReadme = readdirSync(folder).filter((f) => f.endsWith('.sql')).map((f) => f.slice(0, -4)).filter((n) => !urutan.includes(n));
  if (tanpaReadme.length) throw new Error(`Migrasi belum didaftarkan di README (urutan menjalankan tidak diketahui): ${tanpaReadme.join(', ')}.`);
  return urutan.map((nama) => ({ nama, sql: readFileSync(path.join(folder, `${nama}.sql`), 'utf8').replace(/^﻿/, '') }));
}

/**
 * Menimbang rencana dari urutan README dan yang sudah tercatat (murni).
 * @returns {{ tertunda: string[], asing: string[], galat: string | null }}
 *   asing = tercatat tetapi tidak ada di README (peringatan); galat = alasan menolak (pelacak kosong, atau ada yang tertunda SEBELUM yang sudah tercatat).
 */
export function timbangRencana(urutan, tercatat) {
  const ada = new Set(tercatat);
  const tertunda = urutan.filter((n) => !ada.has(n));
  const asing = [...ada].filter((n) => !urutan.includes(n)).sort();
  if (!ada.size) return { tertunda, asing, galat: 'Pelacak masih kosong. Jalankan dulu aksi "tandai" (migrasi yang sudah berjalan ditandai, bukan dijalankan ulang) sesudah memastikan pemeriksaan pemasangan bersih.' };
  const terakhirTercatat = Math.max(...urutan.map((n, i) => (ada.has(n) ? i : -1)));
  const terlewat = tertunda.filter((n) => urutan.indexOf(n) < terakhirTercatat);
  if (terlewat.length) return { tertunda, asing, galat: `Urutan tidak konsisten: ${terlewat.join(', ')} belum tercatat padahal migrasi sesudahnya sudah. Periksa manual (jangan diulang otomatis: sebagian migrasi menimpa fungsi yang sama).` };
  return { tertunda, asing, galat: null };
}

/** Membuat pelacak bila belum ada (tanpa hak untuk anon/authenticated; tabel ini bukan bagian skema aplikasi). */
export async function pastikanPelacak(db) {
  await db.exec(`
    create table if not exists ${TABEL_PELACAK} (
      nama text primary key,
      diterapkan_pada timestamptz not null default now(),
      cara text not null check (cara in ('dijalankan', 'ditandai'))
    );
    alter table ${TABEL_PELACAK} enable row level security;
    revoke all on ${TABEL_PELACAK} from public, anon, authenticated;
  `);
}

const bacaTercatat = async (db) => (await db.rows(`select nama from ${TABEL_PELACAK}`)).map((r) => r.nama);

/**
 * Menjalankan pemeriksaan pemasangan (supabase/demo/periksa_pemasangan.sql, hanya membaca).
 * @returns {{ masalah: {kategori, objek, status}[], ringkasan: string[], peringatan: {kategori, objek, status}[] }}
 *   masalah = baris KURANG/BEDA (urut 1); peringatan = lingkungan yang perlu perhatian (tidak menggagalkan).
 */
export async function jalankanPeriksa({ db, sql, log = console.log }) {
  let baris;
  try {
    baris = await db.rows(sql);
  } catch (e) {
    if (e && e.code === '42501') throw new Error(`Peran sambungan tidak boleh membaca sebagian yang diperiksa (${ringkasGalat(e)}). Beri hak baca pada jadwal pg_cron sesuai docs/penerapan-otomatis.md, bagian "Bila pemeriksaan berkata permission denied".`);
    throw e;
  }
  const masalah = baris.filter((r) => Number(r.urut) === 1).map(({ kategori, objek, status }) => ({ kategori, objek, status }));
  const ringkasan = baris.filter((r) => Number(r.urut) === 0).map((r) => `${r.objek} [${r.status}]`);
  const peringatan = baris.filter((r) => Number(r.urut) === 2 && r.status !== 'OK').map(({ kategori, objek, status }) => ({ kategori, objek, status }));
  log('Ringkasan pemeriksaan pemasangan:');
  for (const r of ringkasan) log(`  ${r}`);
  for (const m of masalah.slice(0, BATAS_BARIS_LOG)) log(`  MASALAH ${m.kategori}: ${m.objek} -> ${m.status}`);
  if (masalah.length > BATAS_BARIS_LOG) log(`  ... dan ${masalah.length - BATAS_BARIS_LOG} masalah lain`);
  for (const p of peringatan) log(`  perhatian ${p.kategori}: ${p.objek} -> ${p.status.slice(0, 120)}`);
  return { masalah, ringkasan, peringatan };
}

/**
 * Menandai SEMUA migrasi README sebagai sudah diterapkan (tanpa menjalankannya), hanya bila pelacak masih kosong dan pemeriksaan pemasangan bersih.
 * Dipakai sekali saat pertama kali memasang otomatisasi pada database yang migrasinya sudah dijalankan manual.
 */
export async function tandaiSemua({ db, migrasi, sqlPeriksa, log = console.log }) {
  await pastikanPelacak(db);
  const tercatat = await bacaTercatat(db);
  if (tercatat.length) throw new Error(`Pelacak sudah berisi ${tercatat.length} migrasi; penandaan awal hanya untuk pelacak kosong.`);
  log('Memeriksa pemasangan sebelum menandai...');
  const { masalah } = await jalankanPeriksa({ db, sql: sqlPeriksa, log });
  if (masalah.length) throw new Error(`Pemeriksaan pemasangan menemukan ${masalah.length} masalah: migrasi belum semuanya terpasang. Jalankan migrasi yang kurang secara manual dulu, ulangi pemeriksaan sampai bersih, baru tandai.`);
  for (const m of migrasi) await db.rows(`insert into ${TABEL_PELACAK} (nama, cara) values ($1, 'ditandai') on conflict do nothing`, [m.nama]);
  log(`Ditandai sudah diterapkan: ${migrasi.length} migrasi (sampai ${migrasi[migrasi.length - 1].nama}).`);
  return { ditandai: migrasi.length };
}

/**
 * Menjalankan migrasi yang belum tercatat, berurutan; berhenti pada yang pertama gagal (yang gagal dibatalkan dan tidak dicatat).
 * @returns {{ diterapkan: string[] }}
 */
export async function terapkanTertunda({ db, migrasi, log = console.log }) {
  await pastikanPelacak(db);
  const urutan = migrasi.map((m) => m.nama);
  const { tertunda, asing, galat } = timbangRencana(urutan, await bacaTercatat(db));
  if (asing.length) log(`Perhatian: tercatat tetapi tidak ada di README: ${asing.join(', ')}.`);
  if (galat) throw new Error(galat);
  if (!tertunda.length) { log('Tidak ada migrasi tertunda; basis data sudah mengikuti README.'); return { diterapkan: [] }; }
  log(`Migrasi tertunda (${tertunda.length}): ${tertunda.join(', ')}`);
  const diterapkan = [];
  for (const nama of tertunda) {
    const { sql } = migrasi.find((m) => m.nama === nama);
    log(`Menjalankan ${nama}...`);
    try {
      await db.exec(sql);
    } catch (e) {
      await db.exec('rollback').catch(() => {});
      throw new Error(`Migrasi ${nama} GAGAL dan dibatalkan (${ringkasGalat(e)}). ${diterapkan.length ? `Sudah berhasil sebelumnya: ${diterapkan.join(', ')}. ` : ''}Migrasi sesudahnya tidak dijalankan.`);
    }
    await db.rows(`insert into ${TABEL_PELACAK} (nama, cara) values ($1, 'dijalankan') on conflict do nothing`, [nama]);
    diterapkan.push(nama);
    log(`  selesai: ${nama}`);
  }
  return { diterapkan };
}
