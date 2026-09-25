import { useCallback, useEffect, useRef, useState } from 'react';
import { Input, Modal, Space, Spin, Tag, Typography, message } from 'antd';
import {
  STOCK_PHOTO_PROVIDERS,
  STOCK_PROVIDER_LABELS,
  listShareBackgrounds,
  type ShareBackgroundItem,
  type StockPhotoProvider,
} from '../infrastructure/share-backgrounds-api';

const { Text } = Typography;
const { Search } = Input;

export interface MediaExplorerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: ShareBackgroundItem) => void;
}

/**
 * Browser foto stock (Media Explorer) untuk gambar kata - foto saja.
 * Memakai GET /api/v1/share/backgrounds (publik).
 */
export function MediaExplorerModal({ open, onClose, onSelect }: MediaExplorerModalProps) {
  const [provider, setProvider] = useState<StockPhotoProvider>('pixabay');
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ShareBackgroundItem[]>([]);
  const [loading, setLoading] = useState(open);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [degraded, setDegraded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (opts: { page: number; query: string; provider: StockPhotoProvider; append: boolean }) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      if (opts.append) setLoadingMore(true);
      else setLoading(true);
      try {
        const sort = opts.query.trim() ? 'relevant' : 'popular';
        const result = await listShareBackgrounds({
          q: opts.query,
          page: opts.page,
          sort,
          provider: opts.provider,
          limit: 12,
          signal: ac.signal,
        });
        setDegraded(result.degraded);
        setItems((prev) => (opts.append ? [...prev, ...result.items] : result.items));
        setHasMore(result.items.length >= 12);
      } catch (err) {
        if ((err as { name?: string })?.name === 'CanceledError') return;
        message.error('Gagal memuat Media Explorer');
        if (!opts.append) setItems([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPage(1);
      setActiveQuery('');
      setQuery('');
      setLoading(true);
    }
  }

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ac;
    let ignore = false;
    void (async () => {
      try {
        const result = await listShareBackgrounds({
          q: '',
          page: 1,
          sort: 'popular',
          provider,
          limit: 12,
          signal: ac.signal,
        });
        if (ignore) return;
        setDegraded(result.degraded);
        setItems(result.items);
        setHasMore(result.items.length >= 12);
      } catch (err) {
        if (ignore || (err as { name?: string })?.name === 'CanceledError') return;
        message.error('Gagal memuat Media Explorer');
        setItems([]);
        setHasMore(false);
      } finally {
        if (!ignore) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    })();
    return () => {
      ignore = true;
      ac.abort();
    };
    // Hanya saat modal dibuka - ganti provider lewat onClick chip.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional open gate
  }, [open]);

  const changeProvider = (id: StockPhotoProvider) => {
    setProvider(id);
    setPage(1);
    void load({ page: 1, query: activeQuery, provider: id, append: false });
  };

  const onSearch = (value: string) => {
    const q = value.trim();
    setActiveQuery(q);
    setPage(1);
    void load({ page: 1, query: q, provider, append: false });
  };

  const loadMore = () => {
    if (loading || loadingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    void load({ page: next, query: activeQuery, provider, append: true });
  };

  return (
    <Modal
      title="Media Explorer"
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnHidden
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Text type="secondary">
          Pilih foto stock sebagai ilustrasi kata (URL eksternal, tanpa upload).
        </Text>
        <Search
          placeholder="Cari (kosong = populer)"
          allowClear
          enterButton="Cari"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onSearch={onSearch}
        />
        <Space size={[6, 6]} wrap>
          {STOCK_PHOTO_PROVIDERS.map((id) => (
            <Tag.CheckableTag
              key={id}
              checked={provider === id}
              onChange={() => changeProvider(id)}
            >
              {STOCK_PROVIDER_LABELS[id]}
            </Tag.CheckableTag>
          ))}
        </Space>
        {degraded ? (
          <Text type="warning">Penyedia sedang terbatas - hasil mungkin kosong.</Text>
        ) : null}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : items.length === 0 ? (
          <Text type="secondary">Tidak ada hasil.</Text>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 8,
                maxHeight: 420,
                overflowY: 'auto',
              }}
            >
              {items.map((item) => (
                <button
                  key={`${item.provider}-${item.id}`}
                  type="button"
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={{
                    padding: 0,
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: '#fff',
                    textAlign: 'left',
                  }}
                >
                  <img
                    src={item.preview_url || item.url}
                    alt={item.photographer}
                    style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ padding: '4px 6px' }}>
                    <Text ellipsis style={{ fontSize: 11, display: 'block' }}>
                      {item.photographer || STOCK_PROVIDER_LABELS[item.provider]}
                    </Text>
                  </div>
                </button>
              ))}
            </div>
            {hasMore ? (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#1677ff',
                  cursor: 'pointer',
                  padding: 8,
                }}
              >
                {loadingMore ? 'Memuat…' : 'Muat lebih banyak'}
              </button>
            ) : null}
          </>
        )}
      </Space>
    </Modal>
  );
}
