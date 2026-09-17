import { useNavigate } from '@tanstack/react-router';
import { Button, Result } from 'antd';

/** Halaman 404 - route `$splat` (semua path yang tidak terdaftar). */
export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="404"
      subTitle="Halaman yang Anda cari tidak ditemukan."
      extra={
        <Button type="primary" onClick={() => navigate({ to: '/dashboard' })}>
          Ke Dashboard
        </Button>
      }
    />
  );
}