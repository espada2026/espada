-- ============================================================================
-- MIGRASI: pembersihan riwayat penjadwal (pg_cron). AMAN untuk database berisi data.
--
-- Jalankan SETELAH migrasi sebelumnya (sampai 2026-09-muat-lebih-lama.sql; lihat README). Isi:
--   * sigarda.notif_pengingat (pengingat harian 07.00 WIB) ditulis ulang (tanda tangan sama) agar juga menghapus riwayat pg_cron
--     (cron.job_run_details) yang lebih dari 30 hari. Pekerjaan sigarda-terbit-ulang berjalan tiap 5 menit dan tabel itu tidak dibersihkan siapa pun.
--     Tanpa pg_cron atau tanpa izin, pengingat harian tetap berjalan seperti biasa.
-- TIDAK mengubah tabel maupun data aplikasi. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regprocedure('sigarda.garuda_kalender_pengingat()') is null or to_regprocedure('public.sg_galeri_lagi(int)') is null then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (sampai 2026-09-muat-lebih-lama.sql; lihat README), baru migrasi ini.';
  end if;
end $$;

-- ===== Pembersihan riwayat penjadwal: pengingat ===== (penanda kedelapan, fungsi SAMA; dipakai migrasi pembersihan riwayat cron)
-- Pengingat harian (dijalankan pg_cron pukul 07.00 WIB): pengujian dan sesi ujian besok, pengajuan yang menunggu lebih dari 3 hari,
-- cadangan data yang sudah sebulan tidak diunduh (tahap L4), tangga eskalasi tidak bergerak (tahap L5), agenda tahunan H-30/H-7/H-1
-- (tahap L6), usulan Musyawarah Ambalan belum terjadwal H-60 lalu tiap 14 hari (tahap L6b), usulan 10 kegiatan lain belum terjadwal
-- H-30/H-60 lalu tiap 14 hari (tahap L6b, juga di luar jam senyap karena selalu berjalan 07.00 WIB), dan pembersihan notifikasi
-- berumur lebih dari 90 hari, dan tahap kalender seleksi Garuda H-7/H-3/H-1/hari-H serta berakhir besok (Tahap 2, G4d). Kunci membuat tiap pengingat terkirim sekali walau dijalankan berulang.
create or replace function sigarda.notif_pengingat() returns void language plpgsql security definer set search_path = public as
$$
declare v_besok date := sigarda.hari_ini() + 1; r record; v_x uuid; v_label text;
begin
  for r in select sp.peserta_id, sp.sku_id, sp.penguji_id, sp.jadwal, p.nama from public.sku_progress sp join public.profiles p on p.id = sp.peserta_id
           where sp.status in ('diajukan', 'proses') and sp.jadwal = v_besok loop
    v_label := sigarda.notif_label_butir(r.sku_id);
    perform sigarda.notif_buat(r.peserta_id, 'pengingat', 'Pengujian besok', v_label || ' dijadwalkan besok.', '{"tab":"sku"}', 'h1:' || r.peserta_id || ':' || r.sku_id || ':' || r.jadwal);
    for v_x in select * from sigarda.notif_penerima_uji(r.peserta_id, r.sku_id, r.penguji_id) loop
      perform sigarda.notif_buat(v_x, 'pengingat', 'Pengujian besok', r.nama || ', ' || v_label, '{"tab":"antrian"}', 'h1:' || r.peserta_id || ':' || r.sku_id || ':' || r.jadwal);
    end loop;
  end loop;
  for r in select sp.peserta_id, sp.sku_id, sp.penguji_id, p.nama, sp.diubah from public.sku_progress sp join public.profiles p on p.id = sp.peserta_id
           where sp.status = 'diajukan' and sp.diubah < now() - interval '3 days' loop
    v_label := sigarda.notif_label_butir(r.sku_id);
    for v_x in select * from sigarda.notif_penerima_uji(r.peserta_id, r.sku_id, r.penguji_id) loop
      perform sigarda.notif_buat(v_x, 'lama', 'Pengajuan menunggu lebih dari 3 hari', r.nama || ', ' || v_label, '{"tab":"antrian"}',
        'lama:' || r.peserta_id || ':' || r.sku_id || ':' || extract(epoch from r.diubah)::bigint);
    end loop;
  end loop;
  for r in select s.id, s.nama, s.tanggal, sp.peserta_id from public.sesi_ujian s join public.sesi_ujian_peserta sp on sp.sesi_id = s.id
           where s.status = 'terjadwal' and s.tanggal = v_besok loop
    perform sigarda.notif_buat(r.peserta_id, 'pengingat', 'Ujian bersama besok', r.nama, '{"tab":"beranda"}', 'sesi-h1:' || r.id || ':' || r.tanggal);
  end loop;
  if not exists (
    select 1 from public.pengaturan where kunci = 'cadangan.terakhir' and (nilai ->> 'pada')::timestamptz > now() - interval '30 days'
  ) then
    for v_x in select id from public.profiles where role = 'admin' and status = 'aktif' loop
      perform sigarda.notif_buat(v_x, 'pengingat', 'Waktunya cadangan data',
        'Sudah lebih dari sebulan sejak cadangan terakhir (atau belum pernah). Unduh dari menu Data Gudep.', '{"tab":"gudep"}',
        'cadangan:' || to_char(now(), 'YYYY-MM'));
    end loop;
  end if;
  perform sigarda.eskalasi_proses();
  perform sigarda.agenda_proses();
  perform sigarda.musyawarah_pengingat();
  perform sigarda.kegiatan_pengingat();
  perform sigarda.pra_uji_pengingat();
  perform sigarda.garuda_kalender_pengingat();
  -- Riwayat pg_cron (cron.job_run_details) hanya 30 hari terakhir: pekerjaan sigarda-terbit-ulang berjalan tiap 5 menit dan tabel itu
  -- tidak dibersihkan siapa pun. Dijaga: tanpa pg_cron atau tanpa izin, pengingat harian tetap berjalan.
  if to_regclass('cron.job_run_details') is not null then
    begin
      execute 'delete from cron.job_run_details where end_time < now() - interval ''30 days''';
    exception when others then null;
    end;
  end if;
  delete from public.notifikasi where dibuat < now() - interval '90 days';
end $$;
-- ===== akhir pengingat cadangan =====
-- ===== akhir pengingat eskalasi =====
-- ===== akhir pengingat agenda =====
-- ===== akhir pengingat usulan musyawarah =====
-- ===== akhir pengingat usulan kegiatan lain =====
-- ===== akhir pengingat pra-uji =====
-- ===== akhir pengingat kalender garuda =====
-- ===== akhir pembersihan riwayat penjadwal =====

-- Fungsi sigarda.* diperbarui: hak dijalankan ulang di sini.
revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
