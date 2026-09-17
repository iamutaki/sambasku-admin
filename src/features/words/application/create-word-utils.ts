import type {
  CreateWordFormValues,
  CreateWordRequest,
  CreateWordRequestExample,
  CreateWordRequestMeaning,
  CreateWordRequestRelated,
  CreateWordRequestVariant,
  CreateWordExampleFormValue,
  LanguageOption,
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
// Kode resmi seed: SBS & IDN — tapi dikenali juga varian lain kalau
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
  const meanings: CreateWordRequestMeaning[] = (values.meanings ?? [])
    .map((meaning) => {
      if (!meaning.word_class_id || !meaning.definition?.trim()) return null;

      const translations = (meaning.translations ?? [])
        .filter((t) => t.language_id && t.translation_text?.trim())
        .map((t) => ({
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
    })
    // order_index default dihitung dari posisi diantara makna yang DIKEEP
    .filter((meaning): meaning is CreateWordRequestMeaning => meaning !== null)
    .map((meaning, index): CreateWordRequestMeaning => {
      const source = (values.meanings ?? [])[index];
      return {
        ...meaning,
        order_index: source?.order_index ?? index + 1,
      };
    });

  const relatedWords: CreateWordRequestRelated[] = (values.related_words ?? [])
    .filter((rel) => rel.word_id && rel.relation_type)
    .map((rel) => ({ word_id: rel.word_id as string, relation_type: rel.relation_type! }));

  const variants: CreateWordRequestVariant[] = (values.variants ?? [])
    .filter((variant) => variant.form?.trim())
    .map((variant) => ({
      form: (variant.form as string).trim(),
      variant_type: variant.variant_type ?? 'alternative',
      ...(variant.affix_type ? { affix_type: variant.affix_type } : {}),
      ...(variant.affix_value?.trim() ? { affix_value: variant.affix_value.trim() } : {}),
    }));

  const pronunciation = values.pronunciation?.value?.trim()
    ? {
        notation: values.pronunciation.notation?.trim() || 'ipa',
        value: values.pronunciation.value.trim(),
      }
    : undefined;

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

function buildExample(e: CreateWordExampleFormValue): CreateWordRequestExample {
  return {
    source_language_id: e.source_language_id as string,
    source_sentence: (e.source_sentence as string).trim(),
    ...(e.target_language_id ? { target_language_id: e.target_language_id } : {}),
    ...(e.target_sentence?.trim() ? { target_sentence: e.target_sentence.trim() } : {}),
    ...(e.source_type ? { source_type: e.source_type } : {}),
  };
}