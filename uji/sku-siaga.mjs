// Pramuka Siaga, Fase 2: SKU Siaga (Mula, Bantu, Tata). Katalog data (jumlah butir dan sub-butir agama sesuai SK Kwarnas 119/2011), katalog di skema = data aplikasi,
// aturan "tingkat sebelumnya selesai dulu" (cermin klien dibandingkan langsung dengan SQL), pencatatan hasil oleh Pembina lewat jalur yang sama dengan Penegak,
// dan render halaman SKU anak Siaga.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { siapkanPg, buatKlienFake } from '../src/lokal/klienFake.js';
import { isiDataContoh } from '../src/lokal/seedLokal.js';
import { PIN_DEMO } from '../src/lokal/pinDemo.js';
import { buatApi } from '../src/lib/api.js';
import { petaProfil } from '../src/lib/mapDb.js';
import { KonteksApp } from '../src/context/AppContext.jsx';
import SiagaSku, { tingkatSiagaAwal } from '../src/pages/SiagaSku.jsx';
import { DAFTAR_TINGKAT, INDEKS_POIN, SEMUA_TINGKAT, TINGKAT } from '../src/data/skuData.js';
import { DAFTAR_TINGKAT_SIAGA, TINGKAT_SIAGA } from '../src/data/skuSiaga.js';
import { AGAMA_LAIN_SIAGA, AREA_SIAGA, URUTAN_AREA_SIAGA } from '../src/data/skuSiagaData.js';
import { PRASYARAT_TINGKAT, bisaDiajukan, butirPeserta, catatHasilUji, hitungProgres, prasyaratTerpenuhi, prasyaratTingkat, tingkatSelesai } from '../src/lib/skuLogic.js';

const P = process.cwd().replace(/\\/g, '/');
let gagal = 0, lulus = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };

console.log('--- Katalog: jumlah butir dan sub-butir agama menurut SK 119/2011 ---');
{
  const jumlah = Object.fromEntries(DAFTAR_TINGKAT_SIAGA.map((t) => [t, TINGKAT_SIAGA[t].butir.length]));
  ok(jumlah.Mula === 34 && jumlah.Bantu === 33 && jumlah.Tata === 33, 'butir per tingkat: ' + JSON.stringify(jumlah));
  ok(DAFTAR_TINGKAT.join() === 'Bantara,Laksana' && DAFTAR_TINGKAT_SIAGA.join() === 'Mula,Bantu,Tata', 'daftar tingkat Penegak tidak berubah; Siaga terpisah');
  const idSemua = DAFTAR_TINGKAT_SIAGA.flatMap((t) => TINGKAT_SIAGA[t].butir.map((b) => b.id));
  ok(new Set(idSemua).size === 100 && idSemua.every((i) => /^(MUL|BNU|TAT)-\d\d$/.test(i)), '100 id butir unik berbentuk MUL-xx, BNU-xx, TAT-xx');
  ok(TINGKAT_SIAGA.Mula.butir.every((b, i) => b.no === i + 1) && TINGKAT_SIAGA.Bantu.butir.every((b, i) => b.no === i + 1) && TINGKAT_SIAGA.Tata.butir.every((b, i) => b.no === i + 1), 'nomor butir berurutan tanpa celah');
  const banyakSub = { Mula: { Islam: 7, Katolik: 5, Protestan: 5, Hindu: 5, Buddha: 3 }, Bantu: { Islam: 6, Katolik: 4, Protestan: 6, Hindu: 7, Buddha: 3 }, Tata: { Islam: 4, Katolik: 5, Protestan: 5, Hindu: 7, Buddha: 3 } };
  for (const t of DAFTAR_TINGKAT_SIAGA) {
    const b1 = TINGKAT_SIAGA[t].butir[0];
    ok(b1.agama && Object.keys(b1.agama).join() === 'Islam,Katolik,Protestan,Hindu,Buddha', `${t}: butir 1 bercabang menurut lima agama`);
    ok(TINGKAT_SIAGA[t].butir.slice(1).every((b) => !b.agama && typeof b.teks === 'string' && b.teks.length > 10), `${t}: butir selain 1 tidak bercabang dan berteks`);
    for (const [agama, n] of Object.entries(banyakSub[t])) {
      const unit = butirPeserta(t, agama).flatMap((b) => b.unit);
      ok(unit.length === TINGKAT_SIAGA[t].butir.length - 1 + n, `${t} ${agama}: ${n} sub-butir agama, ${unit.length} unit`);
      ok(b1.agama[agama].length === n && b1.agama[agama].every((x) => x.length > 10), `${t} ${agama}: isi sub-butir ada`);
    }
    const lain = butirPeserta(t, 'Khonghucu').flatMap((b) => b.unit).filter((u) => u.butirNo === 1);
    ok(lain.length === 1 && lain[0].teks === AGAMA_LAIN_SIAGA[0] && lain[0].agama === 'Khonghucu', `${t} Khonghucu: satu butir pengganti yang ditetapkan Pembina (bukan teks Penegak)`);
  }
  const areaOk = DAFTAR_TINGKAT_SIAGA.every((t) => {
    const urut = TINGKAT_SIAGA[t].butir.map((b) => URUTAN_AREA_SIAGA.indexOf(b.area));
    return urut.every((i) => i >= 0) && urut.every((v, i) => i === 0 || v >= urut[i - 1]);
  });
  ok(areaOk && Object.keys(AREA_SIAGA).length === 5, 'tiap butir punya area (spiritual, emosional, sosial, intelektual, fisik) dan urutannya menurut SK');
  const hitungArea = (t) => Object.fromEntries(URUTAN_AREA_SIAGA.map((a) => [a, TINGKAT_SIAGA[t].butir.filter((b) => b.area === a).length]));
  ok(JSON.stringify(hitungArea('Mula')) === '{"spiritual":1,"emosional":9,"sosial":8,"intelektual":7,"fisik":9}', 'area Mula: 1, 9, 8, 7, 9');
  ok(JSON.stringify(hitungArea('Bantu')) === '{"spiritual":1,"emosional":9,"sosial":8,"intelektual":6,"fisik":9}' && JSON.stringify(hitungArea('Tata')) === JSON.stringify(hitungArea('Bantu')), 'area Bantu dan Tata: 1, 9, 8, 6, 9');
  ok(Object.keys(INDEKS_POIN).filter((i) => /^(BAN|LAK)-/.test(i)).length === Object.keys(INDEKS_POIN).filter((i) => !/^(MUL|BNU|TAT)-/.test(i)).length, 'indeks poin memuat unit Penegak dan Siaga');
  ok(SEMUA_TINGKAT.Mula === TINGKAT_SIAGA.Mula && SEMUA_TINGKAT.Bantara === TINGKAT.Bantara, 'SEMUA_TINGKAT menggabungkan keduanya');
  ok(Object.values(SEMUA_TINGKAT).every((t) => new Set(t.butir.map((b) => b.id)).size === t.butir.length), 'id butir unik di dalam tiap tingkat');
}

const pg = new PGlite();
await siapkanPg(pg, { sqlStub: readFileSync(`${P}/supabase/lokal/stub.sql`, 'utf8'), sqlSkema: readFileSync(`${P}/supabase/skema.sql`, 'utf8').replace(/^﻿/, '') });
await isiDataContoh(pg);
await pg.query('update public.profiles set wajib_ganti_pin = false');
const q = async (sql, p = []) => (await pg.query(sql, p)).rows;
const masuk = async (nama, pin) => { const a = buatApi(buatKlienFake(pg)); const r = await a.masuk(nama, pin); return { a, id: r.id }; };
const pembina = await masuk('pembina', PIN_DEMO.pembina);
const admin = await masuk('admin', PIN_DEMO.admin);
const ahmad = await masuk('10231', PIN_DEMO.penegak);

console.log('\n--- Katalog di skema = data aplikasi ---');
{
  const butir = await q("select id, tingkat, no from public.sku_butir where tingkat in ('Mula','Bantu','Tata') order by id");
  const dariData = DAFTAR_TINGKAT_SIAGA.flatMap((t) => TINGKAT_SIAGA[t].butir.map((b) => ({ id: b.id, tingkat: t, no: b.no }))).sort((a, b) => a.id.localeCompare(b.id));
  ok(butir.length === 100 && JSON.stringify(butir) === JSON.stringify(dariData), 'sku_butir Siaga: 100 baris sama dengan data');
  const unit = await q("select id, butir_id, tingkat, butir_no, agama, sub from public.sku_unit where tingkat in ('Mula','Bantu','Tata') order by id");
  const unitData = Object.entries(INDEKS_POIN).filter(([id, p]) => !id.includes('-LAIN-') && ['Mula', 'Bantu', 'Tata'].includes(p.tingkat))
    .map(([id, p]) => ({ id, butir_id: id.split('-').slice(0, 2).join('-'), tingkat: p.tingkat, butir_no: p.butirNo, agama: p.agama, sub: p.sub })).sort((a, b) => a.id.localeCompare(b.id));
  ok(unit.length === 175 && JSON.stringify(unit) === JSON.stringify(unitData), 'sku_unit Siaga: 175 baris sama dengan data');
  const penegak = await q("select count(*)::int n from public.sku_butir where tingkat in ('Bantara','Laksana')");
  ok(penegak[0].n === 45, 'butir Penegak tetap 45');
}

console.log('\n--- Prasyarat tingkat: klien = sigarda.prasyarat_tingkat ---');
{
  const kisi = ['Bantara', 'Laksana', 'Mula', 'Bantu', 'Tata', 'Garuda', '', 'mula'];
  let beda = 0;
  for (const t of kisi) {
    const s = (await q('select sigarda.prasyarat_tingkat($1) v', [t]))[0].v;
    if (s !== prasyaratTingkat(t)) { beda++; console.log('   beda:', JSON.stringify(t), 'server', s, 'klien', prasyaratTingkat(t)); }
  }
  ok(beda === 0, `${kisi.length} nama tingkat: prasyarat klien sama dengan server`);
  ok(JSON.stringify(PRASYARAT_TINGKAT) === '{"Laksana":"Bantara","Bantu":"Mula","Tata":"Bantu"}', 'urutan: Laksana < Bantara; Bantu < Mula; Tata < Bantu');
}

console.log('\n--- Pencatatan hasil SKU anak Siaga oleh Pembina ---');
let r = await pembina.a.tambahSiaga([
  { nama: 'Anak Islam', kelas: '4A', jk: 'L', agama: 'Islam' },
  { nama: 'Anak Katolik', kelas: '5', agama: 'Katolik' },
  { nama: 'Anak Tanpa Agama', kelas: '3' },
  { nama: 'Anak Khonghucu', kelas: '4B', agama: 'Khonghucu' },
]);
ok(r.ok, 'anak Siaga dibuat ' + (r.pesan ?? ''));
const id = Object.fromEntries((await q("select id, nama from public.profiles where tanpa_akun")).map((x) => [x.nama, x.id]));
const catat = (pesertaId, skuId, hasil = 'lulus', extra = {}) => pembina.a.catatHasil({ pin: PIN_DEMO.pembina, pesertaId, skuId, hasil, tanggalUji: '2026-09-25', nilai: hasil === 'lulus' ? 'Baik' : null, catatan: '', ...extra });
{
  r = await catat(id['Anak Islam'], 'MUL-02');
  ok(r.ok, 'Pembina meluluskan butir Mula anak Siaga (PIN Pembina sendiri, tanpa akun anak) ' + (r.pesan ?? ''));
  const baris = (await q("select status, penguji_id, verifikasi from public.sku_progress where peserta_id = $1 and sku_id = 'MUL-02'", [id['Anak Islam']]))[0];
  ok(baris.status === 'lulus' && baris.penguji_id === pembina.id && /^VRF-/.test(baris.verifikasi), 'tersimpan lulus, penguji = Pembina, kode verifikasi dibuat');
  ok((await q("select count(*)::int n from public.sku_riwayat where peserta_id = $1 and sku_id = 'MUL-02'", [id['Anak Islam']]))[0].n === 1, 'riwayat butir tercatat');
  r = await catat(id['Anak Islam'], 'BNU-02');
  ok(!r.ok && /belum menyelesaikan seluruh butir Mula/.test(r.pesan), 'Bantu menunggu Mula selesai: ' + r.pesan);
  r = await catat(id['Anak Islam'], 'TAT-02');
  ok(!r.ok && /belum menyelesaikan seluruh butir Bantu/.test(r.pesan), 'Tata menunggu Bantu selesai: ' + r.pesan);
  r = await catat(id['Anak Islam'], 'BNU-02', 'reset', { tanggalUji: null, catatan: 'uji' });
  ok(r.ok, 'mengembalikan ke belum diuji tidak terkena prasyarat');
  r = await catat(id['Anak Islam'], 'MUL-01-KAT-1');
  ok(!r.ok && /Poin SKU tidak ditemukan/.test(r.pesan), 'sub-butir agama lain ditolak untuk anak Islam');
  r = await catat(id['Anak Islam'], 'MUL-01-ISL-1');
  ok(r.ok, 'sub-butir agama yang sesuai diterima');
  r = await catat(id['Anak Tanpa Agama'], 'MUL-02');
  ok(!r.ok && /belum dicatat agamanya.*Anggota Siaga/.test(r.pesan), 'anak tanpa agama: penulisan SKU ditolak dengan pesan menuntun ke menu Anggota Siaga: ' + r.pesan);
  r = await admin.a.catatHasil({ pin: PIN_DEMO.admin, pesertaId: id['Anak Islam'], skuId: 'MUL-03', hasil: 'lulus', tanggalUji: '2026-09-25', nilai: 'Baik', catatan: '' });
  ok(!r.ok, 'Admin Gudep tidak dapat mencatat hasil: ' + r.pesan);
  r = await ahmad.a.catatHasil({ pin: PIN_DEMO.penegak, pesertaId: id['Anak Islam'], skuId: 'MUL-03', hasil: 'lulus', tanggalUji: '2026-09-25', nilai: 'Baik', catatan: '' });
  ok(!r.ok, 'Penegak biasa tidak dapat mencatat hasil: ' + r.pesan);
  r = await catat(id['Anak Islam'], 'MUL-03', 'lulus', { pin: '000000' });
  ok(!r.ok && /PIN verifikasi salah/.test(r.pesan), 'PIN salah ditolak');
  // Aturan agama yang sama dengan Penegak: Pembina contoh beragama Islam, jadi butir agama anak beragama lain hanya dapat dinilai Pembina seagama atau lewat surat pengantar.
  r = await catat(id['Anak Katolik'], 'MUL-01-KAT-5');
  ok(!r.ok && /Butir agama hanya dapat dinilai oleh Pembina yang seagama/.test(r.pesan), 'anak Katolik: butir agama ditolak untuk Pembina tidak seagama: ' + r.pesan);
  r = await catat(id['Anak Khonghucu'], 'MUL-01-KHO-1');
  ok(!r.ok && /Butir agama hanya dapat dinilai oleh Pembina yang seagama/.test(r.pesan), 'anak Khonghucu: butir pengganti juga butir agama (ditolak untuk Pembina tidak seagama)');
  r = await catat(id['Anak Katolik'], 'MUL-02');
  ok(r.ok, 'anak Katolik: butir bukan agama tetap dapat dinilai Pembina mana pun ' + (r.pesan ?? ''));
  // aturan Penegak tetap: Laksana menunggu Bantara, dengan pesan yang sama
  r = await catat(ahmad.id, 'LAK-02');
  ok(!r.ok && /belum menyelesaikan seluruh butir Bantara/.test(r.pesan), 'Penegak: Laksana tetap menunggu Bantara: ' + r.pesan);
}

console.log('\n--- Menyelesaikan seluruh Mula: server = klien ---');
{
  const anak = id['Anak Islam'];
  const unit = butirPeserta('Mula', 'Islam').flatMap((b) => b.unit);
  for (const u of unit) { const s = await catat(anak, u.id); if (!s.ok && !/sudah lulus/.test(s.pesan ?? '')) { ok(false, `gagal meluluskan ${u.id}: ${s.pesan}`); break; } }
  const d = (await pembina.a.muatProgress(null)).data;
  const profil = petaProfil((await q('select * from public.profiles where id = $1', [anak]))[0]);
  ok(Object.values(d[anak] ?? {}).filter((e) => e.status === 'lulus').length === unit.length, `${unit.length} unit Mula lulus tersimpan dan terbaca klien`);
  const srv = async (t) => (await q('select sigarda.tingkat_selesai($1, $2) v', [anak, t]))[0].v;
  ok((await srv('Mula')) === true && tingkatSelesai(d, profil, 'Mula') === true, 'Mula selesai: server dan klien sepakat');
  ok((await srv('Bantu')) === false && tingkatSelesai(d, profil, 'Bantu') === false, 'Bantu belum selesai: server dan klien sepakat');
  const p = hitungProgres(d, profil, 'Mula');
  ok(p.total === 34 && p.lulus === 34 && p.persen === 100 && p.totalUnit === 40, 'progres Mula 34 dari 34 butir (40 unit untuk agama Islam)');
  ok(prasyaratTerpenuhi(d, profil, 'Bantu').ok && !prasyaratTerpenuhi(d, profil, 'Tata').ok && prasyaratTerpenuhi(d, profil, 'Tata').prasyarat === 'Bantu', 'klien: Bantu terbuka, Tata masih terkunci');
  ok(tingkatSiagaAwal(d, profil) === 'Bantu', 'tab awal halaman = tingkat terbuka yang belum selesai (Bantu)');
  r = await catat(anak, 'BNU-02');
  ok(r.ok, 'sesudah Mula selesai: butir Bantu diterima ' + (r.pesan ?? ''));
  r = await catat(anak, 'TAT-02');
  ok(!r.ok && /belum menyelesaikan seluruh butir Bantu/.test(r.pesan), 'Tata tetap terkunci sampai Bantu selesai');
  // cermin lokal klien (dipakai uji lain): pesan sama
  const cek = bisaDiajukan({}, { id: 'x', agama: 'Islam' }, 'BNU-02');
  ok(!cek.ok && /Mula/.test(cek.alasan), 'klien: bisaDiajukan menolak Bantu sebelum Mula selesai');
  let galat = '';
  try { catatHasilUji({}, { peserta: { id: 'x', agama: 'Islam' }, skuId: 'TAT-02', pengujiId: 'y', hasil: 'lulus', tanggalUji: '2026-09-25', nilai: 'Baik' }); } catch (e) { galat = e.message; }
  ok(/Bantu/.test(galat), 'klien: catatHasilUji menolak Tata sebelum Bantu selesai');
}

console.log('\n--- Pemicu anggota tidak aktif tetap berlaku ---');
{
  await pembina.a.aturStatusAnggota(id['Anak Katolik'], 'nonaktif');
  r = await catat(id['Anak Katolik'], 'MUL-03');
  ok(!r.ok && /tidak dapat diubah|berstatus/.test(r.pesan), 'anak nonaktif tidak dapat dinilai: ' + r.pesan);
}

console.log('\n--- Anak Siaga tidak ikut tangga pengingat (eskalasi) ---');
{
  const anak = id['Anak Tanpa Agama'];
  await q("update public.profiles set dibuat = now() - interval '40 days' where id = $1", [anak]);
  const mulai = (await q('select sigarda.eskalasi_mulai_sku($1) v', [anak]))[0].v;
  ok(mulai !== null, 'kontrol: tanpa aturan pengecualian, anak tanpa catatan 40 hari akan dihitung "SKU tidak bergerak"');
  await q('select sigarda.eskalasi_proses()');
  ok((await q("select count(*)::int n from public.notifikasi where jenis = 'eskalasi' and kunci like $1", ['%' + anak + '%']))[0].n === 0, 'tidak ada notifikasi eskalasi yang memuat anak Siaga (kepadanya maupun ke pengurus)');
  const d = (await pembina.a.muatEskalasi()).data;
  ok(Array.isArray(d) && !d.some((x) => x.pesertaId === anak), 'Tindak Lanjut tidak memuat anak Siaga');
  const adaPenegak = (await q("select count(*)::int n from public.notifikasi where jenis = 'eskalasi'"))[0].n;
  ok(adaPenegak > 0, 'kontrol: Penegak berakun tetap menerima eskalasi (' + adaPenegak + ' notifikasi)');
}

console.log('\n--- Render halaman SKU anak Siaga ---');
{
  const users = (await q('select * from public.profiles')).map(petaProfil);
  const progress = (await pembina.a.muatProgress(null)).data;
  const ctx = (user, pesertaId) => ({
    user, users, progress, dokumen: [], bolehSurat: false, muatDokumen: () => {}, daftarPesertaSemua: users, materi: [], penugasan: {}, penugasanPeserta: {}, muatPenugasan: () => {},
    praUjiAktif: false, pastikanRiwayat: () => {}, pastikanPraUji: () => {}, praUjiPeserta: () => [], instrumen: {}, instrumenSiap: true, pastikanInstrumen: () => {}, pengaturan: {},
    absensi: { sesi: {}, hadir: {} }, semesterSiap: {}, pastikanAbsensi: async () => ({ ok: true }), api: () => ({ muatTabungan: async () => ({ ok: true, data: [] }) }), catatHasil: async () => ({ ok: true }), notify: () => {}, pesertaId,
  });
  const render = (user, pesertaId) => renderToStaticMarkup(h(KonteksApp.Provider, { value: ctx(user, pesertaId) }, h(SiagaSku, { pesertaId, onKembali: () => {} }))).replace(/<!-- -->/g, '');
  const pembinaUser = { id: pembina.id, role: 'penguji', jabatan: 'Pembina', status: 'aktif', agama: 'Islam' };
  let html = render(pembinaUser, id['Anak Islam']);
  ok(html.includes('Anak Islam') && html.includes('Kelas 4A') && html.includes('Mula') && html.includes('Bantu') && html.includes('Tata'), 'halaman: nama, kelas, dan tiga tab tingkat');
  ok(html.includes('butir lulus') && html.includes('Peta 33 butir SKU Bantu'), 'tab awal Bantu (Mula sudah selesai): peta 33 butir');
  ok(html.includes('Area Emosional') && html.includes('Area Fisik'), 'butir ditandai area pengembangannya');
  ok(html.includes('Nilai butir') && !html.includes('Ajukan'), 'Pembina melihat tombol Nilai butir; tidak ada pengajuan (anak tanpa akun)');
  ok(html.includes('Panduan SKU Siaga') || html.includes('Kwarnas Nomor 119'), 'rujukan peraturan SK 119/2011 ditampilkan');
  ok(html.includes('data-sumber-peraturan'), 'rujukan memakai komponen SumberPeraturan');
  html = render(pembinaUser, id['Anak Tanpa Agama']);
  ok(html.includes('belum dicatat') && html.includes('Anggota Siaga') && !html.includes('Nilai butir'), 'anak tanpa agama: peringatan dan tidak ada tombol nilai');
  html = render({ id: admin.id, role: 'admin', status: 'aktif' }, id['Anak Islam']);
  ok(!html.includes('Nilai butir'), 'Admin Gudep hanya melihat (tanpa tombol nilai)');
  html = render(pembinaUser, id['Anak Katolik']);
  ok(html.includes('nonaktif') && !html.includes('Nilai butir'), 'anak nonaktif: hanya dilihat');
  html = render(pembinaUser, '00000000-0000-0000-0000-000000000000');
  ok(html.includes('Anggota tidak ditemukan'), 'id tidak dikenal: pesan kosong');
}

console.log(`\nRINGKASAN SKU SIAGA: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
