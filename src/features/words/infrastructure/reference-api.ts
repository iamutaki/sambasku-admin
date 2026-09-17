import { client } from '@/shared/api/client';
import type { ApiOkEnvelope } from '@/shared/api/types';
import type {
  CategoryOption,
  DialectOption,
  LanguageOption,
  WordClassOption,
} from '../domain/create-word';

/**
 * Data referensi form admin (semua GET publik, rate limit 100/menit per IP):
 * - /languages?is_active=true        → dropdown Bahasa
 * - /dialects?language_id=…          → dropdown Dialek
 * - /word-classes                    → dropdown Kelas Kata (hierarki parent_id)
 * - /categories                      → multi-select Kategori/Glosarium
 */
export async function listLanguagesRequest(signal?: AbortSignal): Promise<LanguageOption[]> {
  const res = await client.get<ApiOkEnvelope<LanguageOption[]>>('/languages', {
    params: { is_active: true },
    signal,
  });
  return res.data.data;
}

export async function listDialectsRequest(languageId: string, signal?: AbortSignal): Promise<DialectOption[]> {
  const res = await client.get<ApiOkEnvelope<DialectOption[]>>('/dialects', {
    params: { language_id: languageId },
    signal,
  });
  return res.data.data;
}

export async function listWordClassesRequest(signal?: AbortSignal): Promise<WordClassOption[]> {
  const res = await client.get<ApiOkEnvelope<WordClassOption[]>>('/word-classes', { signal });
  return res.data.data;
}

export async function listCategoriesRequest(signal?: AbortSignal): Promise<CategoryOption[]> {
  const res = await client.get<ApiOkEnvelope<CategoryOption[]>>('/categories', { signal });
  return res.data.data;
}