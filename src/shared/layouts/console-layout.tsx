import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import {
  AuditOutlined,
  BookOutlined,
  CommentOutlined,
  DashboardOutlined,
  EditOutlined,
  FileTextOutlined,
  FlagOutlined,
  InboxOutlined,
  LikeOutlined,
  LogoutOutlined,
  MessageOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SendOutlined,
  StopOutlined,
  TranslationOutlined,
  UserOutlined,
  WarningOutlined,
  FileProtectOutlined,
} from '@ant-design/icons';
import { Avatar, Breadcrumb, Button, Dropdown, Layout, Menu, Space, Tag, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import { useAuth } from '@/shared/auth/use-auth';
import { ROLE_LABELS, type UserRole } from '@/features/auth/domain/user';
import { useLogout } from '@/features/auth/application/use-logout';
import { ApiTierBanner } from '@/shared/components/api-tier-banner';
import { ApiHostSwitcher } from '@/shared/components/api-host-switcher';
import { App as AntdApp } from 'antd';

const { Sider, Header, Content } = Layout;

/** Leaf routes di bawah grup Kamus - selectedKeys + auto-expand parent. */
const KAMUS_ROUTES = {
  '/words': { icon: <TranslationOutlined />, label: 'Kata' },
  '/contributions': { icon: <InboxOutlined />, label: 'Review' },
  '/translation-helps': { icon: <MessageOutlined />, label: 'Tanya' },
  '/word-suggestions': { icon: <EditOutlined />, label: 'Usul Edit' },
  '/word-reports': { icon: <WarningOutlined />, label: 'Laporan Entri' },
  '/comments': { icon: <CommentOutlined />, label: 'Komentar' },
  '/comment-blocklist': { icon: <StopOutlined />, label: 'Blocklist' },
  '/search-misses': { icon: <SearchOutlined />, label: 'Pencarian' },
  '/vote-moderation': { icon: <LikeOutlined />, label: 'Vote' },
} as const;

/** Leaf routes di bawah grup Notifikasi. */
const NOTIFICATION_ROUTES = {
  '/notification-templates': { icon: <FileTextOutlined />, label: 'Template' },
  '/notification-campaigns': { icon: <SendOutlined />, label: 'Campaign' },
} as const;

type KamusRoute = keyof typeof KAMUS_ROUTES;
type NotificationRoute = keyof typeof NOTIFICATION_ROUTES;
type TopRoute =
  | '/dashboard'
  | '/users'
  | '/audit-logs'
  | '/bug-reports'
  | '/verifier-applications'
  | '/legal';
type MenuRoute = KamusRoute | NotificationRoute | TopRoute;

const KAMUS_GROUP_KEY = 'kamus';
const NOTIFICATION_GROUP_KEY = 'notifikasi';

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  words: 'Kata',
  contributions: 'Review',
  'translation-helps': 'Tanya Terjemahan',
  'word-suggestions': 'Usul Edit',
  'word-reports': 'Laporan Entri',
  comments: 'Komentar',
  'comment-blocklist': 'Blocklist',
  'search-misses': 'Pencarian',
  'vote-moderation': 'Vote',
  'audit-logs': 'Audit Log',
  'bug-reports': 'Laporan Masalah',
  users: 'Pengguna',
  'verifier-applications': 'Pengajuan verifikator',
  'notification-campaigns': 'Campaign',
  'notification-templates': 'Template',
  profile: 'Profil',
  legal: 'Legal & OAuth',
};

function topPath(pathname: string): string {
  return '/' + (pathname.split('/').filter(Boolean)[0] ?? '');
}

function groupKeyForPath(pathname: string): string | null {
  const top = topPath(pathname);
  if (top in KAMUS_ROUTES) return KAMUS_GROUP_KEY;
  if (top in NOTIFICATION_ROUTES) return NOTIFICATION_GROUP_KEY;
  return null;
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
        key === '/word-reports' || key === '/translation-helps'
          ? canModerateContent || user?.role === 'editor'
          : key === '/vote-moderation' || key === '/word-suggestions'
            ? canModerateContent
            : key === '/comment-blocklist'
              ? canManageUsers
              : true,
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
      items.push({
        key: NOTIFICATION_GROUP_KEY,
        icon: <NotificationOutlined />,
        label: 'Notifikasi',
        children: (
          Object.entries(NOTIFICATION_ROUTES) as [
            NotificationRoute,
            (typeof NOTIFICATION_ROUTES)[NotificationRoute],
          ][]
        ).map(([key, { icon, label }]) => ({ key, icon, label })),
      });
      items.push({ key: '/bug-reports', icon: <FlagOutlined />, label: 'Laporan Masalah' });
      items.push({ key: '/legal', icon: <FileProtectOutlined />, label: 'Legal & OAuth' });
    }
    items.push({ key: '/audit-logs', icon: <AuditOutlined />, label: 'Audit Log' });
    return items;
  }, [user?.role]);

  const breadcrumbItems = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    const label = BREADCRUMB_LABELS[segments[0]] ?? 'Halaman';
    const inNotificationGroup = groupKeyForPath(pathname) === NOTIFICATION_GROUP_KEY;
    const items = [
      { title: 'Konsol' },
      ...(inNotificationGroup ? [{ title: 'Notifikasi' }] : []),
      ...(segments.length ? [{ title: label }] : []),
    ];
    const subLabel =
      segments[0] === 'words'
        ? segments[1] === 'new'
          ? 'Tambah Kata'
          : segments[1] === 'import-history'
            ? segments[2]
              ? 'Detail impor'
              : 'Riwayat impor'
            : segments[2] === 'edit'
              ? 'Edit Kata'
              : segments[1]
                ? 'Detail Kata'
                : undefined
        : segments[0] === 'contributions' && segments[1]
          ? 'Detail Kontribusi'
          : segments[0] === 'translation-helps' && segments[1]
            ? 'Detail'
            : segments[0] === 'verifier-applications' && segments[1]
              ? 'Detail pengajuan'
              : segments[0] === 'notification-campaigns' && segments[1]
                ? 'Detail campaign'
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

  const currentMenuKey = topPath(pathname) === '/' ? '/dashboard' : topPath(pathname);
  const activeGroupKey = groupKeyForPath(pathname);

  // Controlled openKeys: route di bawah grup → parent tetap expand;
  // user boleh collapse manual, tapi navigasi ke child me-expand lagi.
  // Sesuaikan saat render (bukan effect) supaya tidak cascade commit.
  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    activeGroupKey ? [activeGroupKey] : [],
  );
  const [expandedForMenuKey, setExpandedForMenuKey] = useState(currentMenuKey);
  if (activeGroupKey && expandedForMenuKey !== currentMenuKey) {
    setExpandedForMenuKey(currentMenuKey);
    if (!openKeys.includes(activeGroupKey)) {
      setOpenKeys([...openKeys, activeGroupKey]);
    }
  }

  return (
    <Layout className="console-layout">
      <Sider collapsible collapsedWidth={56} breakpoint="lg" width={220} theme="dark">
        <div className="console-layout__sider-brand">
          <img
            className="console-layout__sider-logo"
            src="/logo_white.webp"
            alt="SambasKu"
            width={512}
            height={678}
            decoding="async"
          />
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
          <Space size={16} align="center">
            {user?.role === 'root' || user?.role === 'admin' ? <ApiHostSwitcher /> : null}
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
          </Space>
        </Header>
        <Content className="console-layout__content">
          <ApiTierBanner />
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
