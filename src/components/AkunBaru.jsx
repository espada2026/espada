import { useState } from 'react';
import { Icon, Modal } from './ui';

/** Menampilkan nama pengguna dan PIN awal akun baru satu kali, agar admin dapat menyampaikannya. */
export default function AkunBaru({ akun, onTutup }) {
  const [tersalin, setTersalin] = useState(false);
  const salin = async () => {
    try {
      await navigator.clipboard.writeText(`Nama pengguna: ${akun.username}\nPIN awal: ${akun.pin}`);
      setTersalin(true);
    } catch {
      setTersalin(false);
    }
  };
  return (
    <Modal buka tutup={onTutup} judul="Akun dibuat" aksi={<button className="btn btn-primary" onClick={onTutup}>Selesai</button>}>
      <p className="text-sm text-pramuka-700">
        Akun untuk <span className="font-semibold">{akun.nama}</span> berhasil dibuat. Catat data masuk berikut. PIN hanya tampil sekali.
      </p>
      <dl className="mt-3 divide-y divide-pramuka-100 rounded-lg border border-pramuka-200 text-sm">
        <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-pramuka-600">Nama pengguna</dt><dd className="font-mono font-bold">{akun.username}</dd></div>
        <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-pramuka-600">PIN awal</dt><dd className="font-mono font-bold tracking-widest">{akun.pin}</dd></div>
      </dl>
      <button className="btn btn-outline btn-sm mt-3" onClick={salin}><Icon nama="salin" className="h-4 w-4" /> {tersalin ? 'Tersalin' : 'Salin'}</button>
      <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-950">
        Bagikan langsung kepada yang bersangkutan. Saat masuk pertama kali, PIN ini wajib diganti dengan PIN pilihannya sendiri.
      </p>
    </Modal>
  );
}
