import type {
  CreateWordFormValues,
  CreateWordMeaningFormValue,
  CreateWordRequest,
  CreateWordRequestExample,
  CreateWordRequestMeaning,
  CreateWordRequestRelated,
  CreateWordRequestTranslation,
  CreateWordRequestVariant,
  CreateWordExampleFormValue,
  CreateWordVariantFormValue,
  DialectOption,
  InlineWordFormValue,
  WordClassOption,
  InlineWordRequest,
  LanguageOption,
  MeaningOverrideFormValue,
  MeaningOverrideRequest,
  WordImageFormValue,
  WordImageInput,
} from '../domain/create-word';

/**
 * Pilihan bahasa default form (lemma = sumber, terjemahan = target).
 * Disebut "sumber" bukan "bahasa kanan" biar jelas: lemma dan contoh
 * kalimat ditulis dalam bahasa sumber, terjemahannya ke bahasa target.
 */
export interface DefaultLanguageIds {
  sourceId?: string;
  targetId?: string;
}

// Set huruf kecil yang dikenali sebagai bahasa Sambas / Indonesia.
// Kode resmi seed: SBS & IDN - tapi dikenali juga varian lain kalau
// dataset berubah, AGAR default TIDAK pernah tersilap memilih Indonesia
// sebagai lemma (bug lama: `code === 'sambas'` tak pernah cocok dengan
// 'SBS', fallback ke urutan list yang tidak stabil).
const SAMBAS_CODES = new Set(['sbs', 'sambas']);
const INDONESIAN_CODES = new Set(['idn', 'id', 'ind', 'indonesia', 'indonesian']);
const INDONESIAN_NAMES = new Set(['indonesia', 'bahasa indonesia', 'indonesian']);

export function pickDefaultLanguageIds(languages: LanguageOption[]): DefaultLanguageIds {
  const active = languages.filter((l) => l.is_active);
  const pool = active.length > 0 ? active : languages;
  const norm = (s: string | null) => (s ?? '').trim().toLowerCase();
  const isSambas = (l: LanguageOption) => SAMBAS_CODES.has(norm(l.code)) || norm(l.name) === 'sambas';
  const isIndonesian = (l: LanguageOption) =>
    INDONESIAN_CODES.has(norm(l.code)) || INDONESIAN_NAMES.has(norm(l.name));

  // Lemma harus bahasa sumber: Sambas diprioritaskan; kalau tidak ada,
  // hindari bahasa Indonesia (terjemahan) dijadikan lemma.
  const source = pool.find(isSambas) ?? pool.find((l) => !isIndonesian(l)) ?? pool[0];

  // Terjemahan ke bahasa target: Indonesia, tapi TIDAK boleh sama dengan sumber.
  const target = source
    ? (pool.find((l) => l.id !== source.id && isIndonesian(l)) ?? pool.find((l) => l.id !== source.id))
    : undefined;

  return { sourceId: source?.id, targetId: target?.id };
}

/**
 * Dialek default untuk form create: `is_default`, fallback code `umum`.
 * Return undefined kalau daftar kosong - biarkan Select kosong.
 */
export function pickDefaultDialectId(dialects: DialectOption[]): string | undefined {
  const active = dialects.filter((d) => d.is_active);
  const pool = active.length > 0 ? active : dialects;
  return (
    pool.find((d) => d.is_default)?.id ??
    pool.find((d) => d.code.trim().toLowerCase() === 'umum')?.id
  );
}

/**
 * Kelas kata default form create: code `umum` (fallback "belum diketahui").
 * Return undefined kalau tidak ada - biarkan Select kosong.
 */
export function pickUmumWordClassId(
  wordClasses: Pick<WordClassOption, 'id' | 'code'>[],
): string | undefined {
  return wordClasses.find((w) => w.code.trim().toLowerCase() === 'umum')?.id;
}

/**
 * Path error dari backend ("meanings.0.definition") → namePath antd Form
 * (["meanings", 0, "definition"]) supaya error inline jatuh di field benar.
 * Segmen numerik dianggap index array.
 */
export function fieldToNamePath(field: string): (string | number)[] {
  return field.split('.').map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

export function buildCreateWordBody(
  values: CreateWordFormValues,
  status: 'draft' | 'published',
  options?: { searchMissId?: string },
): CreateWordRequest {
  const meanings = buildMeanings(values.meanings ?? []);

  const relatedWords: CreateWordRequestRelated[] = (values.related_words ?? [])
    .filter((rel) => rel.relation_type)
    .map((rel) => {
      const relationType = rel.relation_type!;
      // 04: Form B - buat kata baru INLINE (indeks makna override dipetakan
      // dari posisi di form ke posisi di array meanings body yang terkirim).
      if (rel.mode === 'inline' && rel.word) {
        const word = buildInlineWord(rel.word, keptIndicesOf(values.meanings ?? []));
        return word ? { relation_type: relationType, word } : null;
      }
      return rel.word_id ? { relation_type: relationType, word_id: rel.word_id } : null;
    })
    .filter((rel): rel is CreateWordRequestRelated => rel !== null);

  const variants: CreateWordRequestVariant[] = buildVariants(values.variants ?? []);

  const pronunciation = buildPronunciation(values.pronunciation);

  const images = buildImages(values.images);

  return {
    language_id: values.language_id as string,
    ...(values.dialect_id ? { dialect_id: values.dialect_id } : {}),
    lemma: (values.lemma as string).trim(),
    lemma_allows_comma: values.lemma_allows_comma === true,
    ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
    word_type: values.word_type ?? 'word',
    usage_labels: values.usage_labels ?? [],
    meanings,
    category_ids: values.category_ids ?? [],
    related_words: relatedWords,
    ...(variants.length ? { variants } : {}),
    ...(pronunciation ? { pronunciation } : {}),
    ...(images.length ? { images } : {}),
    status,
    ...(options?.searchMissId ? { search_miss_id: options.searchMissId } : {}),
  };
}

/**
 * Indeks posisi form (di values.meanings) yang LULUS normalisasi - dipakai
 * memetakan meaning_index override (posisi form) ke index array meanings
 * body. Kalau sebuah makna induk dibuang (kosong), override yang menunjuknya
 * ikut dibuang sehingga indeks selalu konsisten dengan yang dikirim.
 */
function keptIndicesOf(meanings: NonNullable<CreateWordFormValues['meanings']>): number[] {
  const kept: number[] = [];
  for (const [i, meaning] of meanings.entries()) {
    if (normalizeMeaning(meaning)) kept.push(i);
  }
  return kept;
}

function buildMeanings(raw: CreateWordFormValues['meanings']): CreateWordRequestMeaning[] {
  const meanings = raw ?? [];
  const kept: number[] = [];
  const normalized = meanings
    .map((meaning, formIndex) => {
      const out = normalizeMeaning(meaning);
      if (out) kept.push(formIndex);
      return out;
    })
    .filter((m): m is CreateWordRequestMeaning => m !== null)
    .map((meaning, index): CreateWordRequestMeaning => {
      // order_index default = urutan tampil di antara makna yang DIKEEP
      return {
        ...meaning,
        order_index: meanings[kept[index]]?.order_index ?? index + 1,
      };
    });
  return normalized;
}

/** Normalisasi SATU makna: wajib kelas + (definisi nyata ATAU padanan). */
function normalizeMeaning(
  meaning: CreateWordMeaningFormValue,
): Omit<CreateWordRequestMeaning, 'order_index'> | null {
  if (!meaning.word_class_id) return null;

  const translations = (meaning.translations ?? [])
    .filter((t) => t.language_id && t.translation_text?.trim())
    .map((t): CreateWordRequestTranslation => ({
      language_id: t.language_id as string,
      translation_text: (t.translation_text as string).trim(),
      translation_type: t.translation_type ?? 'direct',
      ...(t.translation_allows_comma ? { translation_allows_comma: true } : {}),
    }));

  const hasDefinition = meaning.is_have_definition !== false;
  const def = hasDefinition ? (meaning.definition?.trim() ?? '') : '-';
  if (!def) return null;

  // Definisi placeholder "-" tanpa padanan tidak sah (API refineMeaningPadanan).
  if (def === '-' && translations.length === 0) return null;

  const examples: CreateWordRequestExample[] = (meaning.examples ?? [])
    .filter((e) => e.source_language_id && e.source_sentence?.trim())
    .map(buildExample);

  return {
    word_class_id: meaning.word_class_id as string,
    definition: def,
    is_have_definition: hasDefinition && def !== '-',
    is_have_translation: translations.length > 0,
    translations,
    ...(examples.length ? { examples } : {}),
  };
}

/**
 * 04: bangun entri kata baru inline (Form B) dari nilai form.
 * - lemma kosong → null (baris belum terisi, dibuang seperti baris lain).
 * - inherit=true (default) → meaning_overrides (translate-and-replace);
 *   indeks override dipetakan lewat keptIndicesOf agar selaras dgn body.
 * - inherit=false → meanings diisi penuh (normalisasi sama seperti induk).
 */
function buildInlineWord(
  word: InlineWordFormValue,
  keptIndices: number[],
): InlineWordRequest | null {
  const lemma = word.lemma?.trim();
  if (!lemma) return null;

  const inherit = word.inherit_meanings !== false;

  const overrides: MeaningOverrideRequest[] = inherit
    ? (word.meaning_overrides ?? [])
        .filter((o) => o.meaning_index !== undefined)
        .map((o): MeaningOverrideRequest | null => {
          const bodyIndex = keptIndices.indexOf(o.meaning_index!);
          if (bodyIndex < 0) return null;
          return buildMeaningOverride(o, bodyIndex);
        })
        .filter((o): o is MeaningOverrideRequest => o !== null)
    : [];

  const meanings = inherit ? undefined : buildMeanings(word.meanings ?? []);

  const variants = buildVariants(word.variants ?? []);
  const pronunciation = buildPronunciation(word.pronunciation);

  return {
    lemma,
    ...(word.notes?.trim() ? { notes: word.notes.trim() } : {}),
    ...(word.word_type ? { word_type: word.word_type } : {}),
    inherit_meanings: inherit,
    ...(overrides.length ? { meaning_overrides: overrides } : {}),
    ...(meanings?.length ? { meanings } : {}),
    ...(variants.length ? { variants } : {}),
    ...(pronunciation ? { pronunciation } : {}),
  };
}

/** Satu override: field yang tidak disebut (mis. word_class_id) tetap memakai
 * hasil salinan induk di server - di sini cukup kirim yang diisi saja. */
function buildMeaningOverride(
  override: MeaningOverrideFormValue,
  meaningIndex: number,
): MeaningOverrideRequest {
  const translations = (override.translations ?? [])
    .filter((t) => t.language_id && t.translation_text?.trim())
    .map((t): CreateWordRequestTranslation => ({
      language_id: t.language_id as string,
      translation_text: (t.translation_text as string).trim(),
      translation_type: t.translation_type ?? 'direct',
      ...(t.translation_allows_comma ? { translation_allows_comma: true } : {}),
    }));
  const examples: CreateWordRequestExample[] = (override.examples ?? [])
    .filter((e) => e.source_language_id && e.source_sentence?.trim())
    .map(buildExample);

  return {
    meaning_index: meaningIndex,
    ...(override.definition?.trim() ? { definition: override.definition.trim() } : {}),
    ...(override.word_class_id ? { word_class_id: override.word_class_id } : {}),
    ...(translations.length ? { translations } : {}),
    ...(examples.length ? { examples } : {}),
  };
}

function buildVariants(raw: CreateWordVariantFormValue[] | undefined): CreateWordRequestVariant[] {
  return (raw ?? [])
    .filter((variant) => variant.form?.trim())
    .map((variant) => ({
      form: (variant.form as string).trim(),
      variant_type: variant.variant_type ?? 'alternative',
      ...(variant.affix_type ? { affix_type: variant.affix_type } : {}),
      ...(variant.affix_value?.trim() ? { affix_value: variant.affix_value.trim() } : {}),
    }));
}

function buildPronunciation(
  pronunciation: CreateWordFormValues['pronunciation'],
): { notation: string; value: string } | undefined {
  return pronunciation?.value?.trim()
    ? {
        notation: pronunciation.notation?.trim() || 'ipa',
        value: pronunciation.value.trim(),
      }
    : undefined;
}

function buildExample(e: CreateWordExampleFormValue): CreateWordRequestExample {
  return {
    source_language_id: e.source_language_id as string,
    source_sentence: (e.source_sentence as string).trim(),
    ...(e.target_language_id ? { target_language_id: e.target_language_id } : {}),
    ...(e.target_sentence?.trim() ? { target_sentence: e.target_sentence.trim() } : {}),
    ...(e.source_type ? { source_type: e.source_type } : {}),
  };
}

/**
 * HANYA gambar yang selesai upload (status done + url + provider_file_id)
 * yang masuk body - item uploading/error tidak pernah terkirim (field
 * uid/fileName/status adalah state UI, di-strip). Eksklusivitas
 * is_primary dijaga UI; di sini diteruskan apa adanya.
 */
export function buildImages(raw: WordImageFormValue[] | undefined): WordImageInput[] {
  return (raw ?? [])
    .filter((img) => img.status === 'done' && img.url && img.provider_file_id)
    .map((img) => ({
      url: img.url as string,
      provider_file_id: img.provider_file_id as string,
      ...(img.provider ? { provider: img.provider } : {}),
      ...(img.sha ? { sha: img.sha } : {}),
      ...(img.alt_text?.trim() ? { alt_text: img.alt_text.trim() } : {}),
      is_primary: img.is_primary ?? false,
      content_warnings: img.content_warnings ?? [],
    }));
}

/** Ada item gambar yang masih uploading - submit harus ditahan (halaman). */
export function hasUploadingImages(raw: WordImageFormValue[] | undefined): boolean {
  return (raw ?? []).some((img) => img.status === 'uploading');
}