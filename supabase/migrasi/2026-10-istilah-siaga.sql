-- ============================================================================
-- MIGRASI: Teks pesan galat dan notifikasi di server memakai istilah Pramuka Siaga (bukan Penegak/Dewan Ambalan). AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-10-tema-tampilan.sql (lihat README). Isi: menulis ulang fungsi yang memuat teks lama (hanya TEKS pesan yang berubah; logika,
-- tanda tangan, dan hak akses fungsi sama), mis. "Hanya Dewan Ambalan atau Pembina yang dapat menutup kas." menjadi "Hanya Pembina yang dapat menutup kas.".
-- Penggantian dilakukan atas isi fungsi yang SUDAH terpasang (daftar pasangan teks di bawah), jadi aman diulang: sesudah sekali jalan tidak ada yang berubah lagi.
-- TIDAK menghapus data. Edge Function TIDAK berubah.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Hasilnya sama dengan supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $mig$
declare
  v_peta text[] := array[
    $p$Hanya Dewan Ambalan, Pembina, atau admin yang dapat mencatat absensi.$p$,
    $p$Hanya Pembina atau admin yang dapat mencatat absensi.$p$,
    $p$Dewan Ambalan perlu mengosongkannya lebih dulu sebelum sesi dihapus.$p$,
    $p$Pembina perlu mengosongkannya lebih dulu sebelum sesi dihapus.$p$,
    $p$Hanya Dewan Ambalan atau asisten bendahara yang dapat mencatat iuran.$p$,
    $p$Hanya Pembina atau asisten bendahara yang dapat mencatat iuran.$p$,
    $p$Hanya Dewan Ambalan atau asisten bendahara yang dapat membuka lembar iuran.$p$,
    $p$Hanya Pembina atau asisten bendahara yang dapat membuka lembar iuran.$p$,
    $p$Iuran Anda sendiri dicatat oleh Dewan Ambalan.$p$,
    $p$Iuran Anda sendiri dicatat oleh Pembina.$p$,
    $p$Hanya Dewan Ambalan atau Pembina yang dapat menutup kas.$p$,
    $p$Hanya Pembina yang dapat menutup kas.$p$,
    $p$Hanya Dewan Ambalan atau Pembina yang dapat menunjuk asisten bendahara.$p$,
    $p$Hanya Pembina yang dapat menunjuk asisten bendahara.$p$,
    $p$Hanya pengurus yang dapat melihat ringkasan iuran Penegak.$p$,
    $p$Hanya pengurus yang dapat melihat ringkasan iuran anggota.$p$,
    $p$Hanya Dewan Ambalan atau Pembina yang dapat mencatat iuran susulan.$p$,
    $p$Hanya Pembina yang dapat mencatat iuran susulan.$p$,
    $p$Hanya Dewan Ambalan, Pembina, atau Admin Gudep yang dapat mengelola sesi ujian.$p$,
    $p$Hanya Pembina atau Admin Gudep yang dapat mengelola sesi ujian.$p$,
    $p$Hanya Pembina atau Dewan Ambalan yang dapat mencatat hasil.$p$,
    $p$Hanya Pembina yang dapat mencatat hasil.$p$,
    $p$Daftar penguji hanya untuk Penegak, Pembina, dan Admin Gudep.$p$,
    $p$Daftar penguji hanya untuk anggota, Pembina, dan Admin Gudep.$p$,
    $p$rombel Penegak tersebut.$p$,
    $p$rombel anggota tersebut.$p$,
    $p$Butir agama hanya dapat dinilai oleh Pembina yang seagama dengan Penegak.$p$,
    $p$Butir agama hanya dapat dinilai oleh Pembina yang seagama dengan anggota.$p$,
    $p$Hanya Admin Gudep yang dapat memperbarui rombel Penegak.$p$,
    $p$Hanya Admin Gudep yang dapat memperbarui rombel anggota.$p$,
    $p$Baris %: Penegak dengan NIS "%" tidak ditemukan.$p$,
    $p$Baris %: anggota dengan NIS "%" tidak ditemukan.$p$,
    $p$Pengajuan dibatalkan: Penegak menjadi alumni$p$,
    $p$Pengajuan dibatalkan: anggota menjadi alumni$p$,
    $p$Pengajuan dibatalkan: Penegak tidak melanjutkan Pramuka$p$,
    $p$Pengajuan dibatalkan: anggota tidak melanjutkan Pramuka$p$,
    $p$Penegak ini sudah berstatus %.$p$,
    $p$Anggota ini sudah berstatus %.$p$,
    $p$(Pembina, Admin Gudep, dan Dewan Ambalan)$p$,
    $p$(Pembina dan Admin Gudep)$p$,
    $p$(Pembina, Dewan Ambalan, dan Admin Gudep)$p$,
    $p$(Pembina dan Admin Gudep)$p$,
    $p$Hanya Pembina, Dewan Ambalan, dan Admin Gudep yang dapat melihat daftar ini.$p$,
    $p$Hanya Pembina dan Admin Gudep yang dapat melihat daftar ini.$p$,
    $p$Hubungi Pembina atau Dewan bila ada kendala.$p$,
    $p$Hubungi Pembina bila ada kendala.$p$,
    $p$Hubungi Dewan atau asisten bendahara bila ada kendala.$p$,
    $p$Hubungi Pembina atau asisten bendahara bila ada kendala.$p$,
    $p$Maksimal 500 Penegak terkait.$p$,
    $p$Maksimal 500 anggota terkait.$p$,
    $p$Salah satu Penegak terkait tidak ditemukan atau tidak aktif.$p$,
    $p$Salah satu anggota terkait tidak ditemukan atau tidak aktif.$p$
  ];
  r record; v_lama text; v_baru text; i int;
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'sigarda') and p.prokind = 'f'
  loop
    v_lama := pg_get_functiondef(r.oid);
    v_baru := v_lama;
    for i in 1 .. array_length(v_peta, 1) / 2 loop
      v_baru := replace(v_baru, v_peta[2 * i - 1], v_peta[2 * i]);
    end loop;
    if v_baru <> v_lama then execute v_baru; end if;
  end loop;
end $mig$;

revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
