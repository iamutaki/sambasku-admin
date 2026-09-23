import { Outlet } from '@tanstack/react-router';
import { Layout, Typography } from 'antd';
import { env } from '@/shared/config/env';

/**
 * Base layout - dipakai untuk MENU publik / pre-auth (login, dst).
 * Brand + Outlet. Tidak ada header/sidebar admin.
 */
export function BaseLayout() {
  return (
    <Layout className="base-layout">
      <Layout.Content className="base-layout__content">
        <div className="base-layout__brand">
          <img
            className="base-layout__logo"
            src="/logo_alpha.webp"
            alt="SambasKu"
            width={480}
            height={635}
            decoding="async"
            fetchPriority="high"
          />
          <Typography.Text type="secondary">Konsol Admin</Typography.Text>
        </div>
        <Outlet />
        <Typography.Text type="secondary" className="base-layout__footer">
          {env.appName} · Kamus Digital Sambas-Indonesia
        </Typography.Text>
      </Layout.Content>
    </Layout>
  );
}