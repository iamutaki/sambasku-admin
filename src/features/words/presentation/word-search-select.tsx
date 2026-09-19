import { useState } from 'react';
import { Button, Divider, Select } from 'antd';
import { useWordSearch } from '../application/use-word-search';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';

export interface WordSearchSelectProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Select kata yang BISA DICARI (sinonim/antonim/kata pembentuk) - konsumsi
 * GET /words/search (cursor pagination). Di-dropdown ada tombol "Muat lagi"
 * saat `has_more`. Simpan label terpilih secara lokal agar tidak hilang saat
 * hasil pencarian berubah (antd Select butuh option yang ada untuk menampilkan).
 */
export function WordSearchSelect({ value, onChange, placeholder = 'Cari kata…', disabled }: WordSearchSelectProps) {
  const [searchInput, setSearchInput] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const q = useDebouncedValue(searchInput, 300);

  const { items, hasMore, loadMore, isLoading } = useWordSearch({ q });
  const options = items.map((word) => {
    const base = word.language_code ? `${word.lemma} (${word.language_code})` : word.lemma;
    return {
      value: word.id,
      // 11: q cocok lewat variasi penulisan → tampilkan form yang cocok
      // supaya verifikator paham kenapa kata muncul untuk q tsb.
      label: word.matched_variant ? `${base} - cocok varian: "${word.matched_variant}"` : base,
    };
  });

  return (
    <Select
      allowClear
      showSearch
      disabled={disabled}
      placeholder={placeholder}
      labelInValue
      value={value ? { value, label: selectedLabel ?? options.find((o) => o.value === value)?.label ?? value } : undefined}
      searchValue={searchInput}
      onSearch={setSearchInput}
      onChange={(next) => {
        setSelectedLabel(next?.label ? String(next.label) : null);
        onChange?.(next ? (next.value as string) : undefined);
      }}
      filterOption={false}
      loading={isLoading}
      notFoundContent={isLoading ? 'Mencari…' : undefined}
      options={options}
      dropdownRender={(menu) => (
        <>
          {menu}
          {hasMore ? (
            <>
              <Divider style={{ margin: '8px 0 4px' }} />
              <div style={{ padding: '0 8px 8px', textAlign: 'center' }}>
                <Button type="link" block disabled={isLoading} onClick={() => loadMore()}>
                  Muat lagi
                </Button>
              </div>
            </>
          ) : null}
        </>
      )}
    />
  );
}