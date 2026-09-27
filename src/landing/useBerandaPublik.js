import { useEffect, useState } from 'react';
import { panggilRpcPublik } from '../lib/publikClient';
import { susunBerandaPublik } from '../lib/berandaLogic';
import { tambahGudep } from '../lib/gudepStore';

/**
 * Isi halaman muka yang diatur pengurus dan agenda mendatang, dimuat tanpa login (sg_beranda_publik). Selama belum datang (atau bila gagal) isinya kosong
 * dan halaman menampilkan bagian tetapnya saja. Identitas gudep dari server (nama, ambalan, alamat) ikut memperbarui data gudep bersama.
 * `panggil` dapat diganti untuk uji.
 */
export default function useBerandaPublik(panggil = panggilRpcPublik) {
  const [data, setData] = useState(() => susunBerandaPublik(null));
  const [memuat, setMemuat] = useState(true);
  useEffect(() => {
    let batal = false;
    (async () => {
      const r = await panggil('sg_beranda_publik');
      if (batal) return;
      if (r.ok) {
        const d = susunBerandaPublik(r.data);
        setData(d);
        if (Object.keys(d.gudep).length) tambahGudep(d.gudep);
      }
      setMemuat(false);
    })();
    return () => { batal = true; };
  }, [panggil]);
  return { ...data, memuat };
}
