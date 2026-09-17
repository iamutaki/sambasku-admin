import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { App as AntdApp, ConfigProvider, theme } from 'antd';
import idID from 'antd/locale/id_ID';
import { router } from '@/app/router';
import { queryClient } from '@/app/query-client';
import { setOnAuthExpired } from '@/shared/api/client';
import '@/styles/index.css';

/**
 * Composition root frontend:
 * 1. daftarkan handler "sesi mati" ke axios client (refresh gagal → login),
 * 2. rakit provider: TanStack Query → antd ConfigProvider (token tema) →
 *    antd App (context message/modal) → RouterProvider.
 */
setOnAuthExpired(() => {
  router.navigate({ to: '/login' });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={idID}
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#1677ff',
            borderRadius: 8,
          },
        }}
      >
        <AntdApp>
          <RouterProvider router={router} />
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  </StrictMode>,
);