/** Response GET /api/v1/lemma-definitions/lookup (kontrak 13). */

export interface LemmaDefinitionSuggestion {
  id: string;
  lemma: string;
  homonym_index: number;
  sense_index: number;
  word_class_code: string | null;
  word_class_label: string | null;
  definition: string;
  preview: string;
}

export interface LemmaDefinitionSense {
  sense_index: number;
  word_class_code: string | null;
  word_class_label: string | null;
  definition: string;
  examples: string[];
  notes: string | null;
}

export interface LemmaDefinitionEntry {
  lemma: string;
  homonym_index: number;
  senses: LemmaDefinitionSense[];
}

export interface LemmaDefinitionLookupResult {
  query: string;
  normalized_query: string;
  found: boolean;
  provider: string;
  fetched_at: string;
  cache_hit: boolean;
  entries: LemmaDefinitionEntry[];
  suggestions: LemmaDefinitionSuggestion[];
}
