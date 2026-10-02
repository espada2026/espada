import { useCallback, useEffect, useRef, useState } from 'react';
import { ambilIndeksHalamanBerita, panggilRpcPublik } from '../lib/publikClient';
import { petaHalamanBerita } from '../lib/beritaStatisLogic';
import { gabungBerita, gabungKartu, susunBerandaPublik, susunBeritaLagi, susunKartuLagi } from '../lib/berandaLogic';
import { tambahGudep } from '../lib/gudepStore';

/**
 * Isi halaman muka yang diatur pengurus dan agenda mendatang, dimuat tanpa login (sg_beranda_publik). Selama belum datang (atau bila gagal) isinya kosong
 * dan halaman menampilkan bagian tetapnya saja. Identitas gudep dari server (nama, ambalan, alamat) ikut memperbarui data gudep bersama.
 * Berita yang lebih lama dimuat atas permintaan (`muatLagi`, sg_berita_lagi, 6 demi 6); `berita` = 6 terbaru + yang sudah dimuat, tanpa kembar.
 * Prestasi, galeri, dan media sosial berperilaku sama (sg_prestasi_lagi, sg_galeri_lagi, sg_sosial_lagi): masing-masing 6 terbaru + gelombang lebih lama, lewat `lagi.<jenis>`
 * = { ada, memuat, galat, muat }.
 * Ikut dimuat indeks halaman berita statis (`halaman`: kunci berita -> alamat) supaya kartu berita hanya menaut ke halaman yang sudah ada. `panggil` dan `ambilIndeks` dapat diganti untuk uji.
 */
const FUNGSI_LAGI = { prestasi: 'sg_prestasi_lagi', galeri: 'sg_galeri_lagi', sosial: 'sg_sosial_lagi' };

/** Satu jenis kartu (prestasi, galeri, atau media sosial): 6 dari sg_beranda_publik + gelombang lebih lama sesuai permintaan, tanpa kembar. */
function useKartuLagi(panggil, jenis, awal) {
  const [lama, setLama] = useState([]);
  const [adaLagi, setAdaLagi] = useState(null); // null = belum tahu; hanya bermakna bila 6 yang pertama penuh
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState(false);
  const sedang = useRef(false);
  const daftar = gabungKartu(jenis, awal, lama);
  const muat = useCallback(async () => {
    if (sedang.current) return;
    sedang.current = true;
    setMemuat(true);
    setGalat(false);
    const r = await panggil(FUNGSI_LAGI[jenis], { p_lewati: daftar.length });
    if (r.ok) {
      const d = susunKartuLagi(jenis, r.data);
      setLama((sebelum) => [...sebelum, ...d.daftar]);
      setAdaLagi(d.adaLagi);
    } else {
      setGalat(true);
    }
    setMemuat(false);
    sedang.current = false;
  }, [panggil, jenis, daftar.length]);
  return { daftar, lagi: { ada: adaLagi ?? awal.length >= 6, memuat, galat, muat } };
}

export default function useBerandaPublik(panggil = panggilRpcPublik, ambilIndeks = ambilIndeksHalamanBerita) {
  const [data, setData] = useState(() => susunBerandaPublik(null));
  const [halaman, setHalaman] = useState({});
  const [memuat, setMemuat] = useState(true);
  const [lama, setLama] = useState([]);
  const [adaLagi, setAdaLagi] = useState(null); // null = belum tahu (pastikan lewat permintaan pertama); hanya bermakna bila 6 berita terbaru penuh
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [galatLagi, setGalatLagi] = useState(false);
  const sedangMuat = useRef(false);
  useEffect(() => {
    let batal = false;
    (async () => {
      const [r, indeks] = await Promise.all([panggil('sg_beranda_publik'), ambilIndeks()]);
      if (batal) return;
      setHalaman(petaHalamanBerita(indeks));
      if (r.ok) {
        const d = susunBerandaPublik(r.data);
        setData(d);
        if (Object.keys(d.gudep).length) tambahGudep(d.gudep);
      }
      setMemuat(false);
      // tema tampilan gudep (hanya sg_gudep_publik yang memuatnya); gagal = tema tersimpan di perambah tetap dipakai
      Promise.resolve(panggil('sg_gudep_publik')).then((t) => { if (!batal && t?.ok) tambahGudep(t.data); }).catch(() => {});
    })();
    return () => { batal = true; };
  }, [panggil, ambilIndeks]);
  const berita = gabungBerita(data.berita, lama);
  const prestasi = useKartuLagi(panggil, 'prestasi', data.prestasi);
  const galeri = useKartuLagi(panggil, 'galeri', data.galeri);
  const sosial = useKartuLagi(panggil, 'sosial', data.sosial);
  const muatLagi = useCallback(async () => {
    if (sedangMuat.current) return;
    sedangMuat.current = true;
    setMemuatLagi(true);
    setGalatLagi(false);
    const r = await panggil('sg_berita_lagi', { p_lewati: berita.length });
    if (r.ok) {
      const d = susunBeritaLagi(r.data);
      setLama((sebelum) => [...sebelum, ...d.berita]);
      setAdaLagi(d.adaLagi);
    } else {
      setGalatLagi(true);
    }
    setMemuatLagi(false);
    sedangMuat.current = false;
  }, [panggil, berita.length]);
  return { ...data, berita, prestasi: prestasi.daftar, galeri: galeri.daftar, sosial: sosial.daftar, lagi: { prestasi: prestasi.lagi, galeri: galeri.lagi, sosial: sosial.lagi }, halaman, memuat, adaLagi: adaLagi ?? data.berita.length >= 6, memuatLagi, galatLagi, muatLagi };
}
