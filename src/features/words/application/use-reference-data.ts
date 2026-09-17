import { useQuery } from '@tanstack/react-query';
import {
  listCategoriesRequest,
  listDialectsRequest,
  listLanguagesRequest,
  listWordClassesRequest,
} from '../infrastructure/reference-api';

/** Dropdown Bahasa — data kecil, publik, tanpa pagination. */
export function useLanguageOptions() {
  return useQuery({
    queryKey: ['reference', 'languages'],
    queryFn: ({ signal }) => listLanguagesRequest(signal),
    staleTime: 5 * 60_000,
  });
}

/** Dropdown Dialek — hilang saat bahasa belum dipilih (query dimatikan). */
export function useDialectOptions(languageId: string | undefined) {
  return useQuery({
    queryKey: ['reference', 'dialects', languageId ?? null],
    queryFn: ({ signal }) => listDialectsRequest(languageId as string, signal),
    enabled: Boolean(languageId),
    staleTime: 5 * 60_000,
  });
}

/** Dropdown Kelas Kata — hierarki di-format di halaman (parent › child). */
export function useWordClassOptions() {
  return useQuery({
    queryKey: ['reference', 'word-classes'],
    queryFn: ({ signal }) => listWordClassesRequest(signal),
    staleTime: 5 * 60_000,
  });
}

/** Multi-select Kategori/Glosarium. */
export function useCategoryOptions() {
  return useQuery({
    queryKey: ['reference', 'categories'],
    queryFn: ({ signal }) => listCategoriesRequest(signal),
    staleTime: 5 * 60_000,
  });
}