/**
 * EXCEL UNTUK ANGGOTA SIAGA: template dan pembaca (.xlsx). Dipisah dari siagaLogic.js (murni, dipakai AppContext) supaya ExcelJS (dimuat saat dipakai) dan teks petunjuk
 * ikut paket halaman Anggota yang dimuat malas, bukan paket awal. Hasil pembacaan berupa baris mentah { nama, kelas, jk, agama, nis, perindukan, barung } yang
 * diperiksa `periksaBanyakSiaga` (siagaLogic.js), jadi aturannya sama dengan tempelan teks dan dengan server.
 */
import { AGAMA } from '../data/skuData';
import { MAKS_BARIS, hurufSaja } from './importAnggota';
import { teksSel, unduhBlob } from './importAnggotaExcel';

const NAMA_LEMBAR = 'Data Anggota Siaga';

const KOLOM = [
  { key: 'nama', header: 'Nama Lengkap', lebar: 32 },
  { key: 'kelas', header: 'Kelas', lebar: 10 },
  { key: 'jk', header: 'Jenis Kelamin (opsional)', lebar: 20 },
  { key: 'agama', header: 'Agama (opsional)', lebar: 18 },
  { key: 'nis', header: 'NIS (opsional)', lebar: 16 },
  { key: 'perindukan', header: 'Perindukan (opsional)', lebar: 22 },
  { key: 'barung', header: 'Barung (opsional)', lebar: 20 },
];

function petaHeader(teks) {
  const k = hurufSaja(teks).replace(/opsional$/, '');
  if (k === 'nama' || k === 'namalengkap' || k === 'namaanak' || k === 'namasiswa') return 'nama';
  if (k === 'kelas' || k === 'rombel') return 'kelas';
  if (k === 'jeniskelamin' || k === 'jk' || k === 'kelamin' || k === 'lp') return 'jk';
  if (k.startsWith('agama')) return 'agama';
  if (k === 'nis' || k === 'nisn') return 'nis';
  if (k.startsWith('perindukan')) return 'perindukan';
  if (k.startsWith('barung')) return 'barung';
  return null;
}

/** "Laki-laki" / "Perempuan" / "L" / "P" menjadi L atau P; selain itu dikembalikan apa adanya (diperiksa siagaLogic). */
function bakukanJk(teks) {
  const t = hurufSaja(teks);
  if (t === 'l' || t === 'lakilaki' || t === 'laki' || t === 'pria') return 'L';
  if (t === 'p' || t === 'perempuan' || t === 'wanita') return 'P';
  return String(teks ?? '').trim();
}

/** Membaca berkas .xlsx menjadi baris mentah. Melempar Error berpesan bahasa Indonesia bila berkas tidak dapat dipakai. */
export async function bacaExcelSiaga(buffer) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw new Error('File tidak dapat dibaca. Pastikan formatnya .xlsx (bukan .xls atau .csv).');
  }
  const ws = wb.getWorksheet(NAMA_LEMBAR) ?? wb.worksheets[0];
  if (!ws) throw new Error('File tidak berisi lembar kerja.');

  let barisJudul = 0;
  let kolom = {};
  for (let r = 1; r <= Math.min(10, ws.rowCount); r += 1) {
    const cur = {};
    ws.getRow(r).eachCell((c, n) => {
      const k = petaHeader(teksSel(c.value));
      if (k && !cur[k]) cur[k] = n;
    });
    if (cur.nama && cur.kelas) { barisJudul = r; kolom = cur; break; }
  }
  if (!barisJudul) throw new Error('Baris judul kolom tidak ditemukan. Gunakan template dari tombol "Unduh template Excel" (kolom Nama Lengkap dan Kelas wajib ada).');

  const baris = [];
  for (let r = barisJudul + 1; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const ambil = (k) => (kolom[k] ? teksSel(row.getCell(kolom[k]).value) : '');
    const item = { nama: ambil('nama'), kelas: ambil('kelas'), jk: bakukanJk(ambil('jk')), agama: ambil('agama'), nis: ambil('nis'), perindukan: ambil('perindukan'), barung: ambil('barung') };
    if (!item.nama && !item.kelas && !item.nis && !item.perindukan && !item.barung) continue; // baris kosong
    baris.push(item);
    if (baris.length > MAKS_BARIS) throw new Error(`Maksimal ${MAKS_BARIS} baris per impor. Bagi file menjadi beberapa bagian.`);
  }
  if (!baris.length) throw new Error('Tidak ada data anak pada file. Isi mulai baris di bawah judul kolom.');
  return baris;
}

/** Template .xlsx anggota Siaga: lembar data (judul, pilihan JK dan agama, kolom teks) dan lembar petunjuk. */
export async function buatTemplateSiaga() {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIGASI';

  const ws = wb.addWorksheet(NAMA_LEMBAR, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = KOLOM.map((k) => ({ header: k.header, key: k.key, width: k.lebar }));
  const kepala = ws.getRow(1);
  kepala.height = 26;
  kepala.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF45291A' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  const no = (key) => KOLOM.findIndex((k) => k.key === key) + 1;
  for (let r = 2; r <= MAKS_BARIS + 1; r += 1) {
    ws.getCell(r, no('kelas')).numFmt = '@'; // teks: "4" dan "5A" tidak diubah Excel
    ws.getCell(r, no('nis')).numFmt = '@';
    ws.getCell(r, no('jk')).dataValidation = {
      type: 'list', allowBlank: true, formulae: ['"Laki-laki,Perempuan"'], showErrorMessage: true, errorTitle: 'Jenis kelamin', error: 'Pilih Laki-laki atau Perempuan.',
    };
    ws.getCell(r, no('agama')).dataValidation = {
      type: 'list', allowBlank: true, formulae: [`"${AGAMA.join(',')}"`], showErrorMessage: true, errorTitle: 'Agama', error: `Pilih salah satu: ${AGAMA.join(', ')}`,
    };
  }

  const petunjuk = wb.addWorksheet('Petunjuk');
  petunjuk.getColumn(1).width = 30;
  petunjuk.getColumn(2).width = 80;
  [
    ['Petunjuk pengisian: anggota Siaga (tanpa akun)', ''],
    ['Isi mulai baris 2', 'Satu anak per baris, paling banyak ' + MAKS_BARIS + ' baris. Contoh baris: Andi Saputra | 4A | Laki-laki | Islam | (NIS kosong) | Perindukan Melati | Barung Elang.'],
    ['Nama Lengkap (wajib)', 'Nama anak, maksimal 120 karakter.'],
    ['Kelas (wajib)', 'Angka 1 sampai 6, boleh diikuti satu huruf paralel, contoh: 4 atau 5A.'],
    ['Jenis Kelamin (opsional)', 'Laki-laki atau Perempuan (atau L / P).'],
    ['Agama (opsional)', 'Pilih dari daftar. Boleh dikosongkan; butir SKU belum dapat dinilai sebelum agama diisi.'],
    ['NIS (opsional)', 'Boleh dikosongkan. Bila diisi, tidak boleh sama dengan anggota lain.'],
    ['Perindukan, Barung (opsional)', 'Nama perindukan dan barung (barung harus berada di sebuah perindukan; isi perindukannya). Dapat diatur kemudian di tab Perindukan dan barung.'],
    ['Sesudah diisi', 'Menu Anggota > Impor Excel, pilih berkas ini, periksa pratinjau, lalu Simpan. Bila ada baris bertanda galat, perbaiki dulu; semua baris disimpan atau tidak sama sekali.'],
  ].forEach((b) => petunjuk.addRow(b));
  petunjuk.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF45291A' } };
  petunjuk.eachRow((r) => { r.alignment = { vertical: 'top', wrapText: true }; });

  return wb.xlsx.writeBuffer();
}

export async function unduhTemplateSiaga() {
  unduhBlob(await buatTemplateSiaga(), 'template-import-anggota-siaga-sigasi.xlsx');
}
