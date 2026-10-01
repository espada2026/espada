import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

/**
 * TKK satu anak Siaga (tanggal terbaru dulu), dimuat saat komponen tampil dan saat `pesertaId` berganti. `muat()` memuat ulang (sesudah mencatat atau menghapus).
 * `galat` terisi bila basis data belum dimigrasi (datanya kosong).
 */
export default function useTkkSiaga(pesertaId) {
  const { api } = useApp();
  const [s, setS] = useState({ untuk: null, baris: [], galat: '' });
  const muat = useCallback(async () => {
    if (!pesertaId) return;
    const r = await api().muatTkkSiaga(pesertaId);
    setS({ untuk: pesertaId, baris: r.ok ? r.data : [], galat: r.ok ? '' : r.pesan ?? 'Data TKK tidak dapat dimuat.' });
  }, [api, pesertaId]);
  useEffect(() => { muat(); }, [muat]);
  const siap = s.untuk === pesertaId;
  return { baris: siap ? s.baris : [], memuat: !siap, galat: siap ? s.galat : '', muat };
}
