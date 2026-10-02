// Menerapkan PETA (istilah-siaga-peta.mjs) pada supabase/sumber/*.sql (baris bukan komentar). Dijalankan SEKALI saat menyusun migrasi 2026-10-istilah-siaga;
// aman diulang (tidak ada lagi yang diganti). Mencetak jumlah pemakaian tiap pasangan dan fungsi yang berubah.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PETA } from './istilah-siaga-peta.mjs';

const pakai = new Map(PETA.map(([d]) => [d, 0]));
for (const f of readdirSync('supabase/sumber').filter((n) => n.endsWith('.sql'))) {
  const asal = readFileSync(`supabase/sumber/${f}`, 'utf8');
  const baris = asal.split('\n').map((b) => {
    if (/^\s*--/.test(b)) return b;
    for (const [dari, ke] of PETA) {
      const n = b.split(dari).length - 1;
      if (n) { pakai.set(dari, pakai.get(dari) + n); b = b.split(dari).join(ke); }
    }
    return b;
  });
  const baru = baris.join('\n');
  if (baru !== asal) { writeFileSync(`supabase/sumber/${f}`, baru); console.log('diubah', f); }
}
for (const [d, n] of pakai) if (n === 0) console.log('TIDAK TERPAKAI:', d);
