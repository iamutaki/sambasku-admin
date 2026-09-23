import { Flex, Spin, Typography } from 'antd';

export interface PageLoadingProps {
  /** Teks sekunder di bawah spinner. */
  tip?: string;
}

/**
 * Loading halaman penuh. Spinner selalu di tengah area konten
 * (horizontal + vertikal). Wajib untuk isPending/isLoading halaman
 * detail/form; jangan return `<Spin />` telanjang.
 */
export function PageLoading({ tip }: PageLoadingProps) {
  return (
    <Flex
      className="page-loading"
      vertical
      align="center"
      justify="center"
      gap={12}
      role="status"
      aria-live="polite"
      aria-label={tip ?? 'Memuat'}
    >
      <Spin size="large" />
      {tip ? <Typography.Text type="secondary">{tip}</Typography.Text> : null}
    </Flex>
  );
}
