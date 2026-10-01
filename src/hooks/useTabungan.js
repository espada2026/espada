import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

/**
 * Pemeriksaan tabungan satu anak Siaga (tanggal terbaru dulu), dimuat saat komponen tampil dan saat `pesertaId` berganti.
 * `muat()` memuat ulang (dipakai sesudah mencatat atau menghapus). `galat` terisi bila basis data belum dimigrasi (datanya kosong).
 */
export default function useTabungan(pesertaId) {
  const { api } = useApp();
  const [s, setS] = useState({ untuk: null, baris: [], galat: '' });
  const muat = useCallback(async () => {
    if (!pesertaId) return;
    const r = await api().muatTabungan(pesertaId);
    setS({ untuk: pesertaId, baris: r.ok ? r.data : [], galat: r.ok ? '' : r.pesan ?? 'Data tabungan tidak dapat dimuat.' });
  }, [api, pesertaId]);
  useEffect(() => { muat(); }, [muat]);
  const siap = s.untuk === pesertaId;
  return { baris: siap ? s.baris : [], memuat: !siap, galat: siap ? s.galat : '', muat };
}
