import { useEffect, useState } from 'react';
import { ambilIndeksHalamanBerita, panggilRpcPublik } from '../lib/publikClient';
import { petaHalamanBerita } from '../lib/beritaStatisLogic';
import { susunBerandaPublik } from '../lib/berandaLogic';
import { tambahGudep } from '../lib/gudepStore';

/**
 * Isi halaman muka yang diatur pengurus dan agenda mendatang, dimuat tanpa login (sg_beranda_publik). Selama belum datang (atau bila gagal) isinya kosong
 * dan halaman menampilkan bagian tetapnya saja. Identitas gudep dari server (nama, ambalan, alamat) ikut memperbarui data gudep bersama.
 * Ikut dimuat indeks halaman berita statis (`halaman`: kunci berita -> alamat) supaya kartu berita hanya menaut ke halaman yang sudah ada. `panggil` dan `ambilIndeks` dapat diganti untuk uji.
 */
export default function useBerandaPublik(panggil = panggilRpcPublik, ambilIndeks = ambilIndeksHalamanBerita) {
  const [data, setData] = useState(() => susunBerandaPublik(null));
  const [halaman, setHalaman] = useState({});
  const [memuat, setMemuat] = useState(true);
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
  return { ...data, halaman, memuat };
}
