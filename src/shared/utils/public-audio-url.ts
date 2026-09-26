/**
 * Normalisasi URL publik audio pelafalan.
 *
 * Beberapa baris lama menyimpan CDN host repo yang sudah dipindah/diganti nama
 * (`iamutaki/sambasku-pronunciation` → `sambasku/audios`). jsDelivr tidak selalu
 * mengikuti rename GitHub, jadi player dapat 404 meski file ada di repo baru.
 */
const LEGACY_JSDELIVR_HOSTS: ReadonlyArray<{ from: RegExp; to: string }> = [
  {
    from: /^https:\/\/cdn\.jsdelivr\.net\/gh\/iamutaki\/sambasku-pronunciation@/i,
    to: 'https://cdn.jsdelivr.net/gh/sambasku/audios@',
  },
  {
    from: /^https:\/\/cdn\.jsdelivr\.net\/gh\/coem\/staging-audios@/i,
    to: 'https://cdn.jsdelivr.net/gh/sambasku/audios@',
  },
];

export function resolvePublicAudioUrl(url: string | null | undefined): string {
  const raw = (url ?? '').trim();
  if (!raw) return '';
  let out = raw;
  for (const { from, to } of LEGACY_JSDELIVR_HOSTS) {
    if (from.test(out)) {
      out = out.replace(from, to);
      break;
    }
  }
  return out;
}

/** Daftar kandidat src (asli + rewrite) tanpa duplikat - untuk fallback player. */
export function publicAudioUrlCandidates(url: string | null | undefined): string[] {
  const original = (url ?? '').trim();
  const resolved = resolvePublicAudioUrl(original);
  const out: string[] = [];
  for (const candidate of [resolved, original]) {
    if (candidate && !out.includes(candidate)) out.push(candidate);
  }
  return out;
}
