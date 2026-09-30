-- ============================================================================
-- MIGRASI: Pramuka Siaga, Fase 1: anggota Siaga tanpa akun, kelas SD, perindukan dan barung. AMAN untuk database berisi data.
--
-- Jalankan SETELAH 2026-09-bersih-riwayat-cron.sql (lihat README). Isi:
--   * Tabel profiles: FK ke auth.users DIHAPUS (id kini berdefault acak) supaya anak Siaga dapat disimpan tanpa akun masuk; hapus akun login tetap menghapus
--     profilnya lewat pemicu profil_hapus_bersama_akun pada auth.users. Kolom baru tanpa_akun, perindukan, barung; kendala profil_peserta dilonggarkan (NIS wajib
--     hanya untuk akun yang dapat masuk) dan kendala baru profil_tanpa_akun dan profil_barung.
--   * sigarda.rombel_sah kini juga menerima kelas SD (angka 1-6 dengan satu huruf paralel opsional: 4, 5A). Nilai lama (X-01 ... XII-10) tetap sah.
--   * Fungsi baru: sigarda.siaga_periksa, sg_siaga_tambah, sg_siaga_ubah, sg_siaga_hapus, sg_barung_atur (Pembina dan Admin Gudep).
--   * sg_pemeriksaan_data ditulis ulang (tanda tangan sama): anak Siaga tidak ditandai "data diri belum lengkap".
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regprocedure('public.sg_berita_lagi(int)') is null or to_regprocedure('public.sg_galeri_lagi(int)') is null
     or (select prosrc from pg_proc where oid = to_regprocedure('public.sg_pemeriksaan_data()')) not like '%jumlahSebenarnya%' then
    raise exception 'Jalankan lebih dulu skema dan migrasi sebelumnya (sampai 2026-09-bersih-riwayat-cron.sql; lihat README), baru migrasi ini.';
  end if;
end $$;

-- Tabel profiles
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles add column if not exists tanpa_akun boolean not null default false;
alter table public.profiles add column if not exists perindukan text check (perindukan is null or (char_length(perindukan) between 1 and 40 and perindukan !~ '[[:cntrl:]<>]'));
alter table public.profiles add column if not exists barung text check (barung is null or (char_length(barung) between 1 and 40 and barung !~ '[[:cntrl:]<>]'));
alter table public.profiles drop constraint if exists profil_peserta;
alter table public.profiles add constraint profil_peserta check (role <> 'peserta' or (kelas is not null and jabatan is null and (nis is not null or tanpa_akun)));
alter table public.profiles drop constraint if exists profil_tanpa_akun;
alter table public.profiles add constraint profil_tanpa_akun check (not tanpa_akun or (role = 'peserta' and jabatan_dewan is null and not pinsa));
alter table public.profiles drop constraint if exists profil_barung;
alter table public.profiles add constraint profil_barung check (barung is null or perindukan is not null);

create or replace function sigarda.rombel_sah(p_rombel text) returns boolean language sql immutable as
$$ select coalesce(p_rombel ~ '^((X|XI|XII)-(0[1-9]|10)|[1-6][A-Z]?)$', false) $$;

-- ===== Anggota Siaga tanpa akun (Pramuka Siaga, Fase 1): fungsi =====
-- Anak Siaga TIDAK punya akun masuk: profilnya (role 'peserta', tanpa_akun = true) dibuat dan dirawat Pembina/Admin lewat fungsi di bawah,
-- tanpa auth.users, PIN, WhatsApp, atau isian mandiri. Kelas berupa angka 1-6 dengan paralel opsional (1, 4A, 5B): sigarda.rombel_sah.
-- Kelompok: perindukan (3-4 barung) dan barung (6-8 anak); penulisan nama disamakan dengan yang sudah ada (tanpa membedakan huruf besar/kecil).

-- Profil ikut terhapus bila akun loginnya dihapus (dulu oleh FK ON DELETE CASCADE ke auth.users, kini FK itu tidak ada agar anggota tanpa akun dapat disimpan).
create or replace function sigarda.profil_hapus_bersama_akun() returns trigger language plpgsql security definer set search_path = public as
$$ begin delete from public.profiles where id = old.id and not tanpa_akun; return old; end $$;
drop trigger if exists profil_hapus_bersama_akun on auth.users;
create trigger profil_hapus_bersama_akun after delete on auth.users for each row execute function sigarda.profil_hapus_bersama_akun();

-- Memeriksa dan merapikan satu anggota Siaga; mengembalikan kolom yang sudah bersih (jsonb) atau melempar galat berbahasa Indonesia.
-- Dicerminkan src/lib/siagaLogic.js (periksaSiaga) dan DIBANDINGKAN LANGSUNG dengan fungsi ini oleh uji/siaga-klien.mjs.
create or replace function sigarda.siaga_periksa(p_d jsonb, p_id uuid default null) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_nama text; v_kelas text; v_jk text; v_agama text; v_nis text; v_per text; v_bar text;
begin
  if p_d is null or jsonb_typeof(p_d) <> 'object' then raise exception 'Data anggota tidak valid.'; end if;
  v_nama := sigarda.rapikan(p_d ->> 'nama');
  if v_nama = '' then raise exception 'Nama wajib diisi.'; end if;
  if char_length(v_nama) > 120 then raise exception 'Nama maksimal 120 karakter.'; end if;
  v_kelas := sigarda.rombel_baku(p_d ->> 'kelas');
  if v_kelas !~ '^[1-6][A-Z]?$' then raise exception 'Kelas harus angka 1 sampai 6, boleh diikuti satu huruf paralel (contoh: 4, 5A).'; end if;
  v_jk := upper(btrim(coalesce(p_d ->> 'jk', '')));
  if v_jk not in ('', 'L', 'P') then raise exception 'Jenis kelamin harus L atau P.'; end if;
  v_agama := btrim(coalesce(p_d ->> 'agama', ''));
  if v_agama <> '' and v_agama not in ('Islam','Katolik','Protestan','Hindu','Buddha','Khonghucu') then raise exception 'Agama tidak dikenal.'; end if;
  v_nis := btrim(coalesce(p_d ->> 'nis', ''));
  if v_nis <> '' and v_nis !~ '^[0-9A-Za-z./-]{3,20}$' then raise exception 'NIS hanya boleh berisi huruf, angka, titik, garis miring, atau tanda hubung (3 sampai 20 karakter).'; end if;
  if v_nis <> '' and exists (select 1 from public.profiles where nis = v_nis and id is distinct from p_id) then raise exception 'NIS % sudah dipakai anggota lain.', v_nis; end if;
  v_per := sigarda.rapikan(p_d ->> 'perindukan');
  v_bar := sigarda.rapikan(p_d ->> 'barung');
  if char_length(v_per) > 40 or char_length(v_bar) > 40 then raise exception 'Nama perindukan dan barung maksimal 40 karakter.'; end if;
  if v_per ~ '[[:cntrl:]<>]' or v_bar ~ '[[:cntrl:]<>]' then raise exception 'Nama perindukan dan barung tidak boleh memuat karakter < atau >.'; end if;
  if v_bar <> '' and v_per = '' then raise exception 'Barung harus berada di sebuah perindukan: isi perindukannya.'; end if;
  if v_per <> '' then v_per := coalesce((select perindukan from public.profiles where lower(perindukan) = lower(v_per) limit 1), v_per); end if;
  if v_bar <> '' then v_bar := coalesce((select barung from public.profiles where lower(barung) = lower(v_bar) and lower(perindukan) = lower(v_per) limit 1), v_bar); end if;
  return jsonb_build_object('nama', v_nama, 'kelas', v_kelas, 'jk', nullif(v_jk, ''), 'agama', nullif(v_agama, ''), 'nis', nullif(v_nis, ''),
    'perindukan', nullif(v_per, ''), 'barung', nullif(v_bar, ''));
end $$;

-- Menambah anggota Siaga (banyak sekaligus; semua atau tidak sama sekali). p_data = larik { nama, kelas, jk?, agama?, nis?, perindukan?, barung? }.
create or replace function public.sg_siaga_tambah(p_data jsonb) returns int language plpgsql security definer set search_path = public as
$$
declare v_e jsonb; v_n int := 0; v_h jsonb; v_id uuid;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat menambah anggota Siaga.'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'array' or jsonb_array_length(p_data) = 0 then raise exception 'Tidak ada data anggota.'; end if;
  if jsonb_array_length(p_data) > 300 then raise exception 'Paling banyak 300 anggota sekali tambah.'; end if;
  for v_e in select * from jsonb_array_elements(p_data) loop
    v_n := v_n + 1;
    begin
      v_h := sigarda.siaga_periksa(v_e);
    exception when others then
      raise exception 'Baris %: %', v_n, sqlerrm;
    end;
    v_id := gen_random_uuid();
    insert into public.profiles (id, username, role, nama, nis, kelas, agama, jenis_kelamin, perindukan, barung, tanpa_akun, wajib_ganti_pin)
    values (v_id, 'siaga' || substr(md5(v_id::text), 1, 12), 'peserta', v_h ->> 'nama', v_h ->> 'nis', v_h ->> 'kelas', v_h ->> 'agama', v_h ->> 'jk',
            v_h ->> 'perindukan', v_h ->> 'barung', true, false);
  end loop;
  return v_n;
end $$;

-- Mengubah data satu anggota Siaga (semua kolom diganti sesuai isian; kosong = dikosongkan).
create or replace function public.sg_siaga_ubah(p_id uuid, p_data jsonb) returns void language plpgsql security definer set search_path = public as
$$
declare v_h jsonb;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat mengubah data anggota Siaga.'; end if;
  if not exists (select 1 from public.profiles where id = p_id and tanpa_akun) then raise exception 'Anggota Siaga tidak ditemukan.'; end if;
  v_h := sigarda.siaga_periksa(p_data, p_id);
  update public.profiles set nama = v_h ->> 'nama', kelas = v_h ->> 'kelas', jenis_kelamin = v_h ->> 'jk', agama = v_h ->> 'agama', nis = v_h ->> 'nis',
    perindukan = v_h ->> 'perindukan', barung = v_h ->> 'barung'
  where id = p_id;
end $$;

-- Menghapus anggota Siaga yang salah dimasukkan. Hanya bila belum punya catatan apa pun (SKU, kehadiran, iuran); selebihnya gunakan status nonaktif/alumni.
create or replace function public.sg_siaga_hapus(p_id uuid) returns void language plpgsql security definer set search_path = public as
$$
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat menghapus anggota Siaga.'; end if;
  if not exists (select 1 from public.profiles where id = p_id and tanpa_akun) then raise exception 'Anggota Siaga tidak ditemukan.'; end if;
  if exists (select 1 from public.sku_progress where peserta_id = p_id) or exists (select 1 from public.sku_riwayat where peserta_id = p_id)
     or exists (select 1 from public.absensi_hadir where peserta_id = p_id) or exists (select 1 from public.iuran where peserta_id = p_id) then
    raise exception 'Anggota ini sudah punya catatan (SKU, kehadiran, atau iuran). Ubah statusnya menjadi nonaktif, jangan dihapus.';
  end if;
  delete from public.profiles where id = p_id;
end $$;

-- Menempatkan banyak anggota Siaga ke perindukan dan barung sekaligus (semua atau tidak sama sekali). Perindukan kosong = dikeluarkan dari kelompok.
create or replace function public.sg_barung_atur(p_ids uuid[], p_perindukan text, p_barung text) returns int language plpgsql security definer set search_path = public as
$$
declare v_h jsonb; v_n int;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat mengatur barung.'; end if;
  if p_ids is null or cardinality(p_ids) = 0 then raise exception 'Pilih anggota lebih dulu.'; end if;
  if cardinality(p_ids) > 300 then raise exception 'Paling banyak 300 anggota sekali atur.'; end if;
  if (select count(*) from public.profiles where id = any (p_ids) and tanpa_akun) <> (select count(distinct x) from unnest(p_ids) x) then
    raise exception 'Ada anggota yang bukan anggota Siaga atau tidak ditemukan.';
  end if;
  v_h := sigarda.siaga_periksa(jsonb_build_object('nama', 'x', 'kelas', '1', 'perindukan', p_perindukan, 'barung', p_barung));
  update public.profiles set perindukan = v_h ->> 'perindukan', barung = v_h ->> 'barung' where id = any (p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
-- ===== akhir anggota Siaga tanpa akun =====

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
          from public.profiles p where p.role = 'peserta' and p.status = 'aktif' and not p.tanpa_akun
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
      else (select count(*) from public.profiles p where p.role = 'peserta' and p.status = 'aktif' and not p.tanpa_akun and (
        p.whatsapp is null or btrim(p.whatsapp) = '' or p.jenis_kelamin is null or p.agama is null
        or not exists (select 1 from public.tanggal_lahir t where t.peserta_id = p.id)
        or not exists (select 1 from public.penegak_isian i where i.peserta_id = p.id and i.kunci = 'tempat_lahir')
        or not exists (select 1 from public.penegak_isian i where i.peserta_id = p.id and i.kunci = 'alamat')
        or not exists (select 1 from public.penegak_isian i where i.peserta_id = p.id and i.kunci in ('ayah_nama', 'ibu_nama', 'wali_nama')))) end,
    'belumPernahMasuk', case when jsonb_array_length(v_hasil -> 'belumPernahMasuk') < 300 then jsonb_array_length(v_hasil -> 'belumPernahMasuk')
      else (select count(*) from public.profiles p join auth.users u on u.id = p.id where p.status = 'aktif' and u.last_sign_in_at is null) end
  ));
end $$;

revoke all on function
  public.sg_siaga_tambah(jsonb), public.sg_siaga_ubah(uuid, jsonb), public.sg_siaga_hapus(uuid), public.sg_barung_atur(uuid[], text, text), public.sg_pemeriksaan_data()
  from public, anon, authenticated;
grant execute on function
  public.sg_siaga_tambah(jsonb), public.sg_siaga_ubah(uuid, jsonb), public.sg_siaga_hapus(uuid), public.sg_barung_atur(uuid[], text, text), public.sg_pemeriksaan_data()
  to authenticated;
-- Fungsi sigarda.* baru: hak dijalankan ulang di sini (grant "all functions in schema" tidak retroaktif untuk fungsi baru).
revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
