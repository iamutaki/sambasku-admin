# sambasku-admin

Admin console Kamus Digital Sambas–Indonesia (React + Ant Design + TanStack).

## Deploy Staging

Hosting: **Cloudflare Pages** — project `sambasku-admin-staging`, custom domain
`https://console-sambasku-staging.iamutaki.com`.

Deploy **murni lewat CI/CD** (`.github/workflows/deploy-staging.yml`): push ke
branch `staging` (atau jalankan manual dari tab Actions) → lint + test + build →
`wrangler pages deploy dist`.

### Setup sekali

1. Tambah secret repo (Settings → Secrets and variables → Actions):
   - `CLOUDFLARE_API_TOKEN` — izin **Cloudflare Pages: Edit**
   - `CLOUDFLARE_ACCOUNT_ID`
2. Push ke `staging` — job membuat project Pages otomatis, lalu deploy.
3. Attach custom domain di dashboard Cloudflare:
   Workers & Pages → `sambasku-admin-staging` → Custom domains →
   tambah `console-sambasku-staging.iamutaki.com` (DNS + sertifikat otomatis,
   satu akun/zone).
4. Pastikan `CORS_ALLOWED_ORIGINS` API staging
   (`api/wrangler.toml` → `env.staging.vars`) memuat origin di atas.

### Kenapa custom domain wajib

Cookie `refresh_token` API ber-`SameSite=Strict`. Admin dan API harus satu
registrable domain (`iamutaki.com`) supaya cookie terkirim saat auto-refresh
sesi. Domain `*.pages.dev` adalah situs berbeda → sesi "amnesia" ke halaman login.

### Routing SPA

`public/_redirects` berisi `/* /index.html 200` — deep-link / refresh pada rute
history-mode TanStack Router (`/dashboard`, `/words`, `/audit-logs`) tetap
dilayani `index.html`, bukan 404.

## Scripts

| Perintah | Fungsi |
| --- | --- |
| `pnpm dev` | Vite dev server (proxy `/api` → API staging) |
| `pnpm build:staging` | Build mode staging |
| `pnpm build` | Build mode production |
| `pnpm lint` / `pnpm test` / `pnpm typecheck` | Quality gate |
