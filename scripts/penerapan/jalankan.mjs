// Pintu masuk penerapan otomatis (dipanggil GitHub Actions). Pemakaian:
//   node scripts/penerapan/jalankan.mjs periksa   [--lewati-bila-kosong]   memakai SIGARDA_DB_URL (peran baca-saja cukup)
//   node scripts/penerapan/jalankan.mjs terapkan  [--lewati-bila-kosong]   memakai SIGARDA_DB_URL_TULIS (hak penuh; hanya di lingkungan "produksi")
//   node scripts/penerapan/jalankan.mjs tandai                             memakai SIGARDA_DB_URL_TULIS (sekali, saat pemasangan)
// Inti dan aturannya ada di penerapan.mjs; panduan pemilik di docs/penerapan-otomatis.md. Log tidak pernah memuat alamat sambungan atau isi SQL.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adapterPg, bacaMigrasi, jalankanPeriksa, tandaiSemua, terapkanTertunda } from './penerapan.mjs';

const akar = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [aksi, ...opsi] = process.argv.slice(2);
const lewatiBilaKosong = opsi.includes('--lewati-bila-kosong');
const NAMA_RAHASIA = { periksa: 'SIGARDA_DB_URL', terapkan: 'SIGARDA_DB_URL_TULIS', tandai: 'SIGARDA_DB_URL_TULIS' };

async function sambung(url) {
  // pg hanya terpasang di scripts/cadangan (`npm ci --prefix scripts/cadangan`), tidak di akar dan tidak di scripts/penerapan: cari dari sana.
  let pg;
  try {
    pg = createRequire(path.join(akar, 'scripts/cadangan/package.json'))('pg');
  } catch {
    throw new Error('Paket pg belum terpasang. Jalankan: npm ci --prefix scripts/cadangan');
  }
  const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000, statement_timeout: 300000 });
  try {
    await db.connect();
  } catch (e) {
    // Pesan galat pg dapat memuat alamat server; log publik hanya mendapat penyebab umum.
    const p = String(e.message || e);
    if (/password authentication|authentication failed/i.test(p)) throw new Error('Sandi atau nama peran database salah (periksa rahasia sambungan).');
    if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN/i.test(p)) throw new Error('Tidak dapat menjangkau database; pastikan memakai alamat Session pooler.');
    throw new Error('Gagal menyambung ke database.');
  }
  return db;
}

async function utama() {
  const nama = NAMA_RAHASIA[aksi];
  if (!nama) throw new Error('Aksi tidak dikenal. Gunakan: periksa | terapkan | tandai.');
  const url = process.env[nama];
  if (!url) {
    if (lewatiBilaKosong) { console.log(`::notice::Rahasia ${nama} belum diisi: langkah "${aksi}" dilewati (penerapan otomatis belum dipasang; lihat docs/penerapan-otomatis.md).`); return; }
    throw new Error(`Rahasia ${nama} belum diisi di GitHub (lihat docs/penerapan-otomatis.md).`);
  }
  const sqlPeriksa = readFileSync(path.join(akar, 'supabase/demo/periksa_pemasangan.sql'), 'utf8').replace(/^﻿/, '');
  const client = await sambung(url);
  const db = adapterPg(client);
  let kunci = false;
  try {
    if (aksi !== 'periksa') {
      // Satu penerap dalam satu waktu (dua alur bersamaan tidak boleh menjalankan migrasi yang sama).
      const [{ ok }] = await db.rows('select pg_try_advisory_lock(727101) as ok');
      if (!ok) throw new Error('Penerapan lain sedang berjalan; coba lagi sesudah selesai.');
      kunci = true;
    }
    if (aksi === 'periksa') {
      const { masalah } = await jalankanPeriksa({ db, sql: sqlPeriksa });
      if (masalah.length) throw new Error(`Pemeriksaan pemasangan menemukan ${masalah.length} masalah (KURANG/BEDA): daftar di atas.`);
      console.log('Pemasangan sesuai dengan kode terbaru.');
    } else if (aksi === 'tandai') {
      await tandaiSemua({ db, migrasi: bacaMigrasi(akar), sqlPeriksa });
    } else {
      const { diterapkan } = await terapkanTertunda({ db, migrasi: bacaMigrasi(akar) });
      if (diterapkan.length) {
        // Pemeriksaan setelahnya hanya memberi peringatan: penyimpangan lama yang tak terkait migrasi ini tidak boleh menahan penerbitan situs (pemeriksaan harian yang membuka issue).
        console.log('Pemeriksaan sesudah penerapan:');
        const { masalah } = await jalankanPeriksa({ db, sql: sqlPeriksa });
        if (masalah.length) console.log(`::warning::Sesudah penerapan masih ada ${masalah.length} ketidaksesuaian pemasangan (lihat log).`);
      }
    }
  } finally {
    if (kunci) await db.rows('select pg_advisory_unlock(727101)').catch(() => {});
    await client.end().catch(() => {});
  }
}

utama()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(`GAGAL: ${e && e.message ? e.message : e}`);
    process.exit(1);
  });
