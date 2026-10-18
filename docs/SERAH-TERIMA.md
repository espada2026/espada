# Serah-terima: SIGASI (Sistem Informasi Gudep Siaga)

Disusun 18 Okt 2026 untuk melanjutkan pekerjaan di akun Claude yang baru. Berkas ini menggantikan riwayat percakapan. Baca juga `CLAUDE.md` (aturan kerja, arsitektur, catatan per fase), `docs/peluncuran.md` (daftar tindakan pemilik) dan `docs/duplikasi-proyek.md` (cara salinan ini dibuat dari SIGARDA).

Sumber: `CLAUDE.md`, `docs/peluncuran.md`, `docs/duplikasi-proyek.md`, dan konfigurasi git lokal folder `espada`. Hal yang tidak bisa dipastikan dari berkas ditandai **[perlu dikonfirmasi]**.

## 1. Status terakhir

- SIGASI adalah **salinan SIGARDA yang diubah untuk Pramuka Siaga** (anak SD), berdiri sendiri: repositori `espada2026/espada` (cabang `main`) dan proyek Supabase tersendiri. Data Penegak asli tidak dibawa; mulai dari database kosong. Folder lokal: `...\App Project\espada`.
- Stack sama dengan SIGARDA: React 18 + Vite 5 + Tailwind 3, Supabase (Postgres, Auth, Edge Function `sigarda`, ditambah `notif-push` dan `galeri-sampul`). Dokumentasi menyebut penerbitan lewat GitHub Pages.
- **Nama final SIGASI dikukuhkan pemilik pada 2 Okt 2026.** Domain **belum ada**; nama SD **belum diisi** (diisi lewat menu Data Gudep). Alamat SEO, `ALAMAT_SITUS`, dan identitas gudep sengaja dibiarkan netral.
- **Fase 1 sampai 11 selesai di sisi kode** (menurut `CLAUDE.md`): akun dan anggota Siaga (termasuk anak tanpa akun yang dinilai langsung Pembina), SKU Siaga, latihan dan tabungan (sesi dan iuran hari apa pun), TKK Siaga satu tingkat, pelantikan Siaga (Mula, Bantu, Tata), Siaga Garuda (enam butir Jukran Kwarnas 038/2017, dinilai Pembina tanpa tim Kwarcab), beranda dan dasbor Siaga, kegiatan Siaga di Agenda (Pesta Siaga, Persari, Pertemuan Siaga, Pelantikan Siaga), dasbor Admin, laporan dan dokumen Siaga, pembersihan modul Penegak di sisi klien, peluncuran.
- Sesudah Fase 11: menu **Anggota** disatukan (Pembina dan Admin; tab "Akun masuk" untuk Admin) dan sisa tampilan Penegak yang masih terlihat dibuang dari klien.
- Istilah: awalan **Perindukan** (bukan Ambalan) untuk nama kelompok.
- Pengaman otomatisasi: workflow migrasi, cadangan, dan pemeriksaan harian punya syarat `github.repository == 'tribudi3267/sigarda'`, jadi di repositori salinan semuanya **mati** sampai syaratnya diubah (Tahap 5 di `docs/duplikasi-proyek.md`). **[perlu dikonfirmasi]** apakah syarat itu sudah diubah ke `espada2026/espada`.

## 2. Yang sedang dikerjakan

Tidak ada pekerjaan terbuka di kode yang bisa dipastikan dari berkas. Pekerjaan terakhir yang tercatat adalah pembersihan sisa tampilan Penegak sesudah Fase 11 (`CLAUDE.md`). Daftar tindakan peluncuran yang menunggu pemilik ada di `docs/peluncuran.md`.

Catatan: `CLAUDE.md` SIGASI juga merujuk berkas memori `ide-penugasan-penguji-per-kelas.md` dan `rencana-pra-uji-berjenjang.md`, yang berasal dari SIGARDA. Rencana itu mungkin tidak relevan untuk Siaga; **[perlu dikonfirmasi]** bila salinannya diperlukan di sini.

## 3. Langkah berikutnya

Kerjakan berurutan; sebagian hanya bisa dilakukan pemilik (butuh akses Supabase, GitHub, domain).

1. **Basis data dan fungsi (Supabase).** Pastikan migrasi `2026-10-*` (Fase 1 sampai 9) sudah berjalan: workflow **Periksa pemasangan** di GitHub Actions harus berkata `Pemasangan sesuai dengan kode terbaru.` Pastikan juga pemicu `profil_hapus_bersama_akun` pada `auth.users` ada (jalankan ulang bagiannya di SQL Editor Supabase bila dilaporkan hilang).
2. **Deploy Edge Function `sigarda`** secara manual (Dashboard Supabase, Edge Functions, `sigarda`, ganti isi dengan `supabase/functions/sigarda/index.ts`). Wajib sejak Fase 2b agar Pembina bisa membuat akun anak Siaga.
3. **Rahasia GitHub** (Settings, Secrets and variables, Actions): `SIGARDA_DB_URL` (baca-saja), `SIGARDA_DB_URL_TULIS` (hanya di lingkungan `produksi`), dan empat rahasia cadangan mingguan bila ingin cadangan otomatis. Nama `SIGARDA_*` sengaja tidak diganti. Nilainya harus baru dari proyek Supabase SIGASI; jangan menempel nilai dari proyek SIGARDA.
4. **Isian pertama di aplikasi** (Admin Gudep): menu **Data Gudep** (nama gugus depan, perindukan, nama SD, nomor gudep, kota, kwartir ranting dan cabang, nama dan NTA Pembina dan Kepala Sekolah), **Kelola Beranda** (kontak), **Anggota** (tambah anak: nama, kelas seperti `4` atau `5A`, perindukan, barung; boleh tanpa akun atau berakun dengan NIS dan PIN), dan isian agama Pembina (butir agama dinilai Pembina seagama).
5. **Setelah nama SD dan domain ada:** ubah bersama `index.html` (canonical, Open Graph, JSON-LD), `public/robots.txt`, `public/sitemap.xml`, dan `ALAMAT_SITUS` di `src/landing/landingData.js`; atur domain di GitHub Settings, Pages dan isi `VITE_BASE`; kirim `sitemap.xml` baru ke Google Search Console.
6. **Menunggu jawaban Kwarcab** (tidak menghalangi peluncuran): ambang TKK Siaga Garuda ("4 macam dari tiap bidang" ambigu; sementara 4 per bidang sebagai saran), apakah SKK tambahan (termasuk Cakap Keuangan) berlaku bagi Siaga, dan pengganti butir agama Khonghucu pada SKU Siaga (sementara ditetapkan Pembina).
7. **Sengaja belum dikerjakan:** pembuangan data dan fungsi SQL modul Penegak dari basis data (butuh migrasi; hanya bila pemilik minta, termasuk pengingat harian `musyawarah_pengingat`, `kegiatan_pengingat`, `pra_uji_pengingat`, `garuda_kalender_pengingat`), penggantian nama berkas dan fungsi berawalan `sigarda`, dan QR pada piagam pelantikan Siaga (keaslian saat ini lewat tanda tangan dan stempel basah).

## 4. Keputusan penting yang sudah diambil

- Nama aplikasi **SIGASI**; domain dan nama SD ditunda; identitas gudep netral sampai diisi pemilik.
- Salinan dan SIGARDA asli **tidak berbagi apa pun**: repositori, proyek Supabase, kunci, frasa enkripsi, folder Drive. Periksa `git remote -v` sebelum setiap `git push`.
- Nama berawalan `sigarda` (skema `sigarda.*`, Edge Function, rahasia `SIGARDA_*`, `Cadangkan-SIGARDA.bat`) **sengaja tidak diganti**.
- TKK Siaga **satu tingkat saja**, terpisah dari TKK Penegak; Siaga Garuda dinilai Pembina perseorangan, tanpa tim Kwarcab.
- Arsitektur sama dengan SIGARDA: RLS hanya baca, penulisan lewat fungsi `sg_*`, sumber skema di `supabase/sumber/`, migrasi aditif. Aturan kerja pemilik: balasan, komentar, teks layar, dan pesan commit dalam Bahasa Indonesia; jangan commit atau push kecuali diminta; jangan mengetik PIN atau kata sandi asli; `npm run build` dan `npm run uji` harus lulus.
- Jangan mengirim sandi, kunci, atau alamat sambungan basis data ke siapa pun, termasuk asisten AI.

## 5. Yang harus dilakukan sebelum pindah akun

- Berkas memori proyek tidak ada di folder project. Bila ada yang khusus untuk SIGASI, salin ke `docs/memori/` (dengan akun lama: minta Claude Code menyalin berkas memori proyek ke folder itu), lalu commit.
- Simpan salinan `.env.lokal` di tempat aman (tidak ikut git).
- Pastikan akun baru punya akses ke repositori `espada2026/espada` dan proyek Supabase SIGASI.
