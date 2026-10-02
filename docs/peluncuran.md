# Peluncuran SIGASI: yang perlu Anda kerjakan sendiri

SIGASI (Sistem Informasi Gudep Siaga) sudah lengkap di sisi kode. Sebagian langkah peluncuran hanya dapat dikerjakan pemilik karena butuh akses
ke Supabase, GitHub, dan domain. Berkas ini daftarnya, berurutan. Jangan mengirim sandi, kunci, atau alamat sambungan ke siapa pun (termasuk asisten AI).

## Keputusan yang sudah diambil (2 Okt 2026)
- Nama aplikasi: **SIGASI** (Sistem Informasi Gudep Siaga).
- Domain: **belum ada**; situs tetap di alamat GitHub Pages sementara. Bila nanti punya domain, lihat bagian "Mengganti domain".
- Nama SD: **belum diisi**; diisi lewat menu **Data Gudep** (lihat langkah 5).

## A. Basis data dan fungsi (Supabase)
1. **Izin pemicu pada `auth.users`.** Migrasi `2026-10-siaga-anggota.sql` membuat pemicu `profil_hapus_bersama_akun` pada `auth.users` (supaya menghapus akun
   login ikut menghapus profilnya). Pemeriksaan harian GitHub ("Periksa pemasangan") melaporkan bila pemicu itu tidak ada. Bila ada laporan, jalankan
   ulang bagian pemicunya di SQL Editor Supabase (peran `postgres` di sana punya izinnya).
2. **Migrasi.** Semua migrasi `2026-10-*` (Fase 1 sampai 9) berjalan lewat langkah **migrasi** di GitHub Actions (setujui di lingkungan `produksi`).
   Pastikan GitHub > Actions > **Periksa pemasangan** > Run workflow berkata `Pemasangan sesuai dengan kode terbaru.`
3. **Deploy Edge Function `sigarda`** (manual, Dashboard Supabase > Edge Functions > `sigarda` > ganti isi dengan `supabase/functions/sigarda/index.ts` > Deploy).
   Perlu sejak Fase 2b: Pembina boleh membuat akun anak Siaga. Edge Function `notif-push` dan `galeri-sampul` tidak berubah bila sudah terpasang.

## B. GitHub
4. **Rahasia** (Settings > Secrets and variables > Actions): `SIGARDA_DB_URL` (baca-saja; pemeriksaan harian dan cadangan mingguan),
   `SIGARDA_DB_URL_TULIS` (hanya di lingkungan `produksi`; penerapan migrasi otomatis), dan empat rahasia cadangan mingguan bila ingin cadangan otomatis.
   Nama `SIGARDA_*` sengaja tidak diganti (mengganti nama berarti mengisi ulang semuanya); panduan: [penerapan-otomatis.md](penerapan-otomatis.md),
   [cadangan-otomatis.md](cadangan-otomatis.md).

## C. Isian pertama di aplikasi
5. Masuk sebagai Admin Gudep, menu **Data Gudep**: isi nama gugus depan, nama perindukan, nama sekolah (SD), nomor gudep, kota, kwartir ranting dan cabang,
   serta nama dan NTA Pembina dan Kepala Sekolah. Isian ini muncul di halaman muka, kop surat, Surat Tanda Lulus, dan piagam pelantikan.
6. Menu **Kelola Beranda** > Kontak: isi kontak yang boleh dilihat umum. Berita, galeri, dan prestasi opsional.
7. Menu **Anggota Siaga**: tambahkan anak (nama, kelas angka seperti `4` atau `5A`, perindukan, barung). Anak boleh tanpa akun (dinilai langsung Pembina) atau berakun
   (masuk dengan NIS dan PIN).
8. Pembina yang beragama: pastikan isian agama Pembina terisi (butir agama Siaga hanya dinilai Pembina seagama).

## D. Sesudah ada nama SD dan domain
Berkas yang masih memuat alamat lama dan **harus diubah bersama** bila domain berganti (dijaga uji `landing`, `sunting`, `berita-statis`):
`index.html` (canonical, Open Graph, JSON-LD), `public/robots.txt`, `public/sitemap.xml`, `ALAMAT_SITUS` di `src/landing/landingData.js`.
Gambar OG (`public/og-gudep.png`) tanpa teks, jadi tidak perlu dibuat ulang saat nama berubah. Bila memakai domain khusus, atur di GitHub > Settings > Pages dan
isi `VITE_BASE` sesuai (kosong untuk akar domain). Kirim `sitemap.xml` baru ke Google Search Console.

## E. Hal yang menunggu jawaban Kwarcab (tidak menghalangi peluncuran)
- Ambang **TKK Siaga Garuda**: Jukran 038/2017 berbunyi "4 macam dari tiap bidang" (ambigu); aplikasi memakai 4 per bidang sebagai saran saja.
- Apakah **SKK tambahan** (termasuk Cakap Keuangan) berlaku bagi Siaga; sementara tidak dipakai.
- Pengganti butir agama **Khonghucu** pada SKU Siaga ditetapkan Pembina.

## F. Yang sengaja belum dikerjakan
- Data dan fungsi SQL modul Penegak masih ada di basis data (tersembunyi, tidak dipakai). Pembuangannya butuh migrasi dan hanya dikerjakan bila Anda minta.
- Nama berkas dan nama fungsi berawalan `sigarda` (lihat catatan di README).
- QR pada piagam pelantikan Siaga (keaslian saat ini lewat tanda tangan dan stempel basah).
