const PLACEHOLDER = '-';

function isPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === PLACEHOLDER;
}

/**
 * Tukar teks definisi dengan terjemahan pertama.
 * `-` dan kosong dianggap placeholder, bukan isi nyata.
 */
export function swapMeaningTexts(input: {
  definition: string;
  translationText: string;
}): {
  definition: string;
  translationText: string;
  isHaveDefinition: boolean;
  isHaveTranslation: boolean;
} {
  const definition = input.definition.trim();
  const translation = input.translationText.trim();
  const definitionIsReal = !isPlaceholder(definition);
  const translationIsReal = !isPlaceholder(translation);
  return {
    definition: translationIsReal ? translation : PLACEHOLDER,
    translationText: definitionIsReal ? definition : '',
    isHaveDefinition: translationIsReal,
    isHaveTranslation: definitionIsReal,
  };
}
