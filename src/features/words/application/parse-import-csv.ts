export const IMPORT_CSV_HEADERS = ['kata', 'terjemahan', 'penjelasan_arti', 'contoh'] as const;
export const IMPORT_ROW_LIMIT = 500;

const HEADER_ALIASES: Record<string, 'lemma' | 'translation' | 'definition' | 'example'> = {
  lemma: 'lemma',
  kata: 'lemma',
  'kata / ungkapan sambas': 'lemma',
  terjemahan: 'translation',
  'terjemahan indonesia': 'translation',
  padanan: 'translation',
  definisi: 'definition',
  arti: 'definition',
  penjelasan_arti: 'definition',
  'penjelasan arti': 'definition',
  contoh: 'example',
};

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

export function parseImportCsv(raw: string): { words: ParsedWord[]; rowCount: number } {
  const text = raw.replace(/^\uFEFF/, '');
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => cell.trim() !== ''));
  if (rows.length === 0) {
    throw new Error('File kosong');
  }
  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const columns = header.map((name) => HEADER_ALIASES[name]);
  if (!columns.includes('lemma')) {
    throw new Error('Kolom kata (atau lemma) tidak ditemukan');
  }
  const dataRows = rows.slice(1);
  if (dataRows.length > IMPORT_ROW_LIMIT) {
    throw new Error(`Maksimal ${IMPORT_ROW_LIMIT} baris. File ini berisi ${dataRows.length} baris.`);
  }
  const groups = new Map<string, ParsedWord>();
  const order: string[] = [];
  dataRows.forEach((row, index) => {
    const cell = (key: 'lemma' | 'translation' | 'definition' | 'example') => {
      const at = columns.indexOf(key);
      return at >= 0 ? (row[at] ?? '').trim() : '';
    };
    const lemma = cell('lemma');
    if (!lemma) return;
    const key = lemma.toLowerCase();
    let word = groups.get(key);
    if (!word) {
      word = { lemma, meanings: [] };
      groups.set(key, word);
      order.push(key);
    }
    const meaning: ParsedMeaning = {
      rowNumber: index + 1,
      translation: cell('translation'),
      definition: cell('definition'),
      example: cell('example'),
    };
    const fingerprint = `${meaning.definition.toLowerCase()}\n${meaning.translation.toLowerCase()}`;
    const duplicate = word.meanings.some(
      (existing) => `${existing.definition.toLowerCase()}\n${existing.translation.toLowerCase()}` === fingerprint,
    );
    if (!duplicate) word.meanings.push(meaning);
  });
  return { words: order.map((key) => groups.get(key)!), rowCount: dataRows.length };
}

export function importTemplateCsv(): string {
  return [
    IMPORT_CSV_HEADERS.join(','),
    'makatn,makan,,Kami udah makatn tadi.',
    'ngambek,,marah yang ditahan,',
    'palak,kepala,bagian tubuh sebelah atas,',
    'ayek,air,,Ambil ayek di sumur.',
    'umah,rumah,,',
    'kitak,kamu,,Kitak dari mane?',
    'sik,tidak,,',
    'madah,bilang,mengatakan sesuatu kepada orang,Madah ke umak dulu.',
    'bulan,bulan,,',
    'manih,manis,rasa seperti gula,',
  ].join('\n');
}

function parseCsvRows(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
