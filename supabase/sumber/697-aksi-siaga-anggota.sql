-- ===== Anggota Siaga tanpa akun (Pramuka Siaga, Fase 1): fungsi =====
-- Anak Siaga TIDAK punya akun masuk: profilnya (role 'peserta', tanpa_akun = true) dibuat dan dirawat Pembina/Admin lewat fungsi di bawah,
-- tanpa auth.users, PIN, WhatsApp, atau isian mandiri. Kelas berupa angka 1-6 dengan paralel opsional (1, 4A, 5B): sigarda.rombel_sah.
-- Kelompok: perindukan (3-4 barung) dan barung (6-8 anak); penulisan nama disamakan dengan yang sudah ada (tanpa membedakan huruf besar/kecil).

-- Profil ikut terhapus bila akun loginnya dihapus (dulu oleh FK ON DELETE CASCADE ke auth.users, kini FK itu tidak ada agar anggota tanpa akun dapat disimpan).
create function sigarda.profil_hapus_bersama_akun() returns trigger language plpgsql security definer set search_path = public as
$$ begin delete from public.profiles where id = old.id and not tanpa_akun; return old; end $$;
drop trigger if exists profil_hapus_bersama_akun on auth.users;
create trigger profil_hapus_bersama_akun after delete on auth.users for each row execute function sigarda.profil_hapus_bersama_akun();

-- Memeriksa dan merapikan satu anggota Siaga; mengembalikan kolom yang sudah bersih (jsonb) atau melempar galat berbahasa Indonesia.
-- Dicerminkan src/lib/siagaLogic.js (periksaSiaga) dan DIBANDINGKAN LANGSUNG dengan fungsi ini oleh uji/siaga-klien.mjs.
create function sigarda.siaga_periksa(p_d jsonb, p_id uuid default null) returns jsonb language plpgsql stable security definer set search_path = public as
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
create function public.sg_siaga_tambah(p_data jsonb) returns int language plpgsql security definer set search_path = public as
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
create function public.sg_siaga_ubah(p_id uuid, p_data jsonb) returns void language plpgsql security definer set search_path = public as
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
create function public.sg_siaga_hapus(p_id uuid) returns void language plpgsql security definer set search_path = public as
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
create function public.sg_barung_atur(p_ids uuid[], p_perindukan text, p_barung text) returns int language plpgsql security definer set search_path = public as
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
