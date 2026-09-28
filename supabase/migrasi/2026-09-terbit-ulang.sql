-- ============================================================================
-- MIGRASI: terbit ulang situs saat berita diterbitkan (pengganti deploy harian). AMAN untuk database berisi data.
--
-- Jalankan SETELAH migrasi 2026-09-berita-publik.sql (bila belum, berhenti dengan pesan yang menuntun). Isi:
--   * Tabel public.terbit_ulang_konfigurasi (satu baris; memuat kunci akses GitHub yang RAHASIA: RLS tanpa kebijakan, tanpa hak baca, tidak ikut cadangan).
--   * Fungsi sigarda.terbit_ulang_atur / _kirim / _keadaan / _matikan (hanya dari SQL Editor), _periksa / _catat / _kirim_sekarang (dijalankan pg_cron dan fungsi lain),
--     pemicu pada beranda_berita yang menandai perubahan berita terbit, dan fungsi aplikasi sg_terbit_ulang_status / sg_terbit_ulang_minta (Pembina dan Admin Gudep).
--   * Belum melakukan apa pun sampai pemilik menjalankan sigarda.terbit_ulang_atur (lihat README, bagian "Halaman berita untuk mesin pencari").
-- TIDAK menghapus data. Edge Function TIDAK berubah. Aman diulang.
--
-- Cara: Supabase > SQL Editor > New query > tempel seluruh isi berkas ini > Run.
-- Isi sama dengan bagian yang sama di supabase/sumber/*.sql (dijaga oleh pengujian kesetaraan).
-- ============================================================================
set check_function_bodies = off;
begin;

do $$
begin
  if to_regprocedure('public.sg_berita_publik()') is null then
    raise exception 'Jalankan lebih dulu migrasi 2026-09-berita-publik.sql (lihat README), baru migrasi ini.';
  end if;
end $$;

-- ===== Terbit ulang situs saat berita terbit: tabel =====
-- Halaman berita statis (berita/<id>-<judul>/ dan sitemap) dibuat saat build di GitHub Actions. Supaya berita yang baru diterbitkan (atau yang jadwal terbitnya tiba)
-- ikut terbit tanpa deploy harian, basis data meminta GitHub menjalankan alur deploy lewat pg_net. Satu baris; diisi pemilik proyek SEKALI lewat
-- sigarda.terbit_ulang_atur di SQL Editor dengan kunci akses GitHub (fine-grained token, HANYA izin Actions: Read and write pada repositori ini). Kunci itu RAHASIA:
-- tanpa kebijakan RLS dan tanpa hak baca (hanya fungsi), tidak ikut sg_cadangan_admin, dan tidak ikut cadangan otomatis (scripts/cadangan/dump.mjs).
create table if not exists public.terbit_ulang_konfigurasi (
  id boolean primary key default true check (id),
  repo text not null check (repo ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  alur text not null default 'deploy.yml' check (alur ~ '^[A-Za-z0-9_.-]+\.ya?ml$'),
  cabang text not null default 'main' check (cabang ~ '^[A-Za-z0-9_./-]{1,100}$'),
  token text not null check (char_length(token) between 20 and 400),
  diubah timestamptz not null default now(),
  perlu boolean not null default false,      -- ada perubahan berita terbit yang belum diminta terbit ulang
  perlu_sejak timestamptz,
  kirim_terakhir timestamptz,
  kirim_id bigint,                           -- id permintaan pg_net yang jawabannya belum dicatat
  status_terakhir int,
  pesan_terakhir text,
  gagal_beruntun int not null default 0      -- 3 kali gagal beruntun = berhenti mencoba sampai ada perubahan baru atau tindakan pemilik
);
-- ===== akhir tabel terbit ulang =====

alter table public.terbit_ulang_konfigurasi enable row level security;
-- Tabel baru menerima hak penuh bawaan Supabase: dicabut (memuat kunci akses; hanya fungsi yang boleh menyentuhnya).
revoke all on public.terbit_ulang_konfigurasi from anon, authenticated;

-- ===== Terbit ulang situs saat berita terbit: fungsi =====
-- Pemilik proyek menjalankan SEKALI di SQL Editor: select sigarda.terbit_ulang_atur('pemilik/repositori', '<kunci akses GitHub>');
-- Menyimpan repositori dan kunci lalu menjadwalkan satu pekerjaan pg_cron (tiap 5 menit): ia hanya mengirim permintaan bila ada berita terbit yang berubah atau yang
-- jadwalnya baru tiba, jadi tanpa perubahan tidak ada deploy sama sekali.
create or replace function sigarda.terbit_ulang_atur(p_repo text, p_token text, p_alur text default 'deploy.yml', p_cabang text default 'main') returns text
language plpgsql security definer set search_path = public as
$$
declare v_repo text := btrim(coalesce(p_repo, '')); v_token text := btrim(coalesce(p_token, '')); v_alur text := btrim(coalesce(p_alur, '')); v_cabang text := btrim(coalesce(p_cabang, '')); v_catatan text := '';
begin
  if auth.uid() is not null then raise exception 'Pengaturan terbit ulang hanya dari SQL Editor Supabase.'; end if;
  if v_repo !~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' then raise exception 'Repositori harus berbentuk pemilik/nama, mis. tribudi3267/sigarda.'; end if;
  if char_length(v_token) not between 20 and 400 then raise exception 'Kunci akses GitHub tampak tidak sah (fine-grained token dengan izin Actions: Read and write pada repositori ini).'; end if;
  if v_alur !~ '^[A-Za-z0-9_.-]+\.ya?ml$' then raise exception 'Nama berkas alur harus berakhiran .yml atau .yaml, mis. deploy.yml.'; end if;
  if v_cabang !~ '^[A-Za-z0-9_./-]{1,100}$' then raise exception 'Nama cabang tidak sah.'; end if;
  insert into public.terbit_ulang_konfigurasi (id, repo, alur, cabang, token) values (true, v_repo, v_alur, v_cabang, v_token)
  on conflict (id) do update set repo = excluded.repo, alur = excluded.alur, cabang = excluded.cabang, token = excluded.token, diubah = now(),
    perlu = false, perlu_sejak = null, kirim_id = null, status_terakhir = null, pesan_terakhir = null, gagal_beruntun = 0;
  if to_regnamespace('cron') is null then
    v_catatan := v_catatan || ' pg_cron belum aktif: aktifkan di Dashboard > Integrations lalu jalankan perintah ini lagi (jadwal pemeriksaan belum dibuat).';
  else
    perform cron.schedule('sigarda-terbit-ulang', '*/5 * * * *', 'select sigarda.terbit_ulang_periksa()');
  end if;
  if to_regnamespace('net') is null then
    v_catatan := v_catatan || ' pg_net belum aktif: aktifkan di Dashboard > Integrations lalu jalankan perintah ini lagi (permintaan belum dapat dikirim).';
  end if;
  return 'Terbit ulang tersimpan.' || case when v_catatan = '' then ' Untuk mencoba sekarang jalankan: select sigarda.terbit_ulang_kirim(); lalu beberapa detik kemudian: select sigarda.terbit_ulang_keadaan();' else v_catatan end;
end $$;

-- Meminta GitHub menjalankan alur deploy (POST .../actions/workflows/<alur>/dispatches, jawaban sukses = HTTP 204), asinkron lewat pg_net. Mengembalikan id permintaan,
-- atau null tanpa konfigurasi atau tanpa pg_net. Galat tidak dilempar: dicatat, dan perubahan tetap ditandai "perlu" agar dicoba lagi.
create or replace function sigarda.terbit_ulang_kirim_sekarang() returns bigint language plpgsql security definer set search_path = public as
$$
declare v public.terbit_ulang_konfigurasi; v_id bigint;
begin
  select * into v from public.terbit_ulang_konfigurasi;
  if not found or to_regnamespace('net') is null then return null; end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := $4)'
      into v_id
      using 'https://api.github.com/repos/' || v.repo || '/actions/workflows/' || v.alur || '/dispatches', jsonb_build_object('ref', v.cabang),
            jsonb_build_object('Accept', 'application/vnd.github+json', 'Authorization', 'Bearer ' || v.token, 'X-GitHub-Api-Version', '2022-11-28',
              'User-Agent', 'sigarda-terbit-ulang', 'Content-Type', 'application/json'), 10000;
  exception when others then
    update public.terbit_ulang_konfigurasi set kirim_terakhir = now(), kirim_id = null, status_terakhir = 0, pesan_terakhir = 'Gagal mengantre permintaan ke GitHub.',
      perlu = true, perlu_sejak = coalesce(perlu_sejak, now()), gagal_beruntun = gagal_beruntun + 1;
    return null;
  end;
  update public.terbit_ulang_konfigurasi set kirim_terakhir = now(), kirim_id = v_id, status_terakhir = null, pesan_terakhir = 'Menunggu jawaban GitHub', perlu = false, perlu_sejak = null;
  return v_id;
end $$;

-- Mencatat jawaban GitHub atas permintaan terakhir dari net._http_response. Sukses (204) menutup permintaan; selain itu perubahan ditandai "perlu" lagi dan pesannya menuntun.
create or replace function sigarda.terbit_ulang_catat() returns void language plpgsql security definer set search_path = public as
$$
declare v public.terbit_ulang_konfigurasi; v_n int; v_status int; v_galat text;
begin
  select * into v from public.terbit_ulang_konfigurasi;
  if not found or v.kirim_id is null or to_regnamespace('net') is null then return; end if;
  begin
    execute 'select count(*)::int, max(status_code), max(error_msg) from net._http_response where id = $1' into v_n, v_status, v_galat using v.kirim_id;
  exception when others then
    return;
  end;
  if v_n = 0 then return; end if;
  if v_status = 204 then
    update public.terbit_ulang_konfigurasi set status_terakhir = 204, kirim_id = null, gagal_beruntun = 0,
      pesan_terakhir = 'Deploy diminta ke GitHub (HTTP 204); halaman berita siap sekitar 2 sampai 3 menit lagi.';
  else
    update public.terbit_ulang_konfigurasi set status_terakhir = coalesce(v_status, 0), kirim_id = null, perlu = true, perlu_sejak = coalesce(perlu_sejak, now()), gagal_beruntun = gagal_beruntun + 1,
      pesan_terakhir = coalesce(v_galat, 'HTTP ' || v_status || (case
        when v_status = 401 then ': kunci akses GitHub salah atau sudah kedaluwarsa (buat kunci baru lalu jalankan sigarda.terbit_ulang_atur lagi)'
        when v_status = 403 then ': kunci tidak punya izin Actions (Read and write) pada repositori ini'
        when v_status = 404 then ': repositori, berkas alur, atau akses kunci tidak cocok'
        when v_status = 422 then ': cabang atau berkas alur tidak ditemukan, atau alur belum mengizinkan dijalankan manual (workflow_dispatch)'
        else '' end));
  end if;
end $$;

-- Dipanggil pg_cron tiap 5 menit: mencatat jawaban terakhir, lalu meminta terbit ulang HANYA bila ada berita terbit yang berubah (penanda "perlu" dari pemicu) atau
-- yang jadwal terbitnya tiba sejak permintaan terakhir. Berhenti mencoba sesudah 3 kegagalan beruntun; jeda minimal 4 menit antar permintaan.
create or replace function sigarda.terbit_ulang_periksa() returns bigint language plpgsql security definer set search_path = public as
$$
declare v public.terbit_ulang_konfigurasi; v_jadwal boolean;
begin
  perform sigarda.terbit_ulang_catat();
  select * into v from public.terbit_ulang_konfigurasi;
  if not found or v.gagal_beruntun >= 3 then return null; end if;
  if v.kirim_terakhir is not null and v.kirim_terakhir > now() - interval '4 minutes' then return null; end if;
  v_jadwal := exists (select 1 from public.beranda_berita where status = 'terbit' and terbit_pada <= now() and terbit_pada > coalesce(v.kirim_terakhir, '-infinity'::timestamptz));
  if not (v.perlu or v_jadwal) then return null; end if;
  return sigarda.terbit_ulang_kirim_sekarang();
end $$;

-- Keadaan terbit ulang TANPA kunci dan repositori (untuk layar Kelola Beranda dan untuk pemilik di SQL Editor): { diatur, perlu, kirimTerakhir, status, pesan, gagalBeruntun, menyerah }.
create or replace function sigarda.terbit_ulang_keadaan() returns jsonb language plpgsql security definer set search_path = public as
$$
declare v public.terbit_ulang_konfigurasi;
begin
  select * into v from public.terbit_ulang_konfigurasi;
  if not found then return jsonb_build_object('diatur', false); end if;
  return jsonb_build_object('diatur', true, 'perlu', v.perlu, 'kirimTerakhir', v.kirim_terakhir, 'status', v.status_terakhir, 'pesan', v.pesan_terakhir,
    'gagalBeruntun', v.gagal_beruntun, 'menyerah', v.gagal_beruntun >= 3);
end $$;

-- Untuk pemilik di SQL Editor: mengirim permintaan terbit ulang sekarang (untuk mencoba pengaturan) dan menghapus hitungan gagal.
create or replace function sigarda.terbit_ulang_kirim() returns text language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null then raise exception 'Perintah ini hanya dari SQL Editor Supabase.'; end if;
  if not exists (select 1 from public.terbit_ulang_konfigurasi) then raise exception 'Belum diatur: jalankan sigarda.terbit_ulang_atur lebih dulu.'; end if;
  if to_regnamespace('net') is null then raise exception 'pg_net belum aktif (Dashboard > Integrations).'; end if;
  update public.terbit_ulang_konfigurasi set gagal_beruntun = 0;
  perform sigarda.terbit_ulang_kirim_sekarang();
  return 'Permintaan terbit ulang dikirim. Beberapa detik lagi jalankan: select sigarda.terbit_ulang_periksa(); select sigarda.terbit_ulang_keadaan();';
end $$;

-- Mematikan terbit ulang otomatis: menghapus pekerjaan pg_cron dan konfigurasi (termasuk kunci akses).
create or replace function sigarda.terbit_ulang_matikan() returns void language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null then raise exception 'Perintah ini hanya dari SQL Editor Supabase.'; end if;
  if to_regnamespace('cron') is not null then
    begin
      perform cron.unschedule('sigarda-terbit-ulang');
    exception when others then null; end;
  end if;
  delete from public.terbit_ulang_konfigurasi;
end $$;

-- Pemicu: setiap perubahan yang menyentuh berita TERBIT (diterbitkan, diubah, dibatalkan/ditolak dari terbit, atau dihapus) menandai bahwa halaman berita perlu terbit ulang
-- (pekerjaan pg_cron yang mengirim permintaannya, sehingga banyak perubahan dalam 5 menit menjadi satu deploy). Tanpa konfigurasi tidak melakukan apa pun.
create or replace function sigarda.terbit_ulang_tandai() returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if (TG_OP = 'INSERT' and NEW.status = 'terbit') or (TG_OP = 'DELETE' and OLD.status = 'terbit') or (TG_OP = 'UPDATE' and (OLD.status = 'terbit' or NEW.status = 'terbit')) then
    update public.terbit_ulang_konfigurasi set perlu = true, perlu_sejak = coalesce(perlu_sejak, now()), gagal_beruntun = 0;
  end if;
  return null;
end $$;
drop trigger if exists terbit_ulang_berita on public.beranda_berita;
create trigger terbit_ulang_berita after insert or update or delete on public.beranda_berita for each row execute function sigarda.terbit_ulang_tandai();

-- Untuk Pembina dan Admin Gudep (layar Kelola Beranda > Berita): keadaan terbit ulang terbaru (jawaban GitHub dicatat dulu).
create or replace function public.sg_terbit_ulang_status() returns jsonb language plpgsql security definer set search_path = public as
$$
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat melihat keadaan terbit ulang halaman berita.'; end if;
  perform sigarda.terbit_ulang_catat();
  return sigarda.terbit_ulang_keadaan();
end $$;

-- Tombol "Terbitkan ulang halaman berita sekarang" (Pembina dan Admin Gudep): meminta deploy segera, paling cepat tiap 2 menit; menghapus hitungan gagal (mencoba lagi).
create or replace function public.sg_terbit_ulang_minta() returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_terakhir timestamptz;
begin
  perform sigarda.wajib_aktif();
  if not sigarda.pembina_atau_admin() then raise exception 'Hanya Pembina dan Admin Gudep yang dapat meminta terbit ulang halaman berita.'; end if;
  if not exists (select 1 from public.terbit_ulang_konfigurasi) then raise exception 'Terbit ulang otomatis belum diatur oleh pemilik proyek (lihat README, bagian Halaman berita untuk mesin pencari).'; end if;
  perform sigarda.terbit_ulang_catat();
  select kirim_terakhir into v_terakhir from public.terbit_ulang_konfigurasi;
  if v_terakhir is not null and v_terakhir > now() - interval '2 minutes' then raise exception 'Permintaan baru saja dikirim. Tunggu beberapa menit sebelum meminta lagi.'; end if;
  update public.terbit_ulang_konfigurasi set gagal_beruntun = 0;
  perform sigarda.terbit_ulang_kirim_sekarang();
  return sigarda.terbit_ulang_keadaan();
end $$;
-- ===== akhir fungsi terbit ulang =====

revoke all on function public.sg_terbit_ulang_status(), public.sg_terbit_ulang_minta() from public, anon, authenticated;
grant execute on function public.sg_terbit_ulang_status(), public.sg_terbit_ulang_minta() to authenticated;
-- Fungsi sigarda.* baru: hak dijalankan ulang di sini (grant "all functions in schema" tidak retroaktif untuk fungsi baru).
revoke all on all functions in schema sigarda from public, anon;
grant execute on all functions in schema sigarda to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
