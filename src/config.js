// Identitas aplikasi. SIGASI = Sistem Informasi Gudep Siaga (NAMA SEMENTARA; pemilik belum memutuskan nama akhir, ganti di sini).
export const APP = {
  nama: 'SIGASI',
  kepanjangan: 'Sistem Informasi Gudep Siaga',
  tagline: 'Wadah pencatatan SKU, TKK, dan kegiatan Pramuka Siaga',
  versi: '0.1',
};

// Identitas Gugus Depan BAWAAN. Admin Gudep mengubahnya di menu "Data Gudep" (disimpan di basis data, pengaturan gudep.data); nilai di sini
// hanya dipakai selama belum ada data tersimpan atau bila sebuah isian dikosongkan. Bacalah lewat useGudep() / ambilGudep() (src/lib/gudepStore.js),
// jangan mengimpor konstanta ini langsung pada halaman.
//   pembina   = Pembina Gudep / Ka Gudep (penanda tangan surat intern sekolah)
//   kamabigus = Kepala Sekolah / Kamabigus (penanda tangan surat keluar sekolah)
// Pradana dan Pradani TIDAK diatur di sini: diambil dari anggota Dewan Ambalan yang berjabatan itu (src/lib/dewanLogic.js).
export const GUDEP_BAWAAN = {
  nama: 'Gugus Depan Pramuka Siaga',
  singkat: 'Perindukan Siaga',
  sekolah: 'Sekolah Dasar',
  alamat: '',
  kota: 'Isi kota',
  nomorGudep: '',
  kwarran: '',
  kwarcab: '',
  kodeSurat: 'GD-SIAGA',
  telepon: '',
  email: '',
  pembina: { jabatan: 'Pembina Gudep', nama: 'Isi nama Pembina', nta: '', nip: '' },
  kamabigus: { jabatan: 'Kepala Sekolah / Kamabigus', nama: '', nta: '', nip: '' },
};

// Hanya SARAN pada isian anggota baru. Daftar pada filter selalu diambil dari data yang ada.
export const SARAN_SANGGA = ['Sangga Elang', 'Sangga Rajawali', 'Sangga Merak', 'Sangga Kasuari'];
export const SARAN_KELAS = ['X', 'XI', 'XII'];

export const NILAI = ['Sangat baik', 'Baik', 'Cukup'];

// Kehadiran latihan Jumat di bawah angka ini (persen) ditandai rendah pada rekap.
export const AMBANG_HADIR = 75;

// Kelompok pengguna. Pembina dan Dewan Ambalan sama-sama berperan "penguji" (dapat menilai SKU,
// mencatat absensi, meninjau portofolio) dan dibedakan lewat jabatan.
export const KELOMPOK_PENGGUNA = [
  { id: 'peserta', label: 'Penegak', role: 'peserta' },
  { id: 'dewan', label: 'Dewan Ambalan', role: 'penguji', jabatan: 'Dewan Ambalan' },
  { id: 'pembina', label: 'Pembina', role: 'penguji', jabatan: 'Pembina' },
  { id: 'admin', label: 'Admin Gudep', role: 'admin' },
];
export const cocokKelompok = (kelompok, user) =>
  user.role === kelompok.role && (!kelompok.jabatan || user.jabatan === kelompok.jabatan);
