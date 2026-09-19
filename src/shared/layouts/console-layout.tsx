import { useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import {
  AuditOutlined,
  CommentOutlined,
  DashboardOutlined,
  InboxOutlined,
  LikeOutlined,
  LogoutOutlined,
  SearchOutlined,
  TranslationOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Breadcrumb, Button, Dropdown, Layout, Menu, Space, Tag, Typography, theme } from 'antd';
import { useAuth } from '@/shared/auth/use-auth';
import { ROLE_LABELS, type UserRole } from '@/features/auth/domain/user';
import { useLogout } from '@/features/auth/application/use-logout';
import { App as AntdApp } from 'antd';

const { Sider, Header, Content } = Layout;

const MENU_ROUTES = {
  '/dashboard': { icon: <DashboardOutlined />, label: 'Dashboard' },
  '/words': { icon: <TranslationOutlined />, label: 'Kata' },
  '/contributions': { icon: <InboxOutlined />, label: 'Review' },
  '/comments': { icon: <CommentOutlined />, label: 'Komentar' },
  '/search-misses': { icon: <SearchOutlined />, label: 'Search Miss' },
  '/vote-moderation': { icon: <LikeOutlined />, label: 'Moderasi Vote' },
  '/audit-logs': { icon: <AuditOutlined />, label: 'Audit Log' },
  '/users': { icon: <UserOutlined />, label: 'Pengguna' },
} as const;
type MenuRoute = keyof typeof MENU_ROUTES;

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  words: 'Kata',
  contributions: 'Review',
  comments: 'Komentar',
  'search-misses': 'Search Miss',
  'vote-moderation': 'Moderasi Vote',
  'audit-logs': 'Audit Log',
  users: 'Pengguna',
};

/**
 * Console layout - dipakai SEMUA halaman yang sudah ter-autentikasi.
 * Berisi: sider menu navigasi, header (breadcrumb + profil user), content
 * (Outlet). Guard utama (redirect saat belum login) dilakukan di router
 * `beforeLoad`; di sini cuma guard reaktif untuk momen logout/sesi mati.
 */
export function ConsoleLayout() {
  const { user, isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const logoutMutation = useLogout();
  const {
    token: { colorBgContainer, borderRadiusLG, colorFillAlter },
  } = theme.useToken();

  const isLoggedIn = isAuthenticated || !!user;

  const menuItems = useMemo(() => {
    // Gate per menu: /users hanya admin & root; /vote-moderation (moderasi
    // level konten, matrix sama dengan review kontribusi) reviewer ke atas.
    const canModerateContent =
      user?.role === 'root' || user?.role === 'admin' || user?.role === 'reviewer';
    return Object.entries(MENU_ROUTES)
      .filter(([key]) => {
        if (key === '/users') return user?.role === 'root' || user?.role === 'admin';
        if (key === '/vote-moderation') return canModerateContent;
        return true;
      })
      .map(([key, { icon, label }]) => ({ key, icon, label }));
  }, [user?.role]);

  const breadcrumbItems = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    const label = BREADCRUMB_LABELS[segments[0]] ?? 'Halaman';
    const items = [{ title: 'Konsol' }, ...(segments.length ? [{ title: label }] : [])];
    // Sub-halaman: tidak semua segmen punya label; beri label segmen detail
    // per fitur (mis. /words/:id/edit → "Kata / Edit Kata").
    const subLabel =
      segments[0] === 'words'
        ? segments[1] === 'edit'
          ? 'Edit Kata'
          : 'Detail Kata'
        : segments[0] === 'contributions' && segments[1]
          ? 'Detail Kontribusi'
          : undefined;
    if (subLabel) {
      items.push({ title: subLabel });
    }
    return items;
  }, [pathname]);

  useEffect(() => {
    // Sesi mati (logout manual / refresh gagal) saat user sedang di halaman
    // proteksi → lemparkan ke halaman login.
    if (!isLoggedIn) {
      navigate({ to: '/login' });
    }
  }, [isLoggedIn, navigate]);

  const currentMenuKey = '/' + pathname.split('/').filter(Boolean)[0];

  return (
    <Layout className="console-layout">
      <Sider collapsible collapsedWidth={56} breakpoint="lg" width={220} theme="dark">
        <div className="console-layout__sider-brand">
          <TranslationOutlined />
          <span className="console-layout__sider-title">Sambasku</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[currentMenuKey]}
          items={menuItems}
          onClick={({ key }) => navigate({ to: key as MenuRoute })}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: colorBgContainer,
            paddingInline: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${colorFillAlter}`,
          }}
        >
          <Breadcrumb items={breadcrumbItems} />
          <Dropdown
            menu={{
              items: [{ key: 'logout', icon: <LogoutOutlined />, label: 'Keluar', danger: true }],
              onClick: async ({ key }) => {
                if (key !== 'logout') return;
                await logoutMutation.mutateAsync(undefined, {
                  onError: () => message.warning('Gagal logout di server, tetapi sesi lokal dibersihkan'),
                });
              },
            }}
            trigger={['click']}
          >
            <Button type="text" style={{ height: '100%' }}>
              <Space size={8}>
                <Avatar size="small" icon={<UserOutlined />} />
                <Typography.Text strong>{user?.username ?? 'Pengguna'}</Typography.Text>
                {user ? <Tag color="blue">{ROLE_LABELS[user.role as UserRole] ?? user.role}</Tag> : null}
              </Space>
            </Button>
          </Dropdown>
        </Header>
        <Content className="console-layout__content">
          <div
            style={{
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              padding: 24,
              minHeight: '100%',
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}