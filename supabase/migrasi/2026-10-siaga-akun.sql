-- ============================================================================
-- MIGRASI: Pramuka Siaga, Fase 2b: anak Siaga boleh punya akun masuk. AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-10-sku-siaga.sql (lihat README). Isi:
--   * Fungsi baru sigarda.kelas_siaga: anggota Siaga = anak berkelas SD (angka 1-6 + paralel), dengan atau tanpa akun masuk.
--   * sg_siaga_ubah, sg_siaga_hapus, sg_barung_atur ditulis ulang (tanda tangan sama): berlaku juga untuk anak Siaga berakun (NIS anak berakun tidak diubah dari sini;
--     anak berakun tidak dihapus lewat sg_siaga_hapus, hapus akunnya lewat menu Anggota Admin).
--   * sg_sku_ajukan ditulis ulang: pengajuan anak Siaga tidak melewati pra-uji (langsung ke antrian Pembina); butir Siaga hanya untuk anak berkelas SD dan butir Penegak hanya untuk Penegak.
--   * sg_sku_catat_internal ditulis ulang (aturan tingkat butir sesuai kelas) dan sigarda.penguji_peran_ok: anak Siaga hanya diuji Pembina (bukan Dewan Ambalan).
--   * sigarda.tolak_peserta_tak_aktif: pesan agama kosong untuk anak Siaga menuntun Pembina ke menu Anggota Siaga.
--   * sg_pemeriksaan_data ditulis ulang: anak Siaga berakun tidak ditandai "data diri belum lengkap" (isian data diri itu untuk Penegak).
-- Edge Function sigarda BERUBAH (Pembina boleh membuat akun anggota/peserta): deploy ulang di Dashboard Supabase agar Pembina dapat membuat akun anak.
-- TIDAK menghapus data. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regprocedure('sigarda.prasyarat_tingkat(text)') is null then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (sampai 2026-10-sku-siaga.sql; lihat README), baru migrasi ini.';
  end if;
end $$;

create or replace function sigarda.kelas_siaga(p_kelas text) returns boolean language sql immutable as
$$ select coalesce(p_kelas, '') ~ '^[1-6][A-Z]?$' $$;

create or replace function public.sg_siaga_ubah(p_id uuid, p_data jsonb) returns void language plpgsql security definer set search_path = public as
$$
declare v_h jsonb;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat mengubah data anggota Siaga.'; end if;
  if not exists (select 1 from public.profiles where id = p_id and (tanpa_akun or sigarda.kelas_siaga(kelas))) then raise exception 'Anggota Siaga tidak ditemukan.'; end if;
  v_h := sigarda.siaga_periksa(p_data, p_id);
  -- NIS anak berakun = nama penggunanya: tidak diubah dari sini (Admin Gudep mengubah nama pengguna di menu Anggota).
  update public.profiles set nama = v_h ->> 'nama', kelas = v_h ->> 'kelas', jenis_kelamin = v_h ->> 'jk', agama = v_h ->> 'agama',
    nis = case when tanpa_akun then v_h ->> 'nis' else nis end, perindukan = v_h ->> 'perindukan', barung = v_h ->> 'barung'
  where id = p_id;
end $$;

create or replace function public.sg_siaga_hapus(p_id uuid) returns void language plpgsql security definer set search_path = public as
$$
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat menghapus anggota Siaga.'; end if;
  if not exists (select 1 from public.profiles where id = p_id and (tanpa_akun or sigarda.kelas_siaga(kelas))) then raise exception 'Anggota Siaga tidak ditemukan.'; end if;
  if not exists (select 1 from public.profiles where id = p_id and tanpa_akun) then raise exception 'Anggota ini punya akun masuk. Hapus akunnya lewat menu Anggota (Admin Gudep), atau ubah statusnya menjadi nonaktif.'; end if;
  if exists (select 1 from public.sku_progress where peserta_id = p_id) or exists (select 1 from public.sku_riwayat where peserta_id = p_id)
     or exists (select 1 from public.absensi_hadir where peserta_id = p_id) or exists (select 1 from public.iuran where peserta_id = p_id) then
    raise exception 'Anggota ini sudah punya catatan (SKU, kehadiran, atau iuran). Ubah statusnya menjadi nonaktif, jangan dihapus.';
  end if;
  delete from public.profiles where id = p_id;
end $$;

create or replace function public.sg_barung_atur(p_ids uuid[], p_perindukan text, p_barung text) returns int language plpgsql security definer set search_path = public as
$$
declare v_h jsonb; v_n int;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat mengatur barung.'; end if;
  if p_ids is null or cardinality(p_ids) = 0 then raise exception 'Pilih anggota lebih dulu.'; end if;
  if cardinality(p_ids) > 300 then raise exception 'Paling banyak 300 anggota sekali atur.'; end if;
  if (select count(*) from public.profiles where id = any (p_ids) and (tanpa_akun or sigarda.kelas_siaga(kelas))) <> (select count(distinct x) from unnest(p_ids) x) then
    raise exception 'Ada anggota yang bukan anggota Siaga atau tidak ditemukan.';
  end if;
  v_h := sigarda.siaga_periksa(jsonb_build_object('nama', 'x', 'kelas', '1', 'perindukan', p_perindukan, 'barung', p_barung));
  update public.profiles set perindukan = v_h ->> 'perindukan', barung = v_h ->> 'barung' where id = any (p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.sg_sku_ajukan(p_sku_id text, p_jadwal date, p_penguji_id uuid, p_catatan text default '')
returns void language plpgsql security definer set search_path = public as
$$
declare
  v_uid uuid := auth.uid(); v_p public.profiles; v_u public.sku_unit; v_status text;
begin
  perform sigarda.wajib_aktif();
  select * into v_p from public.profiles where id = v_uid;
  if not found or v_p.role <> 'peserta' then raise exception 'Hanya peserta yang dapat mengajukan pengujian.'; end if;
  select * into v_u from public.sku_unit where id = p_sku_id and (agama is null or agama = v_p.agama);
  if not found then raise exception 'Poin SKU tidak ditemukan.'; end if;

  -- Butir Siaga (Mula, Bantu, Tata) hanya untuk anak berkelas SD; butir Penegak hanya untuk Penegak.
  if sigarda.kelas_siaga(v_p.kelas) <> (v_u.tingkat in ('Mula', 'Bantu', 'Tata')) then raise exception 'Butir ini bukan untuk tingkat kelasmu.'; end if;
  select status into v_status from public.sku_progress where peserta_id = v_uid and sku_id = p_sku_id;
  if v_status = 'lulus' then raise exception 'Poin ini sudah lulus.'; end if;
  if v_status in ('diajukan','proses') then raise exception 'Poin ini sedang menunggu atau dalam pengujian.'; end if;
  if sigarda.prasyarat_tingkat(v_u.tingkat) is not null and not sigarda.tingkat_selesai(v_uid, sigarda.prasyarat_tingkat(v_u.tingkat)) then
    raise exception 'Selesaikan seluruh butir % lebih dulu.', sigarda.prasyarat_tingkat(v_u.tingkat);
  end if;
  if p_jadwal is null then raise exception 'Tanggal pengujian wajib diisi.'; end if;
  if char_length(coalesce(p_catatan, '')) > 500 then raise exception 'Catatan maksimal 500 karakter.'; end if;
  -- Sakelar pra-uji hidup: pengajuan lebih dulu melewati pra-uji Pinsa/Bina Damping (p_penguji_id diabaikan; uji resmi selalu ke antrian Pembina rombel).
  if sigarda.pra_uji_aktif() and not sigarda.kelas_siaga(v_p.kelas) then   -- anak Siaga tidak melewati pra-uji (langsung ke antrian Pembina)
    perform sigarda.pra_uji_mulai(v_uid, p_sku_id, p_jadwal, p_catatan);
    return;
  end if;
  -- Ketat saat memilih penguji: hanya penguji yang sah (penugasan rombel, butir Laksana dan butir agama hanya Pembina, agama seagama).
  -- p_penguji_id kosong = antrian bersama rombel: penguji yang sah mana pun mengambilnya lewat "Mulai uji".
  if p_penguji_id is not null and not sigarda.bisa_menguji(p_penguji_id) then
    raise exception 'Pilih penguji terlebih dulu.';
  end if;
  if p_penguji_id is null then
    if not exists (select 1 from sigarda.penguji_sah(v_uid, p_sku_id)) then
      raise exception 'Belum ada penguji yang dapat menguji butir ini untuk rombel Anda. Hubungi Admin Gudep.';
    end if;
  elsif not sigarda.penguji_boleh(v_uid, p_penguji_id, p_sku_id) then
    if v_u.agama is not null then
      raise exception 'Butir agama hanya dapat diuji oleh Pembina yang seagama. Pilih penguji dari daftar.';
    elsif v_u.tingkat = 'Laksana' and not exists (select 1 from public.profiles where id = p_penguji_id and jabatan = 'Pembina') and not sigarda.ditugaskan(v_uid, p_penguji_id) then
      raise exception 'Butir Laksana hanya dapat diuji oleh Pembina atau penguji yang ditugaskan untuk Anda. Pilih penguji dari daftar.';
    else
      raise exception 'Penguji ini tidak bertugas pada rombel Anda. Pilih penguji dari daftar.';
    end if;
  end if;

  insert into public.sku_progress (peserta_id, sku_id, status, jadwal, penguji_id, catatan_peserta, diubah)
  values (v_uid, p_sku_id, 'diajukan', p_jadwal, p_penguji_id, btrim(coalesce(p_catatan, '')), now())
  on conflict (peserta_id, sku_id) do update
    set status = 'diajukan', jadwal = excluded.jadwal, penguji_id = excluded.penguji_id,
        catatan_peserta = excluded.catatan_peserta, diubah = now();
  insert into public.sku_riwayat (peserta_id, sku_id, teks, oleh)
  values (v_uid, p_sku_id, 'Mengajukan pengujian untuk ' || to_char(p_jadwal, 'YYYY-MM-DD') || case when p_penguji_id is null then ' (antrian rombel)' else '' end, v_uid);
end $$;

create or replace function public.sg_sku_catat_internal(
  p_oleh uuid, p_peserta_id uuid, p_sku_id text, p_hasil text,
  p_tanggal_uji date default null, p_nilai text default null, p_catatan text default ''
) returns void language plpgsql security definer set search_path = public as
$$
declare v_p public.profiles; v_kode text; v_cat text := btrim(coalesce(p_catatan, '')); v_lama public.sku_progress; v_ganti text := ''; v_luar text; v_pra text;
begin
  if not sigarda.bisa_menguji(p_oleh) then
    raise exception '%', case when sigarda.pra_uji_aktif() then 'Hanya Pembina yang dapat mencatat hasil uji resmi.' else 'Hanya Pembina atau Dewan Ambalan yang dapat mencatat hasil.' end;
  end if;
  if p_oleh = p_peserta_id then raise exception 'Anda tidak dapat menilai diri sendiri.'; end if;
  select * into v_p from public.profiles where id = p_peserta_id and role = 'peserta';
  if not found then raise exception 'Peserta tidak ditemukan.'; end if;
  if not exists (select 1 from public.sku_unit where id = p_sku_id and (agama is null or agama = v_p.agama)) then
    raise exception 'Poin SKU tidak ditemukan.';
  end if;
  if sigarda.kelas_siaga(v_p.kelas) <> exists (select 1 from public.sku_unit where id = p_sku_id and tingkat in ('Mula', 'Bantu', 'Tata')) then
    raise exception 'Butir ini bukan untuk tingkat kelas peserta (butir Siaga hanya untuk anak berkelas SD).';
  end if;
  -- Butir agama (sub-butir Butir 1) hanya dinilai Pembina yang seagama, dan butir Laksana hanya oleh Pembina atau penguji yang ditugaskan untuk Penegak
  -- itu, untuk semua hasil (mulai uji, lulus, perlu diulang, dikembalikan). Aturan ini sama dengan pemilihan penguji (sigarda.penguji_peran_ok).
  if not sigarda.penguji_peran_ok(p_peserta_id, p_oleh, p_sku_id) then
    if exists (select 1 from public.sku_unit where id = p_sku_id and agama is not null) then
      raise exception 'Butir agama hanya dapat dinilai oleh Pembina yang seagama dengan Penegak.';
    end if;
    raise exception 'Butir Laksana hanya dapat dinilai oleh Pembina atau penguji yang ditugaskan untuk Penegak ini.';
  end if;
  -- Lunak saat mencatat: penguji lain boleh menggantikan penguji tujuan, tetapi tercatat di riwayat.
  select * into v_lama from public.sku_progress where peserta_id = p_peserta_id and sku_id = p_sku_id;
  if found and v_lama.status in ('diajukan', 'proses') and v_lama.penguji_id is not null and v_lama.penguji_id <> p_oleh and p_hasil in ('proses', 'lulus', 'ulang') then
    v_ganti := ' (menggantikan ' || coalesce((select nama from public.profiles where id = v_lama.penguji_id), 'penguji lain') || ')';
  end if;
  -- Butir agama yang dinilai guru agama luar (Pembina tidak seagama, sah karena ada surat pengantar): riwayat menyebut guru dan nomor surat.
  if p_hasil in ('proses', 'lulus', 'ulang') and exists (select 1 from public.sku_unit where id = p_sku_id and agama is not null)
     and exists (select 1 from public.profiles b where b.role = 'penguji' and b.jabatan = 'Pembina' and b.agama is not null)
     and (select agama from public.profiles where id = p_oleh) is distinct from v_p.agama then
    select ' (dinilai guru agama ' || coalesce(d.payload -> 'guru' ->> 'nama', '-') || ', surat nomor ' || d.nomor || ')' into v_luar
    from public.dokumen_terbit d
    where d.jenis = 'surat_pengantar_agama' and d.peserta_id = p_peserta_id and d.dicabut_pada is null and d.payload -> 'butir' @> jsonb_build_array(p_sku_id)
    order by d.id desc limit 1;
    v_ganti := v_ganti || coalesce(v_luar, '');
  end if;
  if p_hasil not in ('proses','lulus','ulang','reset') then raise exception 'Hasil pengujian tidak dikenal.'; end if;
  -- Butir dengan instrumen ditetapkan hanya boleh dinilai lewat sg_sku_catat_rubrik_internal (yang menyalakan penanda ini)
  if p_hasil in ('lulus','ulang') and sigarda.instrumen_aktif(p_sku_id)
     and coalesce(current_setting('sigarda.via_rubrik', true), '') <> 'ya' then
    raise exception 'Butir ini dinilai dengan instrumen penilaian. Catat hasilnya lewat lembar penilaian.';
  end if;
  if p_hasil <> 'reset' and p_tanggal_uji is null then raise exception 'Tanggal uji wajib diisi.'; end if;
  select sigarda.prasyarat_tingkat(tingkat) into v_pra from public.sku_unit where id = p_sku_id;
  if p_hasil <> 'reset' and v_pra is not null and not sigarda.tingkat_selesai(p_peserta_id, v_pra) then
    raise exception 'Peserta belum menyelesaikan seluruh butir %.', v_pra;
  end if;
  if char_length(v_cat) > 1000 then raise exception 'Catatan maksimal 1000 karakter.'; end if;

  -- Pembina memulai atau menuntaskan butir yang masih menunggu pra-uji: pra-uji itu tidak diperlukan lagi.
  if p_hasil in ('proses', 'lulus', 'ulang') then
    update public.sku_pra_uji set status = 'dibatalkan', catatan = 'Dilanjutkan langsung oleh penguji resmi', diputuskan_pada = now()
      where peserta_id = p_peserta_id and sku_id = p_sku_id and status = 'menunggu';
  end if;

  if p_hasil = 'proses' then
    insert into public.sku_progress (peserta_id, sku_id, status, penguji_id, tanggal_uji)
    values (p_peserta_id, p_sku_id, 'proses', p_oleh, p_tanggal_uji)
    on conflict (peserta_id, sku_id) do update
      set status = 'proses', penguji_id = p_oleh, tanggal_uji = p_tanggal_uji, verifikasi = null, diverifikasi_pada = null, verifikasi_token = null, diubah = now();
    insert into public.sku_riwayat (peserta_id, sku_id, teks, oleh) values (p_peserta_id, p_sku_id, 'Pengujian dimulai' || v_ganti, p_oleh);

  elsif p_hasil = 'lulus' then
    if p_nilai is null then raise exception 'Pilih predikat penilaian.'; end if;
    if p_nilai not in ('Sangat baik','Baik','Cukup') then raise exception 'Predikat tidak dikenal.'; end if;
    v_kode := sigarda.kode_verifikasi(array[p_peserta_id::text, p_sku_id, p_oleh::text, p_tanggal_uji::text]);
    insert into public.sku_progress (peserta_id, sku_id, status, penguji_id, tanggal_uji, nilai, catatan, verifikasi, diverifikasi_pada, verifikasi_token)
    values (p_peserta_id, p_sku_id, 'lulus', p_oleh, p_tanggal_uji, p_nilai, v_cat, v_kode, now(), sigarda.token_acak())
    on conflict (peserta_id, sku_id) do update
      set status = 'lulus', penguji_id = p_oleh, tanggal_uji = p_tanggal_uji, nilai = p_nilai, catatan = v_cat,
          verifikasi = v_kode, diverifikasi_pada = now(), verifikasi_token = sigarda.token_acak(), diubah = now();
    insert into public.sku_riwayat (peserta_id, sku_id, teks, oleh)
    values (p_peserta_id, p_sku_id, 'Dinyatakan lulus (' || p_nilai || '), kode ' || v_kode || v_ganti, p_oleh);

  elsif p_hasil = 'ulang' then
    if v_cat = '' then raise exception 'Isi catatan agar peserta tahu bagian yang perlu diperbaiki.'; end if;
    insert into public.sku_progress (peserta_id, sku_id, status, penguji_id, tanggal_uji, nilai, catatan)
    values (p_peserta_id, p_sku_id, 'ulang', p_oleh, p_tanggal_uji, null, v_cat)
    on conflict (peserta_id, sku_id) do update
      set status = 'ulang', penguji_id = p_oleh, tanggal_uji = p_tanggal_uji, nilai = null, catatan = v_cat,
          verifikasi = null, diverifikasi_pada = null, verifikasi_token = null, diubah = now();
    insert into public.sku_riwayat (peserta_id, sku_id, teks, oleh) values (p_peserta_id, p_sku_id, 'Perlu diulang' || v_ganti, p_oleh);

  else -- reset
    if v_cat = '' then raise exception 'Isi alasan pembatalan status.'; end if;
    insert into public.sku_progress (peserta_id, sku_id, status)
    values (p_peserta_id, p_sku_id, 'belum')
    on conflict (peserta_id, sku_id) do update
      set status = 'belum', penguji_id = null, tanggal_uji = null, jadwal = null, nilai = null, catatan = '',
          catatan_peserta = '', verifikasi = null, diverifikasi_pada = null, verifikasi_token = null, diubah = now();
    insert into public.sku_riwayat (peserta_id, sku_id, teks, oleh)
    values (p_peserta_id, p_sku_id, 'Status dikembalikan ke belum diuji. Alasan: ' || v_cat, p_oleh);
  end if;
end $$;

create or replace function sigarda.penguji_peran_ok(p_peserta uuid, p_penguji uuid, p_sku text) returns boolean
language plpgsql stable security definer set search_path = public as
$$
declare v_u public.profiles; v_tingkat text; v_agama_butir text; v_agama_peserta text; v_pembina boolean;
begin
  if p_penguji is null or p_penguji = p_peserta or not sigarda.bisa_menguji(p_penguji) then return false; end if;
  select * into v_u from public.profiles where id = p_penguji;
  select tingkat, agama into v_tingkat, v_agama_butir from public.sku_unit where id = p_sku;
  if not found then return false; end if;
  v_pembina := v_u.role = 'penguji' and v_u.jabatan = 'Pembina';
  -- Anak Siaga (kelas SD) hanya diuji Pembina (tanpa Dewan Ambalan maupun pra-uji).
  if not v_pembina and sigarda.kelas_siaga((select kelas from public.profiles where id = p_peserta)) then return false; end if;
  if not v_pembina and v_agama_butir is not null then return false; end if;
  if not v_pembina and v_tingkat = 'Laksana' and not sigarda.ditugaskan(p_peserta, p_penguji) then return false; end if;
  if v_agama_butir is not null
     and exists (select 1 from public.profiles b where b.role = 'penguji' and b.jabatan = 'Pembina' and b.agama is not null) then
    select agama into v_agama_peserta from public.profiles where id = p_peserta;
    if (v_u.agama is null or v_u.agama is distinct from v_agama_peserta) and not sigarda.surat_agama_aktif(p_peserta, p_sku) then return false; end if;
  end if;
  return true;
end $$;

create or replace function sigarda.tolak_peserta_tak_aktif() returns trigger language plpgsql security definer set search_path = public as
$$
declare v_status text; v_nama text; v_agama text; v_tanpa_akun boolean;
begin
  if TG_OP = 'UPDATE' and pg_trigger_depth() > 1 then return new; end if;
  select status, nama, agama, tanpa_akun into v_status, v_nama, v_agama, v_tanpa_akun from public.profiles where id = new.peserta_id;
  if v_status is not null and v_status <> 'aktif' then
    if new.peserta_id = auth.uid() then
      raise exception 'Akun Anda berstatus % dan hanya dapat dilihat. Hubungi Pembina atau Admin Gudep bila ingin aktif kembali.', v_status;
    end if;
    raise exception '% berstatus % dan tidak dapat diubah. Aktifkan kembali lebih dulu di menu Anggota.', v_nama, v_status;
  end if;
  -- Agama Penegak baru diisi sendiri sesudah akun dibuat (Tahap 3, H1). Tanpa agama, butir agama tidak tampak baginya sehingga progres SKU-nya tidak lengkap: penulisan progres SKU ditolak sampai agama diisi.
  if v_status = 'aktif' and v_agama is null and TG_TABLE_NAME in ('sku_progress', 'sku_riwayat', 'sku_pra_uji', 'sesi_ujian_peserta') then
    if v_tanpa_akun or (new.peserta_id is distinct from auth.uid() and sigarda.kelas_siaga((select kelas from public.profiles where id = new.peserta_id))) then
      raise exception '% belum dicatat agamanya. Isi agamanya di menu Anggota Siaga (ubah data anak) sebelum mencatat SKU.', v_nama;
    end if;
    if new.peserta_id = auth.uid() then
      raise exception 'Isi agama Anda lebih dulu di menu Akun saya (Data diri) sebelum mengajukan SKU.';
    end if;
    raise exception '% belum mengisi agama. Penegak melengkapinya di menu Akun saya (Data diri), atau Admin Gudep mengisinya di menu Anggota.', v_nama;
  end if;
  return new;
end $$;

create or replace function public.sg_pemeriksaan_data() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare v_ta text := sigarda.tahun_ajaran_kini(); v_hasil jsonb;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pengurus() then raise exception 'Hanya pengurus (Pembina, Dewan Ambalan, dan Admin Gudep) yang dapat melihat pemeriksaan data.'; end if;
  v_hasil := jsonb_build_object(
    'praUjiAktif', sigarda.pra_uji_aktif(),
    'kelasLama', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nama', x.nama, 'nis', x.nis, 'kelas', x.kelas) order by x.nis)
      from (select id, nama, nis, kelas from public.profiles where role = 'peserta' and status = 'aktif' and not sigarda.rombel_sah(kelas) limit 300) x
    ), '[]'::jsonb),
    'tanpaNta', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nama', x.nama, 'nis', x.nis, 'kelas', x.kelas) order by x.nis)
      from (select id, nama, nis, kelas from public.profiles where role = 'peserta' and status = 'aktif' and (nta is null or btrim(nta) = '') limit 300) x
    ), '[]'::jsonb),
    'tanpaJk', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nama', x.nama, 'nis', x.nis, 'kelas', x.kelas, 'peran', x.peran) order by x.peran, x.nama)
      from (select id, nama, nis, kelas, case when role = 'peserta' then 'Penegak' when role = 'admin' then 'Admin Gudep' else coalesce(jabatan, 'Dewan Ambalan') end as peran
            from public.profiles where status = 'aktif' and jenis_kelamin is null limit 300) x
    ), '[]'::jsonb),
    'rombelTanpaPenguji', coalesce((
      select jsonb_agg(jsonb_build_object('rombel', x.rombel, 'jumlah', x.jumlah) order by x.rombel)
      from (
        select rb.rombel, (select count(*) from public.profiles p2 where p2.role = 'peserta' and p2.status = 'aktif' and p2.kelas = rb.rombel) as jumlah
        from (select k || '-' || lpad(n::text, 2, '0') as rombel from (values ('X'), ('XI'), ('XII')) t(k), generate_series(1, 10) n) rb
        where exists (select 1 from public.profiles p2 where p2.role = 'peserta' and p2.status = 'aktif' and p2.kelas = rb.rombel)
          and not exists (select 1 from public.penugasan_rombel r where r.tahun_ajaran = v_ta and r.rombel = rb.rombel)
      ) x
    ), '[]'::jsonb),
    'rombelTanpaBinaDamping', coalesce((
      select jsonb_agg(jsonb_build_object('rombel', x.rombel, 'jumlah', x.jumlah, 'binaDamping', x.bd) order by x.rombel)
      from (
        select rb.rombel, (select count(*) from public.profiles p2 where p2.role = 'peserta' and p2.status = 'aktif' and p2.kelas = rb.rombel) as jumlah,
               (select count(*) from public.bina_damping b where b.tahun_ajaran = v_ta and b.rombel = rb.rombel) as bd
        from (select k || '-' || lpad(n::text, 2, '0') as rombel from (values ('X'), ('XI'), ('XII')) t(k), generate_series(1, 10) n) rb
        where exists (select 1 from public.profiles p2 where p2.role = 'peserta' and p2.status = 'aktif' and p2.kelas = rb.rombel)
          and (select count(*) from public.bina_damping b where b.tahun_ajaran = v_ta and b.rombel = rb.rombel) < 2
      ) x
    ), '[]'::jsonb),
    'sanggaTanpaPinsa', coalesce((
      select jsonb_agg(jsonb_build_object('rombel', x.kelas, 'sangga', x.sangga, 'jumlah', x.jumlah) order by x.kelas, x.sangga)
      from (
        -- Pinsa sebuah sangga: anggota berstatus Pinsa, atau Penegak yang ditugaskan (pinsa_tugas) ke sangga itu.
        select g.kelas, g.sangga, g.jumlah from (
          select p.kelas, lower(btrim(p.sangga)) as kunci, min(p.sangga) as sangga, count(*) as jumlah, bool_or(p.pinsa) as ada
          from public.profiles p
          where p.role = 'peserta' and p.status = 'aktif' and sigarda.rombel_sah(p.kelas) and btrim(coalesce(p.sangga, '')) <> ''
          group by p.kelas, lower(btrim(p.sangga))
        ) g
        where not g.ada and not exists (select 1 from public.pinsa_tugas t where t.tahun_ajaran = v_ta and t.rombel = g.kelas and lower(t.sangga) = g.kunci)
        limit 300
      ) x
    ), '[]'::jsonb),
    'praUjiMacet', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nama', x.nama, 'kelas', x.kelas, 'butir', x.butir, 'tahap', x.tahap, 'hari', x.hari, 'tanpaPenilai', x.tanpa_penilai) order by x.hari desc)
      from (
        select r.id, p.nama, p.kelas, sigarda.notif_label_butir(r.sku_id) as butir, r.tahap, floor(extract(epoch from now() - r.dibuat) / 86400)::int as hari,
               not exists (select 1 from sigarda.pra_uji_penilai_daftar(r.peserta_id, r.sku_id, r.tahap)) as tanpa_penilai
        from public.sku_pra_uji r join public.profiles p on p.id = r.peserta_id
        where r.status = 'menunggu'
          and (r.dibuat < now() - interval '3 days' or not exists (select 1 from sigarda.pra_uji_penilai_daftar(r.peserta_id, r.sku_id, r.tahap)))
        limit 300
      ) x
    ), '[]'::jsonb),
    'pembinaTanpaAgama', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nama', x.nama) order by x.nama)
      from (select id, nama from public.profiles where role = 'penguji' and jabatan = 'Pembina' and status = 'aktif' and agama is null limit 300) x
    ), '[]'::jsonb),
    -- Data diri Penegak yang belum lengkap (Tahap 3, H1): isian POKOK saja (WhatsApp, jenis kelamin, agama, tanggal lahir, tempat lahir, alamat, nama ayah/ibu/wali; cermin
    -- isianLogic.POKOK). Hanya nama dan KODE isian yang kurang, tidak pernah nilainya (bukan data pribadi). Diisi Penegak sendiri, jadi tanpa tombol perbaiki.
    'dataDiriBelum', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nama', x.nama, 'nis', x.nis, 'kelas', x.kelas, 'kurang', to_jsonb(x.kurang)) order by x.kelas, x.nama)
      from (
        select y.* from (
          select p.id, p.nama, p.nis, p.kelas,
            array_remove(array[
              case when p.whatsapp is null or btrim(p.whatsapp) = '' then 'whatsapp' end,
              case when p.jenis_kelamin is null then 'jk' end,
              case when p.agama is null then 'agama' end,
              case when not exists (select 1 from public.tanggal_lahir t where t.peserta_id = p.id) then 'lahir' end,
              case when not exists (select 1 from public.penegak_isian i where i.peserta_id = p.id and i.kunci = 'tempat_lahir') then 'tempat_lahir' end,
              case when not exists (select 1 from public.penegak_isian i where i.peserta_id = p.id and i.kunci = 'alamat') then 'alamat' end,
              case when not exists (select 1 from public.penegak_isian i where i.peserta_id = p.id and i.kunci in ('ayah_nama', 'ibu_nama', 'wali_nama')) then 'ortu' end
            ], null) as kurang
          from public.profiles p where p.role = 'peserta' and p.status = 'aktif' and not p.tanpa_akun and not sigarda.kelas_siaga(p.kelas)
        ) y where cardinality(y.kurang) > 0 order by y.kelas, y.nama limit 300
      ) x
    ), '[]'::jsonb),
    -- Safe From Harm (Tahap 4): anggota dewasa aktif yang catatannya belum lengkap. Pembina: pelatihan, pakta_integritas, rekam_jejak; Admin Gudep: pelatihan (kode yang kurang).
    'sfhBelum', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nama', x.nama, 'peran', x.peran, 'kurang', to_jsonb(x.kurang)) order by x.peran, x.nama)
      from (
        select y.* from (
          select p.id, p.nama, case when p.role = 'admin' then 'Admin Gudep' else 'Pembina' end as peran,
            array_remove(array[
              case when not exists (select 1 from public.sfh_catatan s where s.anggota_id = p.id and s.jenis = 'pelatihan') then 'pelatihan' end,
              case when p.role = 'penguji' and not exists (select 1 from public.sfh_catatan s where s.anggota_id = p.id and s.jenis = 'pakta_integritas') then 'pakta_integritas' end,
              case when p.role = 'penguji' and not exists (select 1 from public.sfh_catatan s where s.anggota_id = p.id and s.jenis = 'rekam_jejak') then 'rekam_jejak' end
            ], null) as kurang
          from public.profiles p
          where p.status = 'aktif' and (p.role = 'admin' or (p.role = 'penguji' and p.jabatan = 'Pembina'))
        ) y where cardinality(y.kurang) > 0 order by y.peran, y.nama limit 300
      ) x
    ), '[]'::jsonb),
    'belumPernahMasuk', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nama', x.nama, 'peran', x.peran, 'dibuat', x.dibuat) order by x.dibuat)
      from (
        select p.id, p.nama, case when p.role = 'peserta' then 'Penegak' when p.role = 'admin' then 'Admin Gudep' else coalesce(p.jabatan, 'Dewan Ambalan') end as peran, p.dibuat
        from public.profiles p join auth.users u on u.id = p.id
        where p.status = 'aktif' and u.last_sign_in_at is null
        limit 300
      ) x
    ), '[]'::jsonb)
  );
  -- Jumlah SEBENARNYA untuk daftar yang bisa lebih dari 300 baris (700 Penegak: hari peluncuran data diri dan NTA belum terisi): dihitung hanya bila daftarnya penuh, jadi
  -- biasanya tanpa biaya tambahan. Klien menampilkan "300 dari N" (pemeriksaanLogic.jumlahKategori).
  return v_hasil || jsonb_build_object('jumlahSebenarnya', jsonb_build_object(
    'kelasLama', case when jsonb_array_length(v_hasil -> 'kelasLama') < 300 then jsonb_array_length(v_hasil -> 'kelasLama')
      else (select count(*) from public.profiles where role = 'peserta' and status = 'aktif' and not sigarda.rombel_sah(kelas)) end,
    'tanpaNta', case when jsonb_array_length(v_hasil -> 'tanpaNta') < 300 then jsonb_array_length(v_hasil -> 'tanpaNta')
      else (select count(*) from public.profiles where role = 'peserta' and status = 'aktif' and (nta is null or btrim(nta) = '')) end,
    'tanpaJk', case when jsonb_array_length(v_hasil -> 'tanpaJk') < 300 then jsonb_array_length(v_hasil -> 'tanpaJk')
      else (select count(*) from public.profiles where status = 'aktif' and jenis_kelamin is null) end,
    'dataDiriBelum', case when jsonb_array_length(v_hasil -> 'dataDiriBelum') < 300 then jsonb_array_length(v_hasil -> 'dataDiriBelum')
      else (select count(*) from public.profiles p where p.role = 'peserta' and p.status = 'aktif' and not p.tanpa_akun and not sigarda.kelas_siaga(p.kelas) and (
        p.whatsapp is null or btrim(p.whatsapp) = '' or p.jenis_kelamin is null or p.agama is null
        or not exists (select 1 from public.tanggal_lahir t where t.peserta_id = p.id)
        or not exists (select 1 from public.penegak_isian i where i.peserta_id = p.id and i.kunci = 'tempat_lahir')
        or not exists (select 1 from public.penegak_isian i where i.peserta_id = p.id and i.kunci = 'alamat')
        or not exists (select 1 from public.penegak_isian i where i.peserta_id = p.id and i.kunci in ('ayah_nama', 'ibu_nama', 'wali_nama')))) end,
    'belumPernahMasuk', case when jsonb_array_length(v_hasil -> 'belumPernahMasuk') < 300 then jsonb_array_length(v_hasil -> 'belumPernahMasuk')
      else (select count(*) from public.profiles p join auth.users u on u.id = p.id where p.status = 'aktif' and u.last_sign_in_at is null) end
  ));
end $$;


revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
