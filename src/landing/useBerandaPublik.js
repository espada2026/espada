import { useCallback, useEffect, useRef, useState } from 'react';
import { ambilIndeksHalamanBerita, panggilRpcPublik } from '../lib/publikClient';
import { petaHalamanBerita } from '../lib/beritaStatisLogic';
import { gabungBerita, susunBerandaPublik, susunBeritaLagi } from '../lib/berandaLogic';
import { tambahGudep } from '../lib/gudepStore';

/**
 * Isi halaman muka yang diatur pengurus dan agenda mendatang, dimuat tanpa login (sg_beranda_publik). Selama belum datang (atau bila gagal) isinya kosong
 * dan halaman menampilkan bagian tetapnya saja. Identitas gudep dari server (nama, ambalan, alamat) ikut memperbarui data gudep bersama.
 * Berita yang lebih lama dimuat atas permintaan (`muatLagi`, sg_berita_lagi, 6 demi 6); `berita` = 6 terbaru + yang sudah dimuat, tanpa kembar.
 * Ikut dimuat indeks halaman berita statis (`halaman`: kunci berita -> alamat) supaya kartu berita hanya menaut ke halaman yang sudah ada. `panggil` dan `ambilIndeks` dapat diganti untuk uji.
 */
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
    })();
    return () => { batal = true; };
  }, [panggil, ambilIndeks]);
  const berita = gabungBerita(data.berita, lama);
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
  return { ...data, berita, halaman, memuat, adaLagi: adaLagi ?? data.berita.length >= 6, memuatLagi, galatLagi, muatLagi };
}
