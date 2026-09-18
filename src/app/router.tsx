import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { sessionStore } from '@/shared/auth/session';
import { tryRestoreSession } from '@/features/auth/application/try-restore-session';
import { BaseLayout } from '@/shared/layouts/base-layout';
import { ConsoleLayout } from '@/shared/layouts/console-layout';
import { LoginPage } from '@/features/auth/presentation/login-page';
import { DashboardPage } from '@/features/dashboard/presentation/dashboard-page';
import { WordsPage } from '@/features/words/presentation/words-page';
import { CreateWordPage } from '@/features/words/presentation/create-word-page';
import { EditWordPage } from '@/features/words/presentation/edit-word-page';
import { WordDetailPage } from '@/features/words/presentation/word-detail-page';
import { ContributionsPage } from '@/features/contributions/presentation/contributions-page';
import { ContributionDetailPage } from '@/features/contributions/presentation/contribution-detail-page';
import { AuditLogsPage } from '@/features/audit/presentation/audit-logs-page';
import { NotFoundPage } from '@/shared/layouts/not-found-page';

/**
 * Route tree (didefinisikan manual, bukan file-based) - satu-satunya tempat
 * pemetaan path → halaman. Prinsip:
 *
 * - Root route: `beforeLoad` menjalankan session restore (hard reload) &
 *   seluruh navigasi lewat sini duluan.
 * - Dua layout (docs/admin/admin-base-stack.md Section 7):
 *   - `base-layout`   - publik / pra-auth (login). Guard: kalau sudah login,
 *     tidak boleh mampir ke sini (redirect /dashboard).
 *   - `console-layout` - area terproteksi. Guard: kalau belum login,
 *     dilempar ke /login.
 * - `/` (index) tidak menampilkan halaman apa pun - hanya redirect cerdas
 *   berdasarkan status sesi.
 */
const rootRoute = createRootRoute({
  beforeLoad: async () => {
    await tryRestoreSession();
  },
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: sessionStore.isAuthenticated() ? '/dashboard' : '/login' });
  },
});

// ---- Base layout (publik / pra-auth) ----
const baseLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'base-layout',
  component: BaseLayout,
});

const loginRoute = createRoute({
  getParentRoute: () => baseLayoutRoute,
  path: '/login',
  component: LoginPage,
  beforeLoad: () => {
    // Sesi sudah aktif (mis. user ketik /login manual) → arahkan ke konsol.
    if (sessionStore.isAuthenticated()) throw redirect({ to: '/dashboard' });
  },
});

// ---- Console layout (area terproteksi) ----
const consoleLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'console-layout',
  component: ConsoleLayout,
  beforeLoad: () => {
    if (!sessionStore.isAuthenticated()) throw redirect({ to: '/login' });
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/dashboard',
  component: DashboardPage,
});

const wordsRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/words',
  component: WordsPage,
});

const createWordRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/words/new',
  component: CreateWordPage,
});

const editWordRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/words/$id/edit',
  component: EditWordPage,
});

const wordDetailRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/words/$id',
  component: WordDetailPage,
});

const contributionsRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/contributions',
  component: ContributionsPage,
});

const contributionDetailRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/contributions/$id',
  component: ContributionDetailPage,
});

const auditLogsRoute = createRoute({
  getParentRoute: () => consoleLayoutRoute,
  path: '/audit-logs',
  component: AuditLogsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  baseLayoutRoute.addChildren([loginRoute]),
  consoleLayoutRoute.addChildren([dashboardRoute, wordsRoute, createWordRoute, wordDetailRoute, editWordRoute, contributionsRoute, contributionDetailRoute, auditLogsRoute]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}