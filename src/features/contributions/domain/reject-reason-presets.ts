/** Alasan penolakan siap pakai - dikirim sebagai `comment` ke API reject. */

export const REJECT_REASON_PRESET_IDS = [
  'spam',
  'duplicate',
  'inaccurate',
  'incomplete',
  'inappropriate',
  'image',
  'other',
] as const;

export type RejectReasonPresetId = (typeof REJECT_REASON_PRESET_IDS)[number];

export const REJECT_REASON_PRESETS: ReadonlyArray<{
  id: RejectReasonPresetId;
  label: string;
}> = [
  { id: 'spam', label: 'Spam atau tidak relevan dengan kamus' },
  { id: 'duplicate', label: 'Duplikat kata / makna yang sudah ada' },
  { id: 'inaccurate', label: 'Definisi atau terjemahan tidak akurat' },
  { id: 'incomplete', label: 'Data kurang lengkap (makna, terjemahan, atau contoh)' },
  { id: 'inappropriate', label: 'Konten tidak pantas atau melanggar pedoman' },
  { id: 'image', label: 'Gambar tidak relevan atau tidak pantas' },
  { id: 'other', label: 'Lainnya' },
];

export const DEFAULT_REJECT_REASON_PRESET: RejectReasonPresetId = 'spam';

export function resolveRejectComment(
  presetId: RejectReasonPresetId,
  otherText: string,
): string {
  if (presetId === 'other') return otherText.trim();
  const found = REJECT_REASON_PRESETS.find((p) => p.id === presetId);
  return found?.label ?? '';
}
