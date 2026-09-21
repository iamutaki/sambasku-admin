import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import {
  AuditOutlined,
  BookOutlined,
  CommentOutlined,
  DashboardOutlined,
  EditOutlined,
  FlagOutlined,
  InboxOutlined,
  LikeOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TranslationOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Breadcrumb, Button, Dropdown, Layout, Menu, Space, Tag, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import { useAuth } from '@/shared/auth/use-auth';
import { ROLE_LABELS, type UserRole } from '@/features/auth/domain/user';
import { useLogout } from '@/features/auth/application/use-logout';
import { App as AntdApp } from 'antd';

const { Sider, Header, Content } = Layout;

/** Leaf routes di bawah grup Kamus - selectedKeys + auto-expand parent. */
const KAMUS_ROUTES = {
  '/words': { icon: <TranslationOutlined />, label: 'Kata' },
  '/contributions': { icon: <InboxOutlined />, label: 'Review' },
  '/word-suggestions': { icon: <EditOutlined />, label: 'Usul Edit' },
  '/comments': { icon: <CommentOutlined />, label: 'Komentar' },
  '/search-misses': { icon: <SearchOutlined />, label: 'Pencarian' },
  '/vote-moderation': { icon: <LikeOutlined />, label: 'Vote' },
} as const;

type KamusRoute = keyof typeof KAMUS_ROUTES;
type TopRoute = '/dashboard' | '/users' | '/audit-logs' | '/bug-reports' | '/verifier-applications';
type MenuRoute = KamusRoute | TopRoute;

const KAMUS_GROUP_KEY = 'kamus';

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  words: 'Kata',
  contributions: 'Review',
  'word-suggestions': 'Usul Edit',
  comments: 'Komentar',
  'search-misses': 'Pencarian',
  'vote-moderation': 'Vote',
  'audit-logs': 'Audit Log',
  'bug-reports': 'Laporan Masalah',
  users: 'Pengguna',
  'verifier-applications': 'Pengajuan verifikator',
  profile: 'Profil',
};

function isKamusPath(pathname: string): boolean {
  const top = '/' + (pathname.split('/').filter(Boolean)[0] ?? '');
  return top in KAMUS_ROUTES;
}

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

  const menuItems = useMemo((): MenuProps['items'] => {
    const canModerateContent =
      user?.role === 'root' || user?.role === 'admin' || user?.role === 'reviewer';
    const canManageUsers = user?.role === 'root' || user?.role === 'admin';

    const kamusChildren = (Object.entries(KAMUS_ROUTES) as [KamusRoute, (typeof KAMUS_ROUTES)[KamusRoute]][])
      .filter(([key]) =>
        key === '/vote-moderation' || key === '/word-suggestions' ? canModerateContent : true,
      )
      .map(([key, { icon, label }]) => ({ key, icon, label }));

    const items: MenuProps['items'] = [
      { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
      {
        key: KAMUS_GROUP_KEY,
        icon: <BookOutlined />,
        label: 'Kamus',
        children: kamusChildren,
      },
    ];
    if (canManageUsers) {
      items.push({ key: '/users', icon: <UserOutlined />, label: 'Pengguna' });
      items.push({
        key: '/verifier-applications',
        icon: <SafetyCertificateOutlined />,
        label: 'Pengajuan verifikator',
      });
      items.push({ key: '/bug-reports', icon: <FlagOutlined />, label: 'Laporan Masalah' });
    }
    items.push({ key: '/audit-logs', icon: <AuditOutlined />, label: 'Audit Log' });
    return items;
  }, [user?.role]);

  const breadcrumbItems = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    const label = BREADCRUMB_LABELS[segments[0]] ?? 'Halaman';
    const items = [{ title: 'Konsol' }, ...(segments.length ? [{ title: label }] : [])];
    const subLabel =
      segments[0] === 'words'
        ? segments[1] === 'new'
          ? 'Tambah Kata'
          : segments[2] === 'edit'
            ? 'Edit Kata'
            : segments[1]
              ? 'Detail Kata'
              : undefined
        : segments[0] === 'contributions' && segments[1]
          ? 'Detail Kontribusi'
          : segments[0] === 'verifier-applications' && segments[1]
            ? 'Detail pengajuan'
            : undefined;
    if (subLabel) {
      items.push({ title: subLabel });
    }
    return items;
  }, [pathname]);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate({ to: '/login' });
    }
  }, [isLoggedIn, navigate]);

  const currentMenuKey = '/' + (pathname.split('/').filter(Boolean)[0] ?? 'dashboard');
  const kamusActive = isKamusPath(pathname);

  // Controlled openKeys: route di bawah Kamus → parent tetap expand;
  // user boleh collapse manual, tapi navigasi ke child me-expand lagi.
  // Sesuaikan saat render (bukan effect) supaya tidak cascade commit.
  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    kamusActive ? [KAMUS_GROUP_KEY] : [],
  );
  const [expandedForMenuKey, setExpandedForMenuKey] = useState(currentMenuKey);
  if (kamusActive && expandedForMenuKey !== currentMenuKey) {
    setExpandedForMenuKey(currentMenuKey);
    if (!openKeys.includes(KAMUS_GROUP_KEY)) {
      setOpenKeys([...openKeys, KAMUS_GROUP_KEY]);
    }
  }

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
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          items={menuItems}
          onClick={({ key }) => {
            // Parent group key ('kamus') tidak navigate - hanya leaf path
            if (key.startsWith('/')) {
              navigate({ to: key as MenuRoute });
            }
          }}
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
              items: [
                { key: 'profile', icon: <UserOutlined />, label: 'Profil' },
                { key: 'logout', icon: <LogoutOutlined />, label: 'Keluar', danger: true },
              ],
              onClick: async ({ key }) => {
                if (key === 'profile') {
                  navigate({ to: '/profile' });
                  return;
                }
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
            className="console-layout__card"
            style={{
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
