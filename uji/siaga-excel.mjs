// Excel anggota Siaga (tanpa akun): template dan pembaca (src/lib/siagaExcel.js) bersama pemeriksaan siagaLogic.
import ExcelJS from 'exceljs';
import { bacaExcelSiaga, buatTemplateSiaga } from '../src/lib/siagaExcel.js';
import { periksaBanyakSiaga } from '../src/lib/siagaLogic.js';

let lulus = 0, gagal = 0;
const ok = (c, m) => { if (c) { lulus++; console.log('ok   :', m); } else { gagal++; console.log('GAGAL:', m); } };

console.log('--- Template ---');
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(await buatTemplateSiaga());
const ws = wb.getWorksheet('Data Anggota Siaga');
const judul = [1, 2, 3, 4, 5, 6, 7].map((n) => String(ws.getCell(1, n).value));
ok(judul[0] === 'Nama Lengkap' && judul[1] === 'Kelas' && judul[6].startsWith('Barung'), `judul kolom: ${judul.join(' | ')}`);
ok(ws.getCell(2, 2).numFmt === '@' && ws.getCell(500, 5).numFmt === '@', 'kolom Kelas dan NIS berformat teks');
ok(!ws.getCell(2, 1).value, 'tidak ada baris contoh di lembar data');
let petunjuk = ''; wb.getWorksheet('Petunjuk').eachRow((r) => r.eachCell((c) => { petunjuk += c.value + ' '; }));
ok(/Kelas \(wajib\)/.test(petunjuk) && /Perindukan/.test(petunjuk), 'lembar Petunjuk menjelaskan kolom');

console.log('\n--- Pembaca ---');
const isi = new ExcelJS.Workbook();
const s = isi.addWorksheet('Data Anggota Siaga');
s.addRow(['Nama Lengkap', 'Kelas', 'Jenis Kelamin (opsional)', 'Agama (opsional)', 'NIS (opsional)', 'Perindukan (opsional)', 'Barung (opsional)']);
s.addRow(['Andi Saputra', '4A', 'Laki-laki', 'Islam', '', 'Perindukan Melati', 'Barung Elang']);
s.addRow(['Made Sari', 5, 'Perempuan', 'Hindu', '2001', '', '']);
s.addRow([]);
s.addRow(['Budi', '9', 'L', '', '', '', '']);
const baris = await bacaExcelSiaga(await isi.xlsx.writeBuffer());
ok(baris.length === 3 && baris[0].jk === 'L' && baris[1].jk === 'P' && baris[1].kelas === '5' && baris[0].barung === 'Barung Elang', 'membaca baris, melewati baris kosong, JK dibakukan ke L/P');
const h = periksaBanyakSiaga(baris, []);
ok(h.baris.length === 3 && h.galat === 1 && h.baris[0].nilai?.kelas === '4A' && /Kelas harus angka 1 sampai 6/.test(h.baris[2].pesan ?? ''), 'pemeriksaan: dua baris sah, kelas 9 ditolak dengan pesan yang sama seperti server');

let galat = '';
try { await bacaExcelSiaga(new Uint8Array([1, 2, 3]).buffer); } catch (e) { galat = e.message; }
ok(/tidak dapat dibaca/.test(galat), 'berkas rusak: pesan yang menuntun');
const kosong = new ExcelJS.Workbook(); kosong.addWorksheet('x').addRow(['Foo', 'Bar']);
galat = '';
try { await bacaExcelSiaga(await kosong.xlsx.writeBuffer()); } catch (e) { galat = e.message; }
ok(/Baris judul kolom tidak ditemukan/.test(galat), 'tanpa judul kolom: pesan yang menuntun');

console.log(`\nRINGKASAN SIAGA-EXCEL: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
