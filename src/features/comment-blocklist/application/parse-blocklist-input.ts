const HEADER_LABELS = new Set(['word', 'words', 'kata', 'term', 'terms']);

/** Pisahkan teks form: koma, titik koma, atau baris baru. Contoh: `lorem,ipsum, dolo`. */
export function splitBlocklistText(raw: string): string[] {
  return raw
    .split(/[,;\n\r]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function detectDelimiter(line: string): ',' | ';' | '\t' | null {
  const counts: Record<',' | ';' | '\t', number> = {
    ',': 0,
    ';': 0,
    '\t': 0,
  };
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === ',' || ch === ';' || ch === '\t') counts[ch] += 1;
  }
  const ranked = (Object.keys(counts) as Array<',' | ';' | '\t'>).sort(
    (a, b) => counts[b] - counts[a],
  );
  const best = ranked[0];
  if (!best || counts[best] === 0) return null;
  return best;
}

function parseDelimited(text: string, delimiter: ',' | ';' | '\t'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }

  row.push(cell);
  if (row.some((value) => value.trim().length > 0)) rows.push(row);
  return rows;
}

/**
 * Wordlist CSV / teks: satu kata per baris, atau beberapa kolom.
 * Excel Indonesia sering memakai `;`. Baris header `word` / `kata` dilewati
 * dan hanya kolom pertama yang dipakai.
 */
export function wordsFromWordlist(text: string): string[] {
  const source = text.replace(/^\uFEFF/, '').trim();
  if (!source) return [];

  const lines = source.split(/\r?\n/);
  const delimiter = lines.map((line) => detectDelimiter(line)).find((value) => value != null) ?? null;
  if (!delimiter) {
    const values = lines.map((line) => line.trim()).filter((line) => line.length > 0);
    if (values.length > 1 && HEADER_LABELS.has(values[0].toLowerCase())) return values.slice(1);
    return values;
  }

  const rows = parseDelimited(source, delimiter);
  if (rows.length === 0) return [];

  const firstCell = (rows[0]?.[0] ?? '').trim().toLowerCase();
  const hasHeader = rows.length > 1 && HEADER_LABELS.has(firstCell);
  const data = hasHeader ? rows.slice(1) : rows;
  const words: string[] = [];

  for (const row of data) {
    const cells = hasHeader ? row.slice(0, 1) : row;
    for (const cell of cells) {
      const value = cell.trim();
      if (value) words.push(value);
    }
  }
  return words;
}
