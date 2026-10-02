import { lazy, useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import { APP } from './config';
import Login from './components/Login';
import PesertaBeranda from './pages/PesertaBeranda';
import GantiPinWajib from './pages/GantiPinWajib';
import BannerVersi from './components/BannerVersi';
import BatasHalaman from './components/BatasHalaman';
import FormWhatsapp from './components/FormWhatsapp';
import { Modal } from './components/ui';
import { pembinaAtauAdmin } from './lib/hakLogic';
import { parameterKelola, petunjukDari, simpanPetunjuk } from './lib/suntingLogic';
import { ujiResmiTampil } from './lib/praUjiLogic';
import { bolehKelolaMateri } from './lib/materiLogic';
import { kelasSd } from './lib/rombelLogic';
import LogoMark from './components/LogoMark';

// Halaman selain beranda dimuat malas (berkasnya diunduh saat pertama dibuka); lihat BatasHalaman.
// Dasbor dimuat malas per peran: Penegak (mayoritas) tidak mengunduh dasbor Pembina dan Admin. Berkasnya diminta lebih awal begitu peran
// diketahui (lihat useEffect di Shell), sehingga tidak menambah satu putaran unduhan setelah data siap. Halaman publik (verifikasi QR dan
// tautan berbagi) juga malas, dipilih di src/Akar.jsx: keduanya menarik pembuat kode QR dan komponen dokumen yang tidak dibutuhkan halaman lain.
const muatPengujiDashboard = () => import('./pages/PengujiDashboard');
const muatAdminDashboard = () => import('./pages/AdminDashboard');
const PengujiDashboard = lazy(muatPengujiDashboard);
const AdminDashboard = lazy(muatAdminDashboard);
const PesertaSku = lazy(() => import('./pages/PesertaSku'));
// Anak Siaga berakun (kelas SD) memakai halaman SKU dan beranda Siaga; Pembina membuka SKU anak lewat SiagaSku (katalog Siaga hanya dimuat di sini)
const SiagaBeranda = lazy(() => import('./pages/SiagaBeranda'));
const SiagaSkuSaya = lazy(() => import('./pages/SiagaSkuSaya'));
const SiagaSku = lazy(() => import('./pages/SiagaSku'));
const Pelantikan = lazy(() => import('./pages/Pelantikan'));
const Perlindungan = lazy(() => import('./pages/Perlindungan'));
const Siaga = lazy(() => import('./pages/Siaga'));
const PesertaDetail = lazy(() => import('./pages/PesertaDetail'));
const AbsensiPeserta = lazy(() => import('./pages/Absensi').then((m) => ({ default: m.AbsensiPeserta })));
const AbsensiPengurus = lazy(() => import('./pages/Absensi').then((m) => ({ default: m.AbsensiPengurus })));
const CetakDokumen = lazy(() => import('./pages/CetakDokumen'));
const Akun = lazy(() => import('./pages/Akun'));
const ResetPin = lazy(() => import('./pages/ResetPin'));
const Materi = lazy(() => import('./pages/Materi'));
const KelolaMateri = lazy(() => import('./pages/KelolaMateri'));
const DataGudep = lazy(() => import('./pages/DataGudep'));
const Iuran = lazy(() => import('./pages/Iuran'));
const Notifikasi = lazy(() => import('./pages/Notifikasi'));
const PemeriksaanData = lazy(() => import('./pages/PemeriksaanData'));
const TindakLanjut = lazy(() => import('./pages/TindakLanjut'));
const Agenda = lazy(() => import('./pages/Agenda'));
const Laporan = lazy(() => import('./pages/Laporan'));
const Bantuan = lazy(() => import('./pages/Bantuan'));
const KelolaBeranda = lazy(() => import('./pages/KelolaBeranda')); // isi halaman muka publik (Fase 1 landing page)

/**
 * Menu per peran, dikelompokkan menurut fungsinya (tampil sebagai kelompok di menu samping, dan berurutan di menu bawah ponsel).
 *  Utama          : Dashboard (anak berakun: Beranda), Notifikasi (semua peran; lencana = belum dibaca), Bantuan (semua peran)
 *  Pengujian SKU  : anak berakun: Poin SKU, Cetak. Pembina: Antrian, Peserta, Pelantikan, Perlindungan, Periksa Data, Cetak. Admin: Pelantikan, Cetak
 *  Kegiatan Gudep : Absensi, Iuran, Agenda (semua peran), Anggota Siaga, Tindak Lanjut, Laporan, Kelola Beranda (Pembina dan Admin)
 *  Materi         : Materi, Kelola Materi (Pembina dan Admin)
 *  Pengelolaan    : Anggota, Anggota Siaga, Data Gudep, Kelola Beranda, Perlindungan, Periksa Data (Admin)
 * Akun saya dan Reset PIN anggota (pengurus) tidak ada di daftar ini: keduanya di menu akun (nama pengguna di menu samping atau header).
 */
/** Id menu lama yang digabung ke menu Anggota ('siaga'): 'anggota' (akun, Admin) dan 'peserta' (daftar Pembina). */
const aliasMenu = (t) => (t === 'anggota' || t === 'peserta' ? 'siaga' : t);

function buatNav(user, peran, belumDibaca = 0, pendampingan = null, praUjiAktif = false) {
  const materi = { id: 'materi', label: 'Materi', ikon: 'buku' };
  const kelola = { id: 'kelolamateri', label: 'Kelola Materi', ikon: 'pustaka' };
  const laporan = { id: 'laporan', label: 'Laporan', ikon: 'grafik' };
  const absensi = { id: 'absensi', label: 'Absensi', ikon: 'absensi' };
  const iuran = { id: 'iuran', label: 'Iuran', ikon: 'iuran' };
  const cetak = { id: 'cetak', label: 'Cetak', ikon: 'cetak' };
  const pemeriksaan = { id: 'pemeriksaan', label: 'Periksa Data', ikon: 'cari' };
  const tindakLanjut = { id: 'tindaklanjut', label: 'Tindak Lanjut', ikon: 'lonceng' };
  const agenda = { id: 'agenda', label: 'Agenda', ikon: 'kalender' };
  const kelolaBeranda = { id: 'kelolaberanda', label: 'Kelola Beranda', ikon: 'beranda' }; // pengurus: Pembina, Admin, Dewan Ambalan (tampilan Dewan)
  const pelantikan = { id: 'pelantikan', label: 'Pelantikan', ikon: 'lencana' };
  const perlindungan = { id: 'perlindungan', label: 'Perlindungan', ikon: 'perisai' }; // Safe From Harm (Tahap 4; Pembina dan Admin)
  const siaga = { id: 'siaga', label: 'Anggota', ikon: 'anggota' }; // satu menu anggota (Pembina dan Admin); Admin: tab tambahan Akun masuk
  const ujiResmi = ujiResmiTampil(user, praUjiAktif); // pra-uji hidup: uji resmi hanya Pembina, jadi Antrian dan Sesi ujian tidak untuk Dewan Ambalan
  const kelolaBoleh = bolehKelolaMateri(user);
  const notifikasi = { id: 'notifikasi', label: 'Notifikasi', ikon: 'lonceng', lencana: belumDibaca };
  const bantuan = { id: 'bantuan', label: 'Bantuan', ikon: 'tanya' };

  if (user.role === 'peserta') {
    return [
      { judul: 'Utama', item: [{ id: 'beranda', label: 'Beranda', ikon: 'beranda' }, notifikasi, bantuan] },
      { judul: 'Pengujian SKU', item: [{ id: 'sku', label: 'Poin SKU', ikon: 'daftar' }, cetak] },
      { judul: 'Kegiatan Gudep', item: [absensi, iuran, agenda] },
      { judul: 'Materi', item: [materi] },
    ];
  }
  if (user.role === 'penguji') {
    return [
      { judul: 'Utama', item: [{ id: 'dashboard', label: 'Dashboard', ikon: 'dashboard' }, notifikasi, bantuan] },
      { judul: 'Pengujian SKU', item: [...(ujiResmi ? [{ id: 'antrian', label: 'Antrian', ikon: 'jam' }] : []), ...(kelolaBoleh ? [pelantikan, perlindungan] : []), pemeriksaan, cetak] },
      { judul: 'Kegiatan Gudep', item: [...(kelolaBoleh ? [siaga] : []), absensi, iuran, tindakLanjut, agenda, ...(kelolaBoleh ? [laporan] : []), kelolaBeranda] },
      { judul: 'Materi', item: [materi, ...(kelolaBoleh ? [kelola] : [])] },
    ];
  }
  return [
    { judul: 'Utama', item: [{ id: 'rekap', label: 'Dashboard', ikon: 'dashboard' }, notifikasi, bantuan] },
    { judul: 'Pengujian SKU', item: [pelantikan, cetak] },
    { judul: 'Kegiatan Gudep', item: [absensi, iuran, tindakLanjut, agenda, laporan] },
    { judul: 'Materi', item: [materi, kelola] },
    { judul: 'Pengelolaan', item: [siaga, { id: 'gudep', label: 'Data Gudep', ikon: 'perisai' }, kelolaBeranda, perlindungan, pemeriksaan] },
  ];
}
function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role="status"
      className={`no-print animasi-naik fixed inset-x-4 bottom-20 z-[60] mx-auto max-w-sm rounded-lg px-4 py-3 text-sm font-semibold shadow-lg md:bottom-6 ${
        toast.tipe === 'err' ? 'bg-red-700 text-white' : 'bg-pramuka-900 text-pramuka-50'
      }`}
    >
      {toast.pesan}
    </div>
  );
}

/** Layar penuh untuk keadaan sebelum aplikasi siap: memuat, konfigurasi belum diisi, atau galat sambungan. */
function LayarStatus({ status, galat }) {
  const isi = {
    memuat: { judul: `Memuat ${APP.nama}...`, teks: 'Menyiapkan aplikasi dan menghubungkan ke server.' },
    konfigurasi: {
      judul: 'Sambungan ke Supabase belum diatur',
      teks: 'Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada berkas .env.local (untuk komputer sendiri) atau pada Variables repositori GitHub (untuk situs terbit), lalu bangun ulang. Panduannya ada di README, bagian "Menghubungkan ke Supabase". Untuk mencoba tanpa Supabase, jalankan npm run dev:lokal.',
    },
    galat: { judul: 'Aplikasi belum dapat dimulai', teks: `Terjadi galat saat menghubungkan ke server. ${galat ?? ''}` },
  }[status];
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-pramuka-800 px-6 text-center text-pramuka-50">
      <LogoMark size={64} />
      <h1 className="mt-5 font-display text-2xl font-bold tracking-wide">{isi.judul}</h1>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-pramuka-200" role={status === 'memuat' ? 'status' : 'alert'}>{isi.teks}</p>
      {status !== 'memuat' && (
        <button className="btn btn-gold mt-5" onClick={() => window.location.reload()}>Muat ulang</button>
      )}
    </div>
  );
}

/** Akun Dewan Ambalan lama yang diarsipkan tidak dapat dipakai lagi. */
function LayarArsip() {
  const { logout } = useApp();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-pramuka-800 px-6 text-center text-pramuka-50">
      <LogoMark size={64} />
      <h1 className="mt-5 font-display text-2xl font-bold tracking-wide">Akun ini sudah diarsipkan</h1>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-pramuka-200" role="alert">
        Dewan Ambalan kini berupa jabatan pada akun Penegak. Keluar, lalu masuk memakai akun Penegak Anda (NIS). Bila jabatan Dewan Anda sudah ditetapkan,
        tombol tampilan Dewan muncul di sana. Hubungi Pembina atau Admin Gudep bila belum.
      </p>
      <button className="btn btn-gold mt-5" onClick={logout}>Keluar</button>
    </div>
  );
}

function Shell() {
  const { user, akun, peranUser, status, galatMuat, belumDibaca, segarkanNotifikasi, pendampingan, praUjiAktif, daftarPesertaSemua } = useApp();
  const [tab, setTab] = useState(null);
  const [fokusId, setFokusId] = useState(null); // peserta yang sedang dibuka penguji/admin
  const [jenisCetak, setJenisCetak] = useState('kartu'); // tab awal halaman Cetak (kartu | stl | surat)
  const [tingkat, setTingkat] = useState('Bantara');
  const [materiButir, setMateriButir] = useState(null); // butir SKU yang dituju tombol "Materi"
  const [kelolaId, setKelolaId] = useState(null); // materi yang langsung dibuka di Kelola Materi ('baru' = tambah)
  const [tabAnggota, setTabAnggota] = useState('anak'); // tab awal menu Anggota (Admin): 'anak' | 'akun'
  const [tabKelolaBeranda, setTabKelolaBeranda] = useState(null); // tab awal Kelola Beranda dari pensil sunting di halaman muka
  const akunSiaga = akun?.role === 'peserta' && kelasSd(akun.kelas); // anak Siaga berakun: tanpa ajakan data diri Penegak maupun nomor WhatsApp
  const [waTutup, setWaTutup] = useState(false); // ajakan isi nomor WhatsApp ditutup/dilewati untuk sesi masuk ini (tahap L5)

  useEffect(() => {
    setTab(null);
    setFokusId(null);
    setMateriButir(null);
    setKelolaId(null);
    setTabKelolaBeranda(null);
    setWaTutup(false); // setiap masuk baru (termasuk akun yang sama masuk lagi) ajakan tampil lagi bila nomor belum diisi
  }, [user?.id, user?.role]);

  // Petunjuk bagi halaman muka (tanpa klien basis data): pengurus yang sedang masuk melihat pensil sunting di sana. Hanya tampilan; server yang menegakkan hak.
  useEffect(() => { if (user) simpanPetunjuk(petunjukDari(user)); }, [user?.id, user?.role, user?.jabatan, user?.jabatanDewan, user?.status]);

  // Minta berkas dasbor peran ini lebih awal (data aplikasi masih dimuat), agar dasbor siap begitu data siap.
  useEffect(() => {
    if (!user) return;
    else if (user.role === 'penguji') muatPengujiDashboard();
    else muatAdminDashboard();
  }, [user?.role, peranUser]);

  // Klik notifikasi push membuka aplikasi di Kotak Notifikasi: lewat alamat ?buka=notifikasi (aplikasi tertutup) atau pesan service worker (sudah terbuka).
  useEffect(() => {
    if (!user) return undefined;
    const params = new URLSearchParams(window.location.search);
    if (params.get('buka') === 'notifikasi') {
      setTab('notifikasi');
      window.history.replaceState(null, '', window.location.pathname);
    }
    const tabKelola = parameterKelola(window.location.search);
    if (tabKelola) {
      if (user.role !== 'peserta') { setTab('kelolaberanda'); setTabKelolaBeranda(tabKelola); } // pensil sunting di halaman muka; Penegak tetap di beranda (hak ditegakkan server)
      window.history.replaceState(null, '', window.location.pathname);
    }
    const layanan = navigator.serviceWorker;
    const saatPesan = (e) => {
      if (e.data?.type === 'notifikasi-baru') segarkanNotifikasi(); // push tiba saat aplikasi terbuka
      if (e.data?.type !== 'buka-notifikasi') return;
      setTab('notifikasi');
      setFokusId(null);
      segarkanNotifikasi();
    };
    layanan?.addEventListener('message', saatPesan);
    return () => layanan?.removeEventListener('message', saatPesan);
  }, [user?.id, segarkanNotifikasi]);

  // Jumlah belum dibaca juga pada judul tab dan ikon aplikasi terpasang
  useEffect(() => {
    const dasar = `${APP.nama} - ${APP.kepanjangan}`;
    document.title = user && belumDibaca > 0 ? `(${belumDibaca}) ${dasar}` : dasar;
    try {
      if (user && belumDibaca > 0) navigator.setAppBadge?.(belumDibaca);
      else navigator.clearAppBadge?.();
    } catch { /* tidak didukung */ }
  }, [user, belumDibaca]);

  if (status !== 'siap') return <LayarStatus status={status} galat={galatMuat} />;
  if (!user) return <Login />;
  // PIN awal dari admin atau PIN hasil reset wajib diganti sebelum aplikasi dapat dipakai
  if (user.wajibGantiPin) return <GantiPinWajib />;
  // Akun Dewan Ambalan LAMA yang sudah diarsipkan: Dewan kini jabatan pada akun Penegak, jadi masuk memakai akun Penegak sendiri
  if (user.role === 'penguji' && (user.status ?? 'aktif') !== 'aktif') return <LayarArsip />;

  const grup = buatNav(user, peranUser, belumDibaca, pendampingan, praUjiAktif);
  const nav = grup.flatMap((g) => g.item);
  // Bila menu yang dipilih tidak ada lagi (mis. peran berubah), kembali ke menu pertama. Akun saya dan Reset PIN dibuka dari menu akun.
  const halamanAkun = tab === 'akun' || (tab === 'resetpin' && user.role !== 'peserta');
  const tabAktif = halamanAkun || nav.some((n) => n.id === tab) ? tab : nav[0].id;

  const pilihTab = (t) => {
    setTabAnggota(t === 'anggota' ? 'akun' : 'anak');
    t = aliasMenu(t);
    setTab(t);
    setFokusId(null);
    setJenisCetak('kartu');
    setMateriButir(null);
    setKelolaId(null);
  };
  /** Tombol "Materi" pada butir SKU: buka halaman Materi yang tersaring pada butir tersebut. */
  const bukaMateri = (butirId) => {
    setMateriButir(butirId);
    setFokusId(null);
    setTab('materi');
  };
  /** Dari halaman Materi ke Kelola Materi (ubah materi tertentu, atau 'baru'). */
  const bukaKelola = (id = null) => {
    setKelolaId(id);
    setFokusId(null);
    setTab('kelolamateri');
  };
  /** Pindah menu sambil membuka peserta tertentu (dari ringkasan dashboard). */
  const pindah = (t, id = null) => {
    setTabAnggota(t === 'anggota' ? 'akun' : 'anak');
    t = aliasMenu(t);
    setTab(t);
    setFokusId(id);
  };
  const bukaCetak = (id, jenis = 'kartu') => { setJenisCetak(jenis); pindah('cetak', id); };

  let isi;
  if (tabAktif === 'akun') {
    isi = <Akun />;
  } else if (tabAktif === 'resetpin' && user.role !== 'peserta') {
    isi = <ResetPin />;
  } else if (tabAktif === 'notifikasi') {
    isi = <Notifikasi idMenu={nav.map((n) => n.id)} onNav={pindah} />;
  } else if (tabAktif === 'bantuan') {
    isi = <Bantuan />;
  } else if (tabAktif === 'iuran') {
    isi = <Iuran />;
  } else if (tabAktif === 'laporan' && bolehKelolaMateri(user)) {
    isi = <Laporan />;
  } else if (tabAktif === 'gudep' && user.role === 'admin') {
    isi = <DataGudep />;
  } else if (tabAktif === 'kelolaberanda' && user.role !== 'peserta') {
    isi = <KelolaBeranda tabAwal={tabKelolaBeranda} />;
  } else if (tabAktif === 'siaga' && pembinaAtauAdmin(user)) {
    isi = <Siaga key={tabAnggota} tabAwal={tabAnggota} />;
  } else if (tabAktif === 'perlindungan' && pembinaAtauAdmin(user)) {
    isi = <Perlindungan />;
  } else if (tabAktif === 'pemeriksaan' && user.role !== 'peserta') {
    isi = <PemeriksaanData onNav={pindah} />;
  } else if (tabAktif === 'tindaklanjut' && user.role !== 'peserta') {
    isi = <TindakLanjut onNav={(id) => pindah(user.role === 'penguji' ? 'peserta' : 'rekap', id)} />;
  } else if (tabAktif === 'agenda') {
    isi = <Agenda />;
  } else if (tabAktif === 'pelantikan' && bolehKelolaMateri(user)) {
    isi = <Pelantikan />;
  } else if (tabAktif === 'materi') {
    isi = <Materi key={materiButir ?? 'semua'} butirAwal={materiButir} onKelola={bukaKelola} />;
  } else if (tabAktif === 'kelolamateri') {
    isi = <KelolaMateri key={kelolaId ?? 'daftar'} bukaId={kelolaId} />;
  } else if (tabAktif === 'cetak') {
    isi = (
      <CetakDokumen
        key={`${fokusId ?? user.id}|${jenisCetak}`}
        pesertaId={user.role === 'peserta' ? user.id : fokusId ?? undefined}
        bolehPilih={user.role !== 'peserta'}
        jenisAwal={jenisCetak}
      />
    );
  } else if (user.role === 'peserta') {
    if (tabAktif === 'sku') isi = kelasSd(user.kelas) ? <SiagaSkuSaya /> : <PesertaSku tingkat={tingkat} setTingkat={setTingkat} onBukaMateri={bukaMateri} />;
    else if (tabAktif === 'absensi') isi = <AbsensiPeserta />;
    else if (kelasSd(user.kelas)) isi = <SiagaBeranda setTab={pilihTab} />;
    else isi = <PesertaBeranda setTab={pilihTab} setTingkat={setTingkat} />;
  } else if (tabAktif === 'absensi') {
    isi = <AbsensiPengurus />;
  } else if (fokusId && kelasSd(daftarPesertaSemua.find((u) => u.id === fokusId)?.kelas)) {
    isi = <SiagaSku pesertaId={fokusId} onKembali={() => setFokusId(null)} />;
  } else if (fokusId) {
    isi = (
      <PesertaDetail
        pesertaId={fokusId}
        onKembali={() => setFokusId(null)}
        onCetak={bukaCetak}
        onBukaMateri={bukaMateri}
      />
    );
  } else if (user.role === 'penguji') {
    isi = <PengujiDashboard mode={tabAktif} onBuka={setFokusId} onNav={pindah} />;
  } else {
    isi = <AdminDashboard onBuka={setFokusId} onNav={pindah} />;
  }

  return (
    <>
      <Layout nav={nav} grup={grup} tab={tabAktif} setTab={pilihTab}>
        <BatasHalaman>{isi}</BatasHalaman>
      </Layout>
      {/* Ajakan isi nomor WhatsApp (tahap L5) untuk Pembina dan Admin: satu kali per masuk, dapat dilewati, tampil lagi pada masuk berikutnya bila masih kosong. */}
      <Modal buka={!akunSiaga && !user.whatsapp && !waTutup} tutup={() => setWaTutup(true)} judul="Isi nomor WhatsApp">
        <p className="mb-4 text-sm text-pramuka-600">
          Supaya pengurus gudep dapat menghubungi Anda bila diperlukan (mis. SKU sudah lama tidak bergerak). Boleh dilewati; akan
          ditanyakan lagi lain kali sampai diisi.
        </p>
        <FormWhatsapp onSelesai={() => setWaTutup(true)} onLewati={() => setWaTutup(true)} />
      </Modal>
    </>
  );
}

/** Aplikasi (masuk, dasbor, semua menu). Halaman muka dan halaman publik dipilih lebih dulu di src/Akar.jsx dan tidak memuat data aplikasi. */
export default function App() {
  return (
    <AppProvider>
      <Shell />
      <Toast />
      <BannerVersi />
    </AppProvider>
  );
}

