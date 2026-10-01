-- ============================================================================
-- MIGRASI: Pramuka Siaga, Fase 8: kegiatan Siaga di Agenda dan pengingat yang cocok untuk Siaga. AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-10-siaga-garuda.sql (lihat README). Isi:
--   * Kendala jenis pada public.agenda diperluas: 'pesta_siaga', 'persari', 'pertemuan_siaga' (pertemuan Siaga di kwartir), 'pelantikan_siaga'.
--     Kolom peserta_terkait pada jenis-jenis itu dipakai sebagai daftar anak yang IKUT (dasar saran butir 4 dan 5 Siaga Garuda di aplikasi).
--   * sg_agenda_simpan ditulis ulang (tanda tangan sama): menerima empat jenis baru.
--   * Pengingat: kalimat eskalasi tidak lagi menyebut "Jumat"; anak Siaga TANPA AKUN (tidak punya akun untuk diingatkan) kini ikut: hanya kejadian absensi
--     (2 sesi terakhir Alpa) dan hanya pada tingkat mendesak (hari 8+), memberi tahu pengurus dan muncul di Tindak Lanjut (baris diberi tanda tanpaAkun).
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regclass('public.siaga_garuda') is null then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (sampai 2026-10-siaga-garuda.sql; lihat README), baru migrasi ini.';
  end if;
end $$;

alter table public.agenda drop constraint if exists agenda_jenis_check;
alter table public.agenda add constraint agenda_jenis_check check (jenis in (
  'musyawarah','naik_kelas','sidang','pelantikan_bantara','pelantikan_laksana','pelantikan_garuda','lainnya',
  'pengembaraan','perkemahan','gelora_saka_expo','gladi_tangguh_1','gladi_tangguh_2','penempuhan_sku_laksana','ptgd','pembekalan_dewan',
  'pesta_siaga','persari','pertemuan_siaga','pelantikan_siaga'
));

create or replace function public.sg_agenda_simpan(
  p_id bigint, p_tahun_ajaran text, p_jenis text, p_judul text, p_tanggal date, p_keterangan text default '',
  p_peserta_terkait uuid[] default '{}', p_lewati_batas boolean default false
) returns bigint language plpgsql security definer set search_path = public as
$$
declare
  v_judul text := sigarda.rapikan(p_judul); v_ket text := btrim(coalesce(p_keterangan, ''));
  v_ids uuid[]; v_id uuid; v_lewati boolean := false; v_hasil_id bigint;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat mengatur agenda.'; end if;
  if not sigarda.tahun_ajaran_sah(p_tahun_ajaran) then raise exception 'Tahun ajaran tidak sah. Contoh: 2026/2027.'; end if;
  if p_jenis not in (
    'musyawarah','naik_kelas','sidang','pelantikan_bantara','pelantikan_laksana','pelantikan_garuda','lainnya',
    'pengembaraan','perkemahan','gelora_saka_expo','gladi_tangguh_1','gladi_tangguh_2','penempuhan_sku_laksana','ptgd','pembekalan_dewan',
    'pesta_siaga','persari','pertemuan_siaga','pelantikan_siaga'
  ) then
    raise exception 'Jenis kegiatan tidak dikenal.';
  end if;
  if v_judul = '' then raise exception 'Judul wajib diisi.'; end if;
  if char_length(v_judul) > 120 then raise exception 'Judul maksimal 120 karakter.'; end if;
  if p_tanggal is null then raise exception 'Tanggal wajib diisi.'; end if;
  if char_length(v_ket) > 500 then raise exception 'Keterangan maksimal 500 karakter.'; end if;

  -- lewati_batas hanya berlaku bila pemanggil benar Pembina (bukan Admin, bukan Dewan/Penegak).
  if p_lewati_batas is true and sigarda.pembina_saja() then
    v_lewati := true;
  end if;
  if p_jenis = 'musyawarah' and not v_lewati and p_tanggal >= sigarda.agenda_batas_musyawarah(p_tahun_ajaran) then
    raise exception 'Musyawarah Ambalan harus dijadwalkan sebelum 1 Juli % (sebelum tahun ajaran baru dan Naik Kelas). Hanya Pembina yang dapat melewati batas ini, atas usulan Dewan Ambalan.', split_part(p_tahun_ajaran, '/', 2);
  end if;

  v_ids := coalesce((select array_agg(distinct x) from unnest(p_peserta_terkait) x), '{}');
  if cardinality(v_ids) > 500 then raise exception 'Maksimal 500 Penegak terkait.'; end if;
  foreach v_id in array v_ids loop
    if not exists (select 1 from public.profiles where id = v_id and role = 'peserta' and status = 'aktif') then
      raise exception 'Salah satu Penegak terkait tidak ditemukan atau tidak aktif.';
    end if;
  end loop;

  if p_id is null then
    insert into public.agenda (tahun_ajaran, jenis, judul, tanggal, keterangan, peserta_terkait, lewati_batas, dibuat_oleh)
      values (p_tahun_ajaran, p_jenis, v_judul, p_tanggal, v_ket, v_ids, v_lewati, auth.uid())
      returning id into v_hasil_id;
  else
    update public.agenda set tahun_ajaran = p_tahun_ajaran, jenis = p_jenis, judul = v_judul, tanggal = p_tanggal,
      keterangan = v_ket, peserta_terkait = v_ids, lewati_batas = v_lewati, diubah_pada = now()
      where id = p_id;
    if not found then raise exception 'Kegiatan agenda tidak ditemukan.'; end if;
    v_hasil_id := p_id;
  end if;
  return v_hasil_id;
end $$;

create or replace function sigarda.eskalasi_isi(p_jenis text, p_tingkat int, p_mulai date) returns text language sql stable as
$$
  select case p_jenis || p_tingkat
    when 'sku1' then 'Belum ada pengajuan atau hasil baru sejak ' || to_char(p_mulai - 7, 'DD-MM-YYYY') || '.'
    when 'sku2' then 'Sudah beberapa hari tidak ada aktivitas SKU. Sempatkan mengajukan butir berikutnya.'
    when 'sku3' then 'Sudah lama tidak ada aktivitas SKU. Hubungi Pembina atau Dewan bila ada kendala.'
    when 'absensi1' then 'Tidak hadir latihan terakhir tanpa keterangan.'
    when 'absensi2' then 'Sudah 2 kali berturut-turut tidak hadir latihan tanpa keterangan.'
    when 'absensi3' then 'Sudah lama tidak hadir latihan tanpa keterangan. Hubungi Pembina atau Dewan bila ada kendala.'
    when 'iuran1' then 'Iuran latihan terakhir belum tercatat.'
    when 'iuran2' then 'Sudah 2 kali berturut-turut iuran belum tercatat.'
    when 'iuran3' then 'Sudah lama iuran belum tercatat. Hubungi Dewan atau asisten bendahara bila ada kendala.'
  end
$$;

create or replace function sigarda.eskalasi_proses() returns void language plpgsql security definer set search_path = public as
$$
declare v_hari date := sigarda.hari_ini(); r record; v_mulai date; v_elapsed int; v_tingkat int; v_x uuid;
begin
  -- Anak Siaga tanpa akun (tanpa_akun) tidak punya akun untuk diingatkan: hanya satu kejadian (absensi, 2 sesi terakhir Alpa) dan hanya pada tingkat
  -- mendesak (hari 8+) memberi tahu pengurus, tanpa notifikasi ke anak. SKU dan iuran tidak dipakai (SKU dinilai langsung Pembina; tabungan tidak = iuran).
  for r in select id, nama from public.profiles where role = 'peserta' and status = 'aktif' and tanpa_akun loop
    v_mulai := sigarda.eskalasi_mulai_absensi(r.id);
    continue when v_mulai is null;
    v_elapsed := v_hari - v_mulai;
    continue when sigarda.eskalasi_tingkat(v_elapsed) < 3;
    for v_x in select id from public.profiles where status = 'aktif' and (role in ('penguji','admin') or (role = 'peserta' and jabatan_dewan is not null)) loop
      perform sigarda.notif_buat(v_x, 'eskalasi', 'Perlu tindak lanjut: ' || r.nama, sigarda.eskalasi_isi('absensi', 3, v_mulai),
        '{"tab":"tindaklanjut"}', 'eskalasi-p:absensi:' || r.id || ':' || v_hari);
    end loop;
  end loop;
  for r in select id, nama from public.profiles where role = 'peserta' and status = 'aktif' and not tanpa_akun loop
    declare v_jenis text; v_fn text[] := array['sku','absensi','iuran'];
    begin
      foreach v_jenis in array v_fn loop
        v_mulai := case v_jenis
          when 'sku' then sigarda.eskalasi_mulai_sku(r.id)
          when 'absensi' then sigarda.eskalasi_mulai_absensi(r.id)
          else sigarda.eskalasi_mulai_iuran(r.id)
        end;
        continue when v_mulai is null;
        v_elapsed := v_hari - v_mulai;
        v_tingkat := sigarda.eskalasi_tingkat(v_elapsed);
        perform sigarda.notif_buat(r.id, 'eskalasi', sigarda.eskalasi_judul(v_jenis, v_tingkat), sigarda.eskalasi_isi(v_jenis, v_tingkat, v_mulai),
          jsonb_build_object('tab', sigarda.eskalasi_tab(v_jenis)), 'eskalasi:' || v_jenis || ':' || r.id || ':' || v_hari);
        if v_tingkat = 3 then
          for v_x in select id from public.profiles where status = 'aktif' and (role in ('penguji','admin') or (role = 'peserta' and jabatan_dewan is not null)) loop
            perform sigarda.notif_buat(v_x, 'eskalasi', 'Perlu tindak lanjut: ' || r.nama, sigarda.eskalasi_isi(v_jenis, v_tingkat, v_mulai),
              '{"tab":"tindaklanjut"}', 'eskalasi-p:' || v_jenis || ':' || r.id || ':' || v_hari);
          end loop;
        end if;
      end loop;
    end;
  end loop;
end $$;

create or replace function public.sg_eskalasi_daftar() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_hari date := sigarda.hari_ini(); v_hasil jsonb := '[]'::jsonb; r record; v_mulai date; v_elapsed int; v_jenis text;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pengurus() then raise exception 'Hanya Pembina, Dewan Ambalan, dan Admin Gudep yang dapat melihat daftar ini.'; end if;
  for r in select id, nama, kelas, sangga, whatsapp, tanpa_akun from public.profiles where role = 'peserta' and status = 'aktif' loop
    -- Anak Siaga tanpa akun: hanya kejadian absensi (lihat sigarda.eskalasi_proses).
    foreach v_jenis in array case when r.tanpa_akun then array['absensi'] else array['sku','absensi','iuran'] end loop
      v_mulai := case v_jenis
        when 'sku' then sigarda.eskalasi_mulai_sku(r.id)
        when 'absensi' then sigarda.eskalasi_mulai_absensi(r.id)
        else sigarda.eskalasi_mulai_iuran(r.id)
      end;
      continue when v_mulai is null;
      v_elapsed := v_hari - v_mulai;
      continue when sigarda.eskalasi_tingkat(v_elapsed) < 3;
      v_hasil := v_hasil || jsonb_build_object(
        'pesertaId', r.id, 'nama', r.nama, 'kelas', r.kelas, 'sangga', r.sangga, 'whatsapp', r.whatsapp, 'tanpaAkun', r.tanpa_akun,
        'jenis', v_jenis, 'mulai', v_mulai, 'hari', v_elapsed
      );
    end loop;
  end loop;
  return v_hasil;
end $$;

revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;
revoke all on function public.sg_agenda_simpan(bigint, text, text, text, date, text, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.sg_agenda_simpan(bigint, text, text, text, date, text, uuid[], boolean) to authenticated;
revoke all on function public.sg_eskalasi_daftar() from public, anon, authenticated;
grant execute on function public.sg_eskalasi_daftar() to authenticated;

commit;
notify pgrst, 'reload schema';
