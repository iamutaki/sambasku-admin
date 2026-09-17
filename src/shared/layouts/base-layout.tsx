import { Outlet } from '@tanstack/react-router';
import { Layout, Typography } from 'antd';
import { BookOutlined } from '@ant-design/icons';
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
          <BookOutlined className="base-layout__logo" />
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Kamus Sambas
            </Typography.Title>
            <Typography.Text type="secondary">Console Admin</Typography.Text>
          </div>
        </div>
        <Outlet />
        <Typography.Text type="secondary" className="base-layout__footer">
          {env.appName} · Kamus Digital Sambas-Indonesia
        </Typography.Text>
      </Layout.Content>
    </Layout>
  );
}