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
  InlineWordFormValue,
  InlineWordRequest,
  LanguageOption,
  MeaningOverrideFormValue,
  MeaningOverrideRequest,
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

  return {
    language_id: values.language_id as string,
    ...(values.dialect_id ? { dialect_id: values.dialect_id } : {}),
    lemma: (values.lemma as string).trim(),
    ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
    word_type: values.word_type ?? 'word',
    meanings,
    category_ids: values.category_ids ?? [],
    related_words: relatedWords,
    ...(variants.length ? { variants } : {}),
    ...(pronunciation ? { pronunciation } : {}),
    status,
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
    const hasTranslation = (meaning.translations ?? []).some(
      (t) => t.language_id && t.translation_text?.trim(),
    );
    if (meaning.word_class_id && meaning.definition?.trim() && hasTranslation) {
      kept.push(i);
    }
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

/** Normalisasi SATU makna (induk ATAU inline inherit=false): makna tanpa isi
 * (kelas kata/definisi/terjemahan kosong) dibuang, sisanya dibersihkan. */
function normalizeMeaning(
  meaning: CreateWordMeaningFormValue,
): Omit<CreateWordRequestMeaning, 'order_index'> | null {
  if (!meaning.word_class_id || !meaning.definition?.trim()) return null;

  const translations = (meaning.translations ?? [])
    .filter((t) => t.language_id && t.translation_text?.trim())
    .map((t): CreateWordRequestTranslation => ({
      language_id: t.language_id as string,
      translation_text: (t.translation_text as string).trim(),
      translation_type: t.translation_type ?? 'direct',
    }));
  if (translations.length === 0) return null;

  const examples: CreateWordRequestExample[] = (meaning.examples ?? [])
    .filter((e) => e.source_language_id && e.source_sentence?.trim())
    .map(buildExample);

  return {
    word_class_id: meaning.word_class_id as string,
    definition: meaning.definition.trim(),
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