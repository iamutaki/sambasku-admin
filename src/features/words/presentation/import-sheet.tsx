import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { BookOutlined, DeleteOutlined } from '@ant-design/icons';
import { Checkbox } from 'antd';

export interface SheetMeaning {
  rowNumber: number;
  translation: string;
  definition: string;
  example: string;
  skipped: boolean;
}

export interface SheetWord {
  /** Identity stabil (bukan lemma) supaya baris kosong bisa diedit. */
  id: string;
  lemma: string;
  verify: boolean;
  meanings: SheetMeaning[];
  message?: string;
}

type TextCol = 'lemma' | 'translation' | 'definition' | 'example';
type ColId = TextCol | 'skip' | 'verify' | 'remove';

const TEXT_COLS: TextCol[] = ['lemma', 'translation', 'definition', 'example'];

const GRID = '#d0d0d0';
const HEADER_BG = '#f3f3f3';
const GUTTER_BG = '#f8f8f8';
const SELECT = '#107c41';
const WARN = '#fff4ce';
const BAND = '#f7f7f7';
const BAND_GUTTER = '#efefef';

function textOf(word: SheetWord, meaning: SheetMeaning, col: TextCol) {
  if (col === 'lemma') return word.lemma;
  return meaning[col];
}

function matchesQuery(word: SheetWord, meaning: SheetMeaning, needle: string) {
  if (!needle) return true;
  return [word.lemma, meaning.translation, meaning.definition, meaning.example].some((value) =>
    value.toLowerCase().includes(needle),
  );
}

export function ImportSheet({
  words,
  canVerify,
  onText,
  onSkip,
  onVerify,
  onKbbi,
  onRemove,
  query = '',
}: {
  words: SheetWord[];
  canVerify: boolean;
  onText: (wordId: string, rowNumber: number, col: TextCol, value: string) => void;
  onSkip: (wordId: string, rowNumber: number, skipped: boolean) => void;
  onVerify: (wordId: string, verify: boolean) => void;
  onKbbi: (wordId: string, rowNumber: number, translation: string) => void;
  onRemove: (wordId: string, rowNumber: number) => void;
  query?: string;
}) {
  const cols: ColId[] = [
    ...TEXT_COLS,
    'skip',
    ...(canVerify ? (['verify'] as const) : []),
    'remove',
  ];
  const needle = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      words
        .flatMap((word) => word.meanings.map((meaning) => ({ word, meaning })))
        .filter((row) => matchesQuery(row.word, row.meaning, needle)),
    [words, needle],
  );
  const [active, setActive] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [edit, setEdit] = useState<{ row: number; col: number; draft: string } | null>(null);
  const editRef = useRef(edit);
  editRef.current = edit;
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hadEdit = useRef(false);

  useEffect(() => {
    if (edit) {
      hadEdit.current = true;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
      return;
    }
    if (hadEdit.current) {
      hadEdit.current = false;
      scroller.current?.focus();
    }
  }, [edit]);

  useEffect(() => {
    editRef.current = null;
    setEdit(null);
    setActive({ row: 0, col: 0 });
  }, [needle]);

  const move = (row: number, col: number) => {
    if (rows.length === 0) return;
    const nextRow = Math.max(0, Math.min(rows.length - 1, row));
    const nextCol = Math.max(0, Math.min(cols.length - 1, col));
    setActive({ row: nextRow, col: nextCol });
    const cell = scroller.current?.querySelector(`[data-cell="${nextRow}-${nextCol}"]`);
    cell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const step = (row: number, col: number, dRow: number, dCol: number) => {
    let nextRow = row + dRow;
    let nextCol = col + dCol;
    if (nextCol >= cols.length) {
      nextCol = 0;
      nextRow += 1;
    } else if (nextCol < 0) {
      nextCol = cols.length - 1;
      nextRow -= 1;
    }
    move(nextRow, nextCol);
  };

  const beginEdit = (row: number, col: number, seed?: string) => {
    const id = cols[col];
    if (!TEXT_COLS.includes(id as TextCol)) return;
    const current = rows[row];
    if (!current) return;
    const value = textOf(current.word, current.meaning, id as TextCol);
    setEdit({ row, col, draft: seed ?? value });
  };

  const commitEdit = (next?: { row: number; col: number }) => {
    const currentEdit = editRef.current;
    if (!currentEdit) return;
    editRef.current = null;
    const current = rows[currentEdit.row];
    const id = cols[currentEdit.col] as TextCol;
    if (current && TEXT_COLS.includes(id)) {
      onText(current.word.id, current.meaning.rowNumber, id, currentEdit.draft);
    }
    setEdit(null);
    if (next) move(next.row, next.col);
  };

  const removeActiveRow = () => {
    const current = rows[active.row];
    if (!current) return;
    onRemove(current.word.id, current.meaning.rowNumber);
    const nextRow = Math.min(active.row, Math.max(0, rows.length - 2));
    setActive({ row: nextRow, col: active.col });
    setEdit(null);
  };

  const toggleActive = () => {
    const current = rows[active.row];
    if (!current) return;
    const id = cols[active.col];
    if (id === 'skip') onSkip(current.word.id, current.meaning.rowNumber, !current.meaning.skipped);
    if (id === 'verify') onVerify(current.word.id, !current.word.verify);
    if (id === 'remove') removeActiveRow();
  };

  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (editRef.current) return;
    const { row, col } = active;
    const edge = event.metaKey || event.ctrlKey;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(edge ? rows.length - 1 : row + 1, col);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(edge ? 0 : row - 1, col);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (edge) move(row, cols.length - 1);
      else step(row, col, 0, 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (edge) move(row, 0);
      else step(row, col, 0, -1);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      step(row, col, 0, event.shiftKey ? -1 : 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (cols[col] === 'remove') removeActiveRow();
      else move(row + (event.shiftKey ? -1 : 1), col);
    } else if (event.key === 'F2') {
      event.preventDefault();
      beginEdit(row, col);
    } else if (event.key === 'Home') {
      event.preventDefault();
      move(edge ? 0 : row, 0);
    } else if (event.key === 'End') {
      event.preventDefault();
      move(edge ? rows.length - 1 : row, cols.length - 1);
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      move(row + 12, col);
    } else if (event.key === 'PageUp') {
      event.preventDefault();
      move(row - 12, col);
    } else if ((event.key === 'Backspace' || event.key === 'Delete') && edge) {
      // Cmd/Ctrl+Backspace|Delete = hapus baris (bukan kosongkan sel)
      event.preventDefault();
      removeActiveRow();
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      const id = cols[col];
      const current = rows[row];
      if (id === 'remove') {
        removeActiveRow();
        return;
      }
      if (current && TEXT_COLS.includes(id as TextCol)) {
        onText(current.word.id, current.meaning.rowNumber, id as TextCol, '');
      }
    } else if (event.key === ' ') {
      event.preventDefault();
      const id = cols[col];
      if (id === 'skip' || id === 'verify' || id === 'remove') toggleActive();
      else beginEdit(row, col, '');
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      beginEdit(row, col, event.key);
    }
  };

  const stickyGutter: CSSProperties = { position: 'sticky', left: 0, zIndex: 1 };
  const stickyLemma: CSSProperties = { position: 'sticky', left: 44, zIndex: 1 };

  return (
    <div
      ref={scroller}
      tabIndex={0}
      onKeyDown={onGridKey}
      style={{
        maxHeight: 'calc(100vh - 280px)',
        overflow: 'auto',
        border: `1px solid ${GRID}`,
        background: '#fff',
        fontFamily: 'Calibri, "Segoe UI", sans-serif',
        fontSize: 13,
        outline: 'none',
      }}
    >
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 980, width: '100%' }}>
        <thead>
          <tr>
            {[
              '#',
              'Kata',
              'Terjemahan',
              'Penjelasan arti',
              'Contoh',
              'Lewati',
              ...(canVerify ? ['Tayangkan'] : []),
              '',
            ].map((title, index) => (
                <th
                  key={`${title}-${index}`}
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: index <= 1 ? 3 : 2,
                    left: index === 0 ? 0 : index === 1 ? 44 : undefined,
                    height: 28,
                    padding: '0 8px',
                    background: HEADER_BG,
                    borderRight: `1px solid ${GRID}`,
                    borderBottom: `1px solid ${GRID}`,
                    fontWeight: 600,
                    textAlign: index >= 5 ? 'center' : 'left',
                    whiteSpace: 'nowrap',
                    width: index === 0 ? 44 : index === cols.length ? 40 : undefined,
                  }}
                >
                  {title}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={cols.length + 1}
                style={{ padding: 16, color: '#666', borderBottom: `1px solid ${GRID}` }}
              >
                Tidak ada baris yang cocok.
              </td>
            </tr>
          ) : null}
          {rows.map((row, rowIndex) => {
            const unused =
              !row.meaning.skipped &&
              row.meaning.translation.trim() === '' &&
              row.meaning.definition.trim() === '';
            const banded = rowIndex % 2 === 1;
            return (
              <tr key={`${row.word.id}-${row.meaning.rowNumber}`}>
                <td
                  style={{
                    ...stickyGutter,
                    width: 44,
                    textAlign: 'center',
                    color: '#666',
                    background: unused ? WARN : banded ? BAND_GUTTER : GUTTER_BG,
                    borderRight: `1px solid ${GRID}`,
                    borderBottom: `1px solid ${GRID}`,
                    height: 28,
                  }}
                  title={unused ? 'Tidak ikut disimpan: terjemahan dan penjelasan arti kosong' : undefined}
                >
                  {row.meaning.rowNumber}
                </td>
                {cols.map((col, colIndex) => {
                  const selected = active.row === rowIndex && active.col === colIndex;
                  const editing = edit?.row === rowIndex && edit.col === colIndex;
                  const skipped = row.meaning.skipped;
                  const value = TEXT_COLS.includes(col as TextCol)
                    ? textOf(row.word, row.meaning, col as TextCol)
                    : '';
                  return (
                    <td
                      key={col}
                      data-cell={`${rowIndex}-${colIndex}`}
                      title={col === 'lemma' ? row.word.message : undefined}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        scroller.current?.focus();
                        if (editing) return;
                        setEdit(null);
                        setActive({ row: rowIndex, col: colIndex });
                      }}
                      onDoubleClick={() => beginEdit(rowIndex, colIndex)}
                      style={{
                        ...(col === 'lemma' ? stickyLemma : undefined),
                        height: 28,
                        maxWidth: 280,
                        padding: editing ? 0 : '0 8px',
                        background: skipped ? '#f5f5f5' : banded ? BAND : col === 'lemma' ? GUTTER_BG : '#fff',
                        borderRight: `1px solid ${GRID}`,
                        borderBottom: `1px solid ${GRID}`,
                        boxShadow: selected ? `inset 0 0 0 2px ${SELECT}` : undefined,
                        textDecoration: skipped && TEXT_COLS.includes(col as TextCol) ? 'line-through' : undefined,
                        fontWeight: col === 'lemma' ? 700 : undefined,
                        fontStyle: col === 'example' ? 'italic' : undefined,
                        color: skipped ? '#999' : undefined,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textAlign: col === 'skip' || col === 'verify' || col === 'remove' ? 'center' : 'left',
                      }}
                    >
                      {editing ? (
                        <input
                          ref={inputRef}
                          value={edit.draft}
                          onChange={(e) => setEdit({ ...edit, draft: e.target.value })}
                          onBlur={() => commitEdit()}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              editRef.current = null;
                              setEdit(null);
                            } else if (event.key === 'Enter') {
                              event.preventDefault();
                              commitEdit({ row: rowIndex + (event.shiftKey ? -1 : 1), col: colIndex });
                            } else if (event.key === 'Tab') {
                              event.preventDefault();
                              const delta = event.shiftKey ? -1 : 1;
                              const wrapped = colIndex + delta;
                              commitEdit(
                                wrapped >= cols.length
                                  ? { row: rowIndex + 1, col: 0 }
                                  : wrapped < 0
                                    ? { row: rowIndex - 1, col: cols.length - 1 }
                                    : { row: rowIndex, col: wrapped },
                              );
                            } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                              event.preventDefault();
                              commitEdit({ row: rowIndex + (event.key === 'ArrowDown' ? 1 : -1), col: colIndex });
                            }
                          }}
                          style={{
                            width: '100%',
                            height: 28,
                            border: 'none',
                            outline: 'none',
                            padding: '0 8px',
                            font: 'inherit',
                            background: '#fff',
                          }}
                        />
                      ) : col === 'skip' ? (
                        <Checkbox
                          tabIndex={-1}
                          checked={row.meaning.skipped}
                          onChange={(e) => onSkip(row.word.id, row.meaning.rowNumber, e.target.checked)}
                        />
                      ) : col === 'verify' ? (
                        <Checkbox
                          tabIndex={-1}
                          checked={row.word.verify}
                          onChange={(e) => onVerify(row.word.id, e.target.checked)}
                        />
                      ) : col === 'remove' ? (
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-label="Hapus baris"
                          title="Hapus baris (⌘⌫)"
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={() => onRemove(row.word.id, row.meaning.rowNumber)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            padding: 0,
                            cursor: 'pointer',
                            color: '#8c8c8c',
                            lineHeight: 1,
                          }}
                        >
                          <DeleteOutlined />
                        </button>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {value.trim() ? value : '-'}
                          </span>
                          {col === 'translation' ? (
                            <button
                              type="button"
                              tabIndex={-1}
                              aria-label="Ambil dari KBBI"
                              title="Ambil dari KBBI"
                              onMouseDown={(event) => event.stopPropagation()}
                              onClick={() => onKbbi(row.word.id, row.meaning.rowNumber, value)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                padding: 0,
                                cursor: 'pointer',
                                color: '#595959',
                                flex: 'none',
                              }}
                            >
                              <BookOutlined />
                            </button>
                          ) : null}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
