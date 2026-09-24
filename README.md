<p align="center">
  <img src="logo.png" alt="SambasKu" width="320" />
</p>

# SambasKu Admin

Konsol admin **Kamus Digital Sambas-Indonesia**. Dipakai verifikator dan
admin untuk mengelola kata, antrean kontribusi, moderasi, dan pengguna.

## Stack

| Layer | Pilihan |
| --- | --- |
| Framework | React 19 + Vite (SPA) |
| UI | Ant Design 6, TanStack Router / Query / Table |
| HTTP | Axios (`/api` di-proxy ke API staging saat `pnpm dev`) |
| Deploy | Cloudflare Pages |

Acuan tetap: `docs/admin/admin-base-stack.md` di repo
[sambasku-docs](https://github.com/iamutaki/sambasku-docs).
Kontrak API: envelope, cursor pagination, role matrix di `docs/api/*`.

## Fitur utama

| Area | Rute |
| --- | --- |
| Dashboard | `/dashboard` |
| Kata (list, buat, edit, detail) | `/words`, `/words/new`, `/words/$id` |
| Antrean kontribusi | `/contributions` |
| Moderasi komentar + blocklist | `/comments`, `/comment-blocklist` |
| Search miss | `/search-misses` |
| Moderasi vote | `/vote-moderation` |
| Usulan edit kata | `/word-suggestions` |
| Laporan kata / bug | `/word-reports`, `/bug-reports` |
| Pengguna + pengajuan verifikator | `/users`, `/verifier-applications` |
| Audit log | `/audit-logs` |

Auth: login email/password. Access token di memori; refresh token di
cookie HttpOnly (`SameSite=Strict`) dari API.

## Aset media

| Jenis | Alur |
| --- | --- |
| Gambar kata / avatar | Multipart ke API → repo [sambasku/images](https://github.com/sambasku/images) (jsDelivr + wsrv) |
| Audio pelafalan | Multipart ke API → repo [sambasku/audios](https://github.com/sambasku/audios) |
| Bukti verifikator / lampiran bug | Token ImageKit (privat), bukan GitHub |

## Struktur singkat

```text
src/
├── app/                 # router, providers
├── features/<fitur>/    # domain → application → infrastructure → presentation
├── shared/              # api client, layouts, hooks, utils
└── styles/
```

## Scripts

| Perintah | Fungsi |
| --- | --- |
| `pnpm install` | Pasang dependensi |
| `pnpm dev` | Vite (proxy `/api` → API staging) |
| `pnpm build:staging` | Build mode staging |
| `pnpm build` | Build mode production |
| `pnpm lint` / `pnpm test` / `pnpm typecheck` | Quality gate |

## Deploy Staging

Hosting: **Cloudflare Pages** - project `sambasku-admin-staging`, custom
domain `https://console-sambasku-staging.iamutaki.com`.

Deploy **murni lewat CI/CD** (`.github/workflows/deploy-staging.yml`):
push ke branch `staging` (atau jalankan manual dari tab Actions) →
lint + test + build → `wrangler pages deploy dist`.

### Setup sekali

1. Tambah secret repo (Settings → Secrets and variables → Actions):
   - `CLOUDFLARE_API_TOKEN` - izin **Cloudflare Pages: Edit**
   - `CLOUDFLARE_ACCOUNT_ID`
2. Push ke `staging` - job membuat project Pages otomatis, lalu deploy.
3. Attach custom domain di dashboard Cloudflare:
   Workers & Pages → `sambasku-admin-staging` → Custom domains →
   tambah `console-sambasku-staging.iamutaki.com` (DNS + sertifikat
   otomatis, satu akun/zone).
4. Pastikan `CORS_ALLOWED_ORIGINS` API staging
   (`api/wrangler.toml` → `env.staging.vars`) memuat origin di atas.

### Kenapa custom domain wajib

Cookie `refresh_token` API ber-`SameSite=Strict`. Admin dan API harus
satu registrable domain (`iamutaki.com` di staging / `sambasku.com` di
production) supaya cookie terkirim saat auto-refresh sesi. Domain
`*.pages.dev` adalah situs berbeda → sesi "amnesia" ke halaman login.

## Deploy Production

Hosting: **Cloudflare Pages** - project `sambasku-admin`, custom domain
`https://console.sambasku.com`. API: `https://api.sambasku.com/api/v1`.

Deploy: `.github/workflows/deploy-production.yml` — push ke branch
`main` (atau Run workflow manual) → lint + test + build → Pages deploy.

Setup sekali: attach `console.sambasku.com` ke project `sambasku-admin`,
pastikan CORS API production memuat `https://console.sambasku.com` dan
`https://sambasku.com`.

### Routing SPA

`public/_redirects` berisi `/* /index.html 200` - deep-link / refresh
pada rute history-mode TanStack Router tetap dilayani `index.html`,
bukan 404.
