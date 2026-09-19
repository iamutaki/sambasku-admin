import type {
  AffixType,
  CreateWordFormValues,
  ExampleSourceType,
  RelationType,
  TranslationType,
  VariantType,
} from '../domain/create-word';
import { type UpdateWordRequest, type WordDetail } from '../domain/word-detail';
import { buildCreateWordBody } from './create-word-utils';

/**
 * Helper murni fitur Edit Kata - ter-unit-test:
 * 1. `wordDetailToFormValues` - prefill form edit dari WordDetail (GET admin)
 * 2. `buildUpdateWordBody`    - nilai form → body PUT (full replace, Form A
 *    saja). Meneruskan logika normalisasi create-word (buildCreateWordBody);
 *    relasi di-export ulang HANYA bentuk link (Form B mustahil dari form edit
 *    yang allowInline=false, tapi tetap disaring defensif).
 *
 * Field opsional yang kosong/null TIDAK dikirim - kontrak API ketat (zod)
 * menolak `null` untuk field opsional seperti dialect_id.
 */

export function wordDetailToFormValues(detail: WordDetail): CreateWordFormValues {
  return {
    language_id: detail.language_id,
    lemma: detail.lemma,
    ...(detail.notes?.trim() ? { notes: detail.notes } : {}),
    word_type: detail.word_type,
    meanings: detail.meanings.map((m) => ({
      word_class_id: m.word_class?.id ?? undefined,
      definition: m.definition,
      order_index: m.order_index,
      translations: m.translations.map((t) => ({
        language_id: t.language_id,
        translation_text: t.translation_text,
        translation_type: t.translation_type as TranslationType,
      })),
      examples:
        m.examples.length > 0
          ? m.examples.map((e) => ({
              source_language_id: e.source_language_id,
              source_sentence: e.source_sentence,
              ...(e.target_language_id ? { target_language_id: e.target_language_id } : {}),
              ...(e.target_sentence ? { target_sentence: e.target_sentence } : {}),
              ...(e.source_type ? { source_type: e.source_type as ExampleSourceType } : {}),
            }))
          : undefined,
    })),
    category_ids: detail.categories.map((c) => c.id),
    related_words: detail.related_words.map((rel) => ({
      relation_type: rel.relation_type as RelationType,
      mode: 'link',
      word_id: rel.word_id,
    })),
    variants: detail.variants.map((v) => ({
      form: v.form,
      variant_type: v.variant_type as VariantType,
      ...(v.affix_type ? { affix_type: v.affix_type as AffixType } : {}),
      ...(v.affix_value ? { affix_value: v.affix_value } : {}),
    })),
    pronunciation: detail.pronunciations[0]
      ? { notation: detail.pronunciations[0].notation, value: detail.pronunciations[0].value }
      : undefined,
    // Round-trip PUT: gambar existing WAJIB ikut terkirim ulang - PUT
    // full-replace hard-delete semua word_images; prefill inilah yang
    // mencegah penghapusan senyap saat kata diedit.
    images: detail.images.map((i) => ({
      uid: i.id,
      url: i.url,
      provider_file_id: i.provider_file_id,
      alt_text: i.alt_text ?? undefined,
      is_primary: i.is_primary,
      status: 'done' as const,
    })),
  };
}

/**
 * Nilai form edit → body PUT. Normalisasi sama dengan create
 * (buildCreateWordBody); status dikirim eksplisit ('draft' | 'published').
 * Relasi dibatasi ke bentuk link (Form A) - 05-api-edit-kata.md menolak Form B.
 */
export function buildUpdateWordBody(
  values: CreateWordFormValues,
  status: 'draft' | 'published',
): UpdateWordRequest {
  const body = buildCreateWordBody(values, status);
  return {
    ...body,
    related_words: body.related_words.filter(
      (rel): rel is UpdateWordRequest['related_words'][number] => 'word_id' in rel,
    ),
  };
}