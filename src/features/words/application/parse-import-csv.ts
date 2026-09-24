export interface ParsedMeaning {
  rowNumber: number;
  translation: string;
  definition: string;
  example: string;
}

export interface ParsedWord {
  lemma: string;
  meanings: ParsedMeaning[];
}

const LEMMA_HEADERS = new Set(['lemma', 'kata', 'word']);
const TRANSLATION_HEADERS = new Set(['terjemahan', 'padanan', 'translation']);
const DEFINITION_HEADERS = new Set(['definisi', 'arti', 'penjelasan_arti', 'definition']);
const EXAMPLE_HEADERS = new Set(['contoh', 'example']);

type Delimiter = ',' | ';' | '\t';

/** Header yang diunduh dari tombol templat. Alias lama (lemma/definisi) tetap diterima saat impor. */
export function importTemplateCsv(): string {
  return ['kata,terjemahan,penjelasan_arti,contoh', 'makatn,makan,menghabiskan makanan,'].join('\n');
}

/**
 * Satu baris CSV = satu makna. Lemma yang sama (tanpa peduli huruf besar) digabung.
 * Makna dengan terjemahan dan penjelasan yang sama dihitung sekali.
 */
export function parseImportCsv(text: string): { words: ParsedWord[] } {
  const source = text.replace(/^\uFEFF/, '').trim();
  if (!source) throw new Error('File CSV kosong');

  const delimiter = detectDelimiter(source.split(/\r?\n/, 1)[0] ?? '');
  if (!delimiter) {
    throw new Error('Header tidak dikenali. Pakai kolom kata, terjemahan, penjelasan_arti, dan contoh.');
  }

  const rows = parseDelimited(source, delimiter);
  const header = rows[0];
  if (!header) {
    throw new Error('Header tidak dikenali. Pakai kolom kata, terjemahan, penjelasan_arti, dan contoh.');
  }

  const columns = mapColumns(header);
  if (columns.lemma < 0 || (columns.translation < 0 && columns.definition < 0)) {
    throw new Error('Header tidak dikenali. Pakai kolom kata, terjemahan, penjelasan_arti, dan contoh.');
  }

  const groups = new Map<string, ParsedWord>();
  const seen = new Map<string, Set<string>>();
  let rowNumber = 1;

  for (const row of rows.slice(1)) {
    const lemma = cell(row, columns.lemma);
    const translation = cell(row, columns.translation);
    const definition = cell(row, columns.definition);
    const example = cell(row, columns.example);
    if (!lemma || (!translation && !definition)) continue;

    const key = lemma.toLowerCase();
    let word = groups.get(key);
    if (!word) {
      word = { lemma, meanings: [] };
      groups.set(key, word);
      seen.set(key, new Set());
    }

    const fingerprint = `${definition.toLowerCase()}\n${translation.toLowerCase()}`;
    const fingerprints = seen.get(key)!;
    if (fingerprints.has(fingerprint)) continue;
    fingerprints.add(fingerprint);

    word.meanings.push({ rowNumber, translation, definition, example });
    rowNumber += 1;
  }

  const words = [...groups.values()];
  if (words.length === 0) {
    throw new Error('Tidak ada baris kata yang bisa diimpor. Isi kata plus terjemahan atau penjelasan arti.');
  }
  return { words };
}

function headerKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

function mapColumns(header: string[]) {
  const indexOf = (names: Set<string>) => header.findIndex((cell) => names.has(headerKey(cell)));
  return {
    lemma: indexOf(LEMMA_HEADERS),
    translation: indexOf(TRANSLATION_HEADERS),
    definition: indexOf(DEFINITION_HEADERS),
    example: indexOf(EXAMPLE_HEADERS),
  };
}

function cell(row: string[], index: number): string {
  if (index < 0) return '';
  return (row[index] ?? '').trim();
}

function detectDelimiter(line: string): Delimiter | null {
  const counts: Record<Delimiter, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === ',' || ch === ';' || ch === '\t') counts[ch] += 1;
  }
  const ranked = (Object.keys(counts) as Delimiter[]).sort((a, b) => counts[b] - counts[a]);
  const best = ranked[0];
  if (!best || counts[best] === 0) return null;
  return best;
}

function parseDelimited(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(value);
      value = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(value);
      value = '';
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      continue;
    }
    value += ch;
  }

  row.push(value);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  return rows;
}
